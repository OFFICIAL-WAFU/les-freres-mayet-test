-- Accueil des données reprises de l'ancien logiciel (Khosmos) — 03/11/2026, accord de Baptiste.
-- Uniquement additif : aucune donnée existante modifiée ni supprimée.
--  1. Lots d'import (chaque reprise porte un numéro de lot, retirable en bloc).
--  2. Catalogue : prix d'achat, famille, fournisseur, code d'origine ; ouvrages et leur composition.
--  3. Clients : code d'origine (pour rattacher l'historique au bon client).
--  4. Documents importés : devis, factures, acomptes, avoirs historiques avec leur NUMÉRO D'ORIGINE, figés.
--  5. Numérotation : les nouveaux documents suivent le format actuel (D2026-00001, F2026-00001, A2026-00001)
--     et ne peuvent jamais reprendre un numéro déjà présent dans l'historique.
--  6. Modèles de devis par type de travaux et base de connaissances métier (lue par l'IA des devis).
begin;

-- 1. Lots d'import ---------------------------------------------------------------------------
create table public.lots_import (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  nature text not null check (nature in ('catalogue','ouvrages','clients','documents','modeles','connaissances','parametres')),
  source text not null default 'khosmos' check (char_length(source) <= 100),
  description text not null default '' check (char_length(description) <= 2000),
  cree_le timestamptz not null default now()
);
alter table public.lots_import enable row level security;
revoke all on public.lots_import from public, anon, authenticated;
grant select on public.lots_import to authenticated;
create policy lots_import_lecture on public.lots_import for select to authenticated using (owner_id = auth.uid());

-- 2. Catalogue ----------------------------------------------------------------------------------
alter table public.articles
  add column prix_achat_centimes bigint check (prix_achat_centimes is null or prix_achat_centimes >= 0),
  add column famille text not null default '' check (char_length(famille) <= 100),
  add column fournisseur text not null default '' check (char_length(fournisseur) <= 100),
  add column code_source text not null default '' check (char_length(code_source) <= 100),
  add column lot_import uuid references public.lots_import(id);
create index articles_lot_import on public.articles(lot_import) where lot_import is not null;

create table public.ouvrages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  reference text not null check (btrim(reference) <> '' and char_length(reference) <= 100),
  designation text not null check (btrim(designation) <> '' and char_length(designation) <= 500),
  description text not null default '' check (char_length(description) <= 10000),
  metier text not null default 'general' check (metier in ('plomberie','electricite','climatisation','general')),
  unite text not null default 'forfait' check (unite in ('piece','heure','forfait','metre','m2','m3')),
  prix_ht_centimes bigint check (prix_ht_centimes is null or prix_ht_centimes >= 0),
  famille text not null default '' check (char_length(famille) <= 100),
  archive boolean not null default false,
  code_source text not null default '' check (char_length(code_source) <= 100),
  lot_import uuid references public.lots_import(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ouvrages_reference_unique on public.ouvrages(owner_id, lower(btrim(reference)));
create table public.ouvrages_composants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  ouvrage_id uuid not null references public.ouvrages(id),
  position integer not null check (position >= 0),
  article_id uuid references public.articles(id),
  type text not null check (type in ('materiel','prestation')),
  reference text not null default '' check (char_length(reference) <= 100),
  designation text not null check (btrim(designation) <> '' and char_length(designation) <= 500),
  unite text not null check (unite in ('piece','heure','forfait','metre','m2','m3')),
  quantite_milliemes bigint not null check (quantite_milliemes > 0),
  prix_achat_centimes bigint check (prix_achat_centimes is null or prix_achat_centimes >= 0),
  prix_ht_centimes bigint not null check (prix_ht_centimes >= 0),
  constraint ouvrages_composants_position_unique unique (ouvrage_id, position) deferrable initially deferred
);
create function public.ouvrages_composants_verifier() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if not exists (select 1 from public.ouvrages o where o.id = new.ouvrage_id and o.owner_id = new.owner_id) then
    raise exception 'ouvrage_non_autorise' using errcode = '42501'; end if;
  if new.article_id is not null and not exists (select 1 from public.articles a where a.id = new.article_id and a.owner_id = new.owner_id) then
    raise exception 'article_non_autorise' using errcode = '42501'; end if;
  return new;
end $$;
create trigger ouvrages_horodatage before insert or update on public.ouvrages for each row execute function public.clients_horodatage();
create trigger ouvrages_composants_verifier before insert or update on public.ouvrages_composants for each row execute function public.ouvrages_composants_verifier();

-- 3. Clients ------------------------------------------------------------------------------------
alter table public.clients
  add column code_source text not null default '' check (char_length(code_source) <= 100),
  add column lot_import uuid references public.lots_import(id);
create unique index clients_code_source_unique on public.clients(owner_id, code_source) where code_source <> '';

-- 4. Documents importés (historique figé, numéros d'origine) -------------------------------------
create table public.documents_importes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  lot_import uuid not null references public.lots_import(id),
  type text not null check (type in ('devis','facture','acompte','avoir')),
  reference text not null check (reference ~ '^[DFA][0-9]{4}-[0-9]{5}$'),
  date_document date not null,
  client_id uuid references public.clients(id),
  client_nom text not null default '' check (char_length(client_nom) <= 300),
  client_copie jsonb not null default '{}' check (jsonb_typeof(client_copie) = 'object'),
  objet text not null default '' check (char_length(objet) <= 2000),
  total_ht_centimes bigint not null,
  total_tva_centimes bigint not null,
  total_ttc_centimes bigint not null,
  ventilation_tva jsonb not null default '[]' check (jsonb_typeof(ventilation_tva) = 'array'),
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  statut_source text not null default '' check (char_length(statut_source) <= 100),
  date_echeance date,
  reference_liee text not null default '' check (char_length(reference_liee) <= 100),
  deja_regle_centimes bigint check (deja_regle_centimes is null or deja_regle_centimes >= 0),
  source jsonb not null default '{}' check (jsonb_typeof(source) = 'object'),
  cree_le timestamptz not null default now(),
  constraint documents_importes_reference_unique unique (owner_id, reference),
  constraint documents_importes_prefixe check (
    (type = 'devis' and left(reference,1) = 'D') or (type in ('facture','acompte') and left(reference,1) = 'F')
    or (type = 'avoir' and left(reference,1) = 'A')),
  constraint documents_importes_totaux check (total_ttc_centimes = total_ht_centimes + total_tva_centimes)
);
create index documents_importes_client on public.documents_importes(client_id);
-- Figés : seul le rattachement à un client peut être complété ; un lot entier ne se retire que par l'administrateur.
create function public.documents_importes_figer() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('app.retrait_lot', true) is distinct from old.lot_import::text then
      raise exception 'document_importe_fige' using errcode = '42501'; end if;
    return old;
  end if;
  if (to_jsonb(new) - 'client_id') is distinct from (to_jsonb(old) - 'client_id') or old.client_id is not null then
    raise exception 'document_importe_fige' using errcode = '42501'; end if;
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
    raise exception 'client_non_autorise' using errcode = '42501'; end if;
  return new;
end $$;
create trigger documents_importes_figer before update or delete on public.documents_importes
  for each row execute function public.documents_importes_figer();

-- 5. Numérotation au format actuel ---------------------------------------------------------------
create function public.reference_document(p_prefixe text, p_annee integer, p_numero integer) returns text
language sql immutable set search_path to '' as $$
  select p_prefixe || p_annee::text || '-' || lpad(p_numero::text, 5, '0')
$$;
do $$
declare
  r record; def text; nouveau text;
begin
  for r in select * from (values
    ('public.finaliser_devis(uuid,integer)', '''DEV-LFM-'' || an || ''-'' || lpad(n::text, 5, ''0'')', 'public.reference_document(''D'', an, n)'),
    ('public.finaliser_facture(uuid,integer)', '''FAC-LFM-'' || an || ''-'' || lpad(n::text, 5, ''0'')', 'public.reference_document(''F'', an, n)'),
    ('public.finaliser_avoir(uuid,integer)', '''AV-LFM-'' || an || ''-'' || lpad(n::text, 5, ''0'')', 'public.reference_document(''A'', an, n)')
  ) v(fonction, ancien, remplacement) loop
    def := pg_get_functiondef(r.fonction::regprocedure);
    if (length(def) - length(replace(def, r.ancien, ''))) / length(r.ancien) <> 1 then
      raise exception 'numerotation_introuvable dans %', r.fonction; end if;
    nouveau := replace(def, r.ancien, r.remplacement);
    execute nouveau;
  end loop;
end $$;

-- Un numéro déjà présent dans l'historique n'est jamais réattribué.
create function public.reference_hors_historique() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.reference_definitive is not null and new.reference_definitive is distinct from old.reference_definitive
     and exists (select 1 from public.documents_importes d where d.owner_id = new.owner_id and d.reference = new.reference_definitive) then
    raise exception 'numero_deja_dans_historique' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function public.reference_hors_historique() from public, anon, authenticated;
create trigger devis_reference_hors_historique before update on public.devis for each row execute function public.reference_hors_historique();
create trigger factures_reference_hors_historique before update on public.factures for each row execute function public.reference_hors_historique();
create trigger avoirs_reference_hors_historique before update on public.avoirs for each row execute function public.reference_hors_historique();

-- Cale les compteurs sur le dernier numéro de l'historique (ne les fait jamais reculer). Administrateur uniquement.
create function public.caler_compteurs_historique(p_owner uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare resultat jsonb;
begin
  insert into public.compteurs_references(owner_id, type_document, annee, dernier)
  select p_owner, t, a, m from (
    select case type when 'devis' then 'devis' when 'avoir' then 'avoir' else 'facture' end t,
           substr(reference, 2, 4)::integer a, max(right(reference, 5)::integer) m
    from public.documents_importes where owner_id = p_owner group by 1, 2) s
  on conflict (owner_id, type_document, annee) do update
    set dernier = greatest(public.compteurs_references.dernier, excluded.dernier);
  select coalesce(jsonb_agg(jsonb_build_object('type', type_document, 'annee', annee, 'dernier', dernier) order by type_document, annee), '[]')
    into resultat from public.compteurs_references where owner_id = p_owner;
  return resultat;
end $$;
revoke all on function public.caler_compteurs_historique(uuid) from public, anon, authenticated;

-- 6. Modèles de devis et connaissances métier ----------------------------------------------------
create table public.modeles_devis (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  nom text not null check (btrim(nom) <> '' and char_length(nom) <= 200),
  metier text not null default 'general' check (metier in ('plomberie','electricite','climatisation','general')),
  type_travaux text not null default '' check (char_length(type_travaux) <= 200),
  objet text not null default '' check (char_length(objet) <= 2000),
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  remarques text not null default '' check (char_length(remarques) <= 10000),
  conditions_paiement text not null default '' check (char_length(conditions_paiement) <= 2000),
  notes_usage text not null default '' check (char_length(notes_usage) <= 10000),
  archive boolean not null default false,
  lot_import uuid references public.lots_import(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger modeles_devis_horodatage before insert or update on public.modeles_devis for each row execute function public.clients_horodatage();

create table public.connaissances_metier (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  categorie text not null check (categorie in ('tarif','regle','redaction','checklist','mention','fournisseur','autre')),
  metier text not null default 'general' check (metier in ('plomberie','electricite','climatisation','general')),
  titre text not null check (btrim(titre) <> '' and char_length(titre) <= 300),
  contenu text not null check (char_length(contenu) <= 20000),
  donnees jsonb not null default '{}' check (jsonb_typeof(donnees) in ('object','array')),
  source text not null default '' check (char_length(source) <= 500),
  statut text not null default 'a_valider' check (statut in ('a_valider','valide','rejete')),
  lot_import uuid references public.lots_import(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger connaissances_metier_horodatage before insert or update on public.connaissances_metier for each row execute function public.clients_horodatage();

-- Droits : propriétaire uniquement, aucune suppression (archivage), anon exclu. ------------------
do $$
declare t text;
begin
  foreach t in array array['ouvrages','ouvrages_composants','modeles_devis','connaissances_metier','documents_importes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())', t || '_lecture', t);
  end loop;
  foreach t in array array['ouvrages','ouvrages_composants','modeles_devis','connaissances_metier'] loop
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())', t || '_creation', t);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t || '_modification', t);
  end loop;
  grant delete on public.ouvrages_composants to authenticated;
  create policy ouvrages_composants_suppression on public.ouvrages_composants for delete to authenticated using (owner_id = auth.uid());
  -- Historique : lecture, et seulement le rattachement d'un client.
  grant select on public.documents_importes to authenticated;
  grant update (client_id) on public.documents_importes to authenticated;
  create policy documents_importes_rattachement on public.documents_importes for update to authenticated
    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
end $$;

commit;
