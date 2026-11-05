-- Relances des devis (décision de Baptiste du 05/11/2026). Deux tables, écritures uniquement par fonctions SQL :
-- 1) messages_modeles : la bibliothèque des modèles de messages, jusqu'ici sur chaque appareil (IndexedDB), devient la
--    même partout. Version entière + contrôle de concurrence (PT409), comme la trésorerie.
-- 2) envois_devis : journal des envois et relances d'un devis FINALISÉ (envoi, relance 1, relance 2). Une relance écartée sans envoi est notée avec canal = 'aucun'.
--    Une ligne n'est jamais modifiée ni supprimée. Il sert à savoir quand relancer et à ne jamais relancer deux fois.
-- Rien ici n'envoie de mail : l'envoi (Gmail ou messagerie) est fait par l'application, sur clic de l'utilisateur,
-- puis noté ici. Les devis eux-mêmes ne sont jamais modifiés.
begin;

create table public.messages_modeles (
  owner_id uuid primary key references auth.users(id) default auth.uid(),
  version integer not null default 1 check (version >= 1),
  modeles jsonb not null check (jsonb_typeof(modeles) = 'object' and pg_column_size(modeles) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.messages_modeles enable row level security;
revoke all on public.messages_modeles from public, anon, authenticated;
grant select on public.messages_modeles to authenticated;
create policy messages_modeles_lecture on public.messages_modeles for select to authenticated using (owner_id = auth.uid());

create function public.modifier_messages(p_version integer, p_modeles jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); n integer; r public.messages_modeles%rowtype;
begin
  if uid is null then raise exception 'connexion_requise' using errcode = '42501'; end if;
  if p_version is null or p_version < 0 then raise exception 'version_invalide' using errcode = '22023'; end if;
  if p_modeles is null or jsonb_typeof(p_modeles) <> 'object' or pg_column_size(p_modeles) > 200000 then
    raise exception 'donnees_invalides' using errcode = '22023'; end if;
  if p_version = 0 then
    insert into public.messages_modeles(owner_id, modeles) values (uid, p_modeles) on conflict (owner_id) do nothing;
    get diagnostics n = row_count;
  else
    update public.messages_modeles set modeles = p_modeles, version = version + 1, updated_at = now()
      where owner_id = uid and version = p_version;
    get diagnostics n = row_count;
  end if;
  if n = 0 then raise exception 'conflit_version' using errcode = 'PT409'; end if;
  select * into r from public.messages_modeles where owner_id = uid;
  return jsonb_build_object('version', r.version, 'modeles', r.modeles);
end $$;
revoke all on function public.modifier_messages(integer, jsonb) from public, anon;
grant execute on function public.modifier_messages(integer, jsonb) to authenticated;

create table public.envois_devis (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) default auth.uid(),
  devis_id uuid not null references public.devis(id),
  nature text not null check (nature in ('envoi', 'relance1', 'relance2')),
  -- canal 'aucun' : relance écartée volontairement (rien n'est parti), elle compte comme faite.
  canal text not null check (canal in ('gmail', 'messagerie', 'aucun')),
  destinataire text not null default '' check (char_length(destinataire) <= 320),
  sujet text not null default '' check (char_length(sujet) <= 200),
  avec_pdf boolean not null default false,
  avec_lien boolean not null default false,
  le timestamptz not null default now()
);
create index envois_devis_devis on public.envois_devis(devis_id);
create unique index envois_devis_relance_unique on public.envois_devis(devis_id, nature) where nature in ('relance1', 'relance2');
alter table public.envois_devis enable row level security;
revoke all on public.envois_devis from public, anon, authenticated;
grant select on public.envois_devis to authenticated;
create policy envois_devis_lecture on public.envois_devis for select to authenticated using (owner_id = auth.uid());

-- Idempotent sur l'identifiant tiré par le navigateur : une nouvelle tentative ne crée jamais de doublon.
create function public.noter_envoi_devis(p_id uuid, p_devis_id uuid, p_nature text, p_canal text, p_destinataire text,
  p_sujet text, p_avec_pdf boolean, p_avec_lien boolean) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); e public.envois_devis%rowtype;
begin
  if uid is null then raise exception 'connexion_requise' using errcode = '42501'; end if;
  select * into e from public.envois_devis where id = p_id;
  if found then
    if e.owner_id <> uid then raise exception 'non_autorise' using errcode = '42501'; end if;
    return to_jsonb(e);
  end if;
  if not exists (select 1 from public.devis d where d.id = p_devis_id and d.owner_id = uid and d.statut = 'finalise') then
    raise exception 'devis_non_finalise' using errcode = '23514'; end if;
  if p_nature = 'relance2' and not exists (select 1 from public.envois_devis x where x.devis_id = p_devis_id and x.nature = 'relance1') then
    raise exception 'relance1_requise' using errcode = '23514'; end if;
  if exists (select 1 from public.envois_devis x where x.devis_id = p_devis_id and x.nature = p_nature and p_nature in ('relance1', 'relance2')) then
    raise exception 'deja_relance' using errcode = '23505'; end if;
  insert into public.envois_devis(id, owner_id, devis_id, nature, canal, destinataire, sujet, avec_pdf, avec_lien)
  values (p_id, uid, p_devis_id, p_nature, p_canal, coalesce(btrim(p_destinataire), ''), coalesce(btrim(p_sujet), ''),
          coalesce(p_avec_pdf, false), coalesce(p_avec_lien, false))
  returning * into e;
  return to_jsonb(e);
end $$;
revoke all on function public.noter_envoi_devis(uuid, uuid, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.noter_envoi_devis(uuid, uuid, text, text, text, text, boolean, boolean) to authenticated;

commit;
