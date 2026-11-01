-- Signature à distance d'un devis finalisé (signature électronique SIMPLE : nom + tracé + case « bon pour accord »).
-- À appliquer sur la base TEST uniquement. Ne modifie ni devis, ni factures, ni compteurs : table et fonctions séparées.
-- Le jeton de signature n'est JAMAIS stocké : seule son empreinte SHA-256 l'est. Le devis lui-même reste figé.
begin;

create table public.signatures_devis (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  devis_id uuid not null references public.devis(id),
  jeton_hash text not null unique,
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null,
  revoque_le timestamptz,
  signe_le timestamptz,
  signataire_nom text,
  signature_image text,
  empreinte_document text,
  agent_utilisateur text,
  constraint signatures_hash_format check (jeton_hash ~ '^[0-9a-f]{64}$'),
  constraint signatures_coherence check (
    (signe_le is null and signataire_nom is null and signature_image is null and empreinte_document is null)
    or (signe_le is not null and signataire_nom is not null and signature_image is not null and empreinte_document is not null and revoque_le is null)),
  constraint signatures_image_format check (signature_image is null or (signature_image ~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' and length(signature_image) <= 250000)),
  constraint signatures_nom_format check (signataire_nom is null or (char_length(signataire_nom) between 2 and 80 and signataire_nom !~ '[[:cntrl:]]'))
);
create index signatures_devis_devis_idx on public.signatures_devis(devis_id);
-- Un seul devis signé une fois : au plus une signature par devis.
create unique index signatures_devis_une_signature on public.signatures_devis(devis_id) where signe_le is not null;

alter table public.signatures_devis enable row level security;
revoke all on public.signatures_devis from public, anon, authenticated;
grant select (id, devis_id, cree_le, expire_le, revoque_le, signe_le, signataire_nom, signature_image, empreinte_document) on public.signatures_devis to authenticated;
create policy signatures_lecture_proprietaire on public.signatures_devis for select to authenticated using (owner_id = auth.uid());

-- Une signature enregistrée est figée : ni modification, ni suppression (même par les fonctions ci-dessous).
create function public.signatures_devis_garde() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'signature_figee' using errcode = '42501'; end if;
  if old.signe_le is not null then raise exception 'signature_figee' using errcode = '42501'; end if;
  if new.devis_id <> old.devis_id or new.owner_id <> old.owner_id or new.jeton_hash <> old.jeton_hash then raise exception 'signature_champ_fige' using errcode = '42501'; end if;
  return new;
end $$;
create trigger signatures_devis_garde before update or delete on public.signatures_devis for each row execute function public.signatures_devis_garde();

-- Contenu présenté au client et haché : projection du devis figé, sans identifiant interne.
create function public.signature_projection(p_devis_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'reference', coalesce(d.reference_definitive, d.reference), 'objet', d.objet, 'date_devis', d.date_devis, 'date_validite', d.date_validite,
    'client', d.client_copie, 'entreprise', d.entreprise_copie, 'remarques', d.remarques, 'conditions_paiement', d.conditions_paiement,
    'total_ht_centimes', d.total_ht_centimes, 'total_tva_centimes', d.total_tva_centimes, 'total_ttc_centimes', d.total_ttc_centimes,
    'ventilation_tva', d.ventilation_tva,
    'lignes', coalesce((select jsonb_agg(jsonb_build_object('position', l.position, 'type', l.type, 'reference', l.reference, 'designation', l.designation,
      'description', l.description, 'unite', l.unite, 'quantite_milliemes', l.quantite_milliemes, 'prix_ht_centimes', l.prix_ht_centimes,
      'taux_tva_milliemes', l.taux_tva_milliemes, 'ht_centimes', l.ht_centimes, 'tva_centimes', l.tva_centimes, 'ttc_centimes', l.ttc_centimes) order by l.position)
      from public.devis_lignes l where l.devis_id = d.id), '[]'::jsonb))
  from public.devis d where d.id = p_devis_id and d.statut = 'finalise';
$$;
revoke all on function public.signature_projection(uuid) from public, anon, authenticated;

create function public.signature_empreinte(p jsonb) returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p::text, 'utf8')), 'hex');
$$;
revoke all on function public.signature_empreinte(jsonb) from public, anon, authenticated;

-- PROPRIÉTAIRE : crée un lien (le jeton est généré par le navigateur, transmis une fois, jamais conservé).
create function public.creer_lien_signature(p_devis_id uuid, p_jeton text, p_validite_jours integer default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); d public.devis%rowtype; ligne public.signatures_devis%rowtype;
begin
  if uid is null then raise exception 'connexion_requise' using errcode = '42501'; end if;
  if p_jeton is null or p_jeton !~ '^[A-Za-z0-9_-]{43,64}$' then raise exception 'jeton_invalide'; end if;
  if p_validite_jours is null or p_validite_jours not between 1 and 90 then raise exception 'validite_invalide'; end if;
  select * into d from public.devis where id = p_devis_id and owner_id = uid for update;
  if not found then raise exception 'devis_introuvable' using errcode = 'P0002'; end if;
  if d.statut <> 'finalise' then raise exception 'devis_non_finalise'; end if;
  if exists (select 1 from public.signatures_devis where devis_id = p_devis_id and signe_le is not null) then raise exception 'deja_signe'; end if;
  update public.signatures_devis set revoque_le = now() where devis_id = p_devis_id and signe_le is null and revoque_le is null;
  insert into public.signatures_devis(owner_id, devis_id, jeton_hash, expire_le)
    values (uid, p_devis_id, encode(sha256(convert_to(p_jeton, 'utf8')), 'hex'), now() + make_interval(days => p_validite_jours))
    returning * into ligne;
  return jsonb_build_object('id', ligne.id, 'expire_le', ligne.expire_le);
end $$;
revoke all on function public.creer_lien_signature(uuid, text, integer) from public, anon;
grant execute on function public.creer_lien_signature(uuid, text, integer) to authenticated;

create function public.revoquer_lien_signature(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); l public.signatures_devis%rowtype;
begin
  if uid is null then raise exception 'connexion_requise' using errcode = '42501'; end if;
  select * into l from public.signatures_devis where id = p_id and owner_id = uid for update;
  if not found then raise exception 'lien_introuvable' using errcode = 'P0002'; end if;
  if l.signe_le is not null then raise exception 'signature_figee' using errcode = '42501'; end if;
  update public.signatures_devis set revoque_le = coalesce(revoque_le, now()) where id = p_id;
end $$;
revoke all on function public.revoquer_lien_signature(uuid) from public, anon;
grant execute on function public.revoquer_lien_signature(uuid) to authenticated;

-- CLIENT (sans compte) : lit le devis lié au jeton. Un jeton inconnu et un jeton invalide donnent la même réponse.
create function public.lire_devis_pour_signature(p_jeton text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare l public.signatures_devis%rowtype; proj jsonb; etat text;
begin
  if p_jeton is null or p_jeton !~ '^[A-Za-z0-9_-]{43,64}$' then return jsonb_build_object('etat', 'introuvable'); end if;
  select * into l from public.signatures_devis where jeton_hash = encode(sha256(convert_to(p_jeton, 'utf8')), 'hex');
  if not found then return jsonb_build_object('etat', 'introuvable'); end if;
  if l.signe_le is not null then etat := 'signe';
  elsif l.revoque_le is not null then return jsonb_build_object('etat', 'revoque');
  elsif l.expire_le <= now() then return jsonb_build_object('etat', 'expire');
  else etat := 'ouvert'; end if;
  proj := public.signature_projection(l.devis_id);
  if proj is null then return jsonb_build_object('etat', 'introuvable'); end if;
  return jsonb_build_object('etat', etat, 'devis', proj, 'empreinte', coalesce(l.empreinte_document, public.signature_empreinte(proj)),
    'signe_le', l.signe_le, 'signataire_nom', l.signataire_nom, 'expire_le', l.expire_le);
end $$;
revoke all on function public.lire_devis_pour_signature(text) from public;
grant execute on function public.lire_devis_pour_signature(text) to anon, authenticated;

create function public.signer_devis_distant(p_jeton text, p_nom text, p_image text, p_accord boolean, p_agent text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.signatures_devis%rowtype; proj jsonb; emp text; nom text := btrim(coalesce(p_nom, ''));
begin
  if p_jeton is null or p_jeton !~ '^[A-Za-z0-9_-]{43,64}$' then raise exception 'lien_invalide'; end if;
  select * into l from public.signatures_devis where jeton_hash = encode(sha256(convert_to(p_jeton, 'utf8')), 'hex') for update;
  if not found then raise exception 'lien_invalide'; end if;
  if l.signe_le is not null then raise exception 'deja_signe'; end if;
  if l.revoque_le is not null then raise exception 'lien_revoque'; end if;
  if l.expire_le <= now() then raise exception 'lien_expire'; end if;
  if p_accord is distinct from true then raise exception 'accord_requis'; end if;
  if char_length(nom) not between 2 and 80 or nom ~ '[[:cntrl:]]' then raise exception 'nom_invalide'; end if;
  if p_image is null or p_image !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' or length(p_image) > 250000 then raise exception 'image_invalide'; end if;
  proj := public.signature_projection(l.devis_id);
  if proj is null then raise exception 'devis_indisponible'; end if;
  emp := public.signature_empreinte(proj);
  update public.signatures_devis set signe_le = now(), signataire_nom = nom, signature_image = p_image, empreinte_document = emp,
    agent_utilisateur = left(regexp_replace(coalesce(p_agent, ''), '[[:cntrl:]]', '', 'g'), 300) where id = l.id;
  return jsonb_build_object('etat', 'signe', 'empreinte', emp, 'signe_le', now());
end $$;
revoke all on function public.signer_devis_distant(text, text, text, boolean, text) from public;
grant execute on function public.signer_devis_distant(text, text, text, boolean, text) to anon, authenticated;

commit;
