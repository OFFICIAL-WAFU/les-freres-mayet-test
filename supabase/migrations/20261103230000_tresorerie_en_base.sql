-- Trésorerie : charges et solde de départ conservés dans la base (et non plus dans le navigateur).
-- Une ligne par compte ; version incrémentée à chaque écriture (refus si un autre onglet a modifié entre-temps).
begin;
create table if not exists public.tresorerie_bibliotheques (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null check (version >= 1),
  donnees jsonb not null check (jsonb_typeof(donnees) = 'object'),
  maj_le timestamptz not null default now()
);
alter table public.tresorerie_bibliotheques enable row level security;
revoke all on public.tresorerie_bibliotheques from public, anon, authenticated;
grant select on public.tresorerie_bibliotheques to authenticated;
drop policy if exists tresorerie_lecture_proprietaire on public.tresorerie_bibliotheques;
create policy tresorerie_lecture_proprietaire on public.tresorerie_bibliotheques
  for select to authenticated using (owner_id = auth.uid());

create or replace function public.lire_tresorerie() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version', version, 'donnees', donnees)
  from public.tresorerie_bibliotheques where owner_id = auth.uid();
$$;
revoke all on function public.lire_tresorerie() from public, anon;
grant execute on function public.lire_tresorerie() to authenticated;

create or replace function public.modifier_tresorerie(p_version integer, p_donnees jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  proprietaire uuid := auth.uid();
  nouvelle integer;
begin
  if proprietaire is null then raise exception 'connexion_requise'; end if;
  if p_version is null or p_version < 0 then raise exception 'version_invalide'; end if;
  if p_donnees is null or jsonb_typeof(p_donnees) <> 'object'
    or jsonb_typeof(p_donnees->'charges') is distinct from 'array'
    or jsonb_array_length(p_donnees->'charges') > 2000
    or octet_length(p_donnees::text) > 2097152
    or (p_donnees ? 'solde' and jsonb_typeof(p_donnees->'solde') <> 'object') then
    raise exception 'donnees_invalides';
  end if;
  if p_version = 0 then
    insert into public.tresorerie_bibliotheques(owner_id, version, donnees)
    values (proprietaire, 1, p_donnees)
    on conflict (owner_id) do nothing
    returning version into nouvelle;
  else
    update public.tresorerie_bibliotheques
       set version = version + 1, donnees = p_donnees, maj_le = now()
     where owner_id = proprietaire and version = p_version
    returning version into nouvelle;
  end if;
  if nouvelle is null then raise exception 'conflit_version'; end if;
  return jsonb_build_object('version', nouvelle, 'donnees', p_donnees);
end;
$$;
revoke all on function public.modifier_tresorerie(integer, jsonb) from public, anon;
grant execute on function public.modifier_tresorerie(integer, jsonb) to authenticated;
commit;
