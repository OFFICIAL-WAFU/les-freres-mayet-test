-- À appliquer sur la base TEST uniquement. Archive séparée : aucun compteur métier modifié.
begin;
create table public.historiques_khosmos (
  owner_id uuid primary key references auth.users(id),
  contenu jsonb not null,
  created_at timestamptz not null default now(),
  constraint historique_objet check (jsonb_typeof(contenu) = 'object')
);
alter table public.historiques_khosmos enable row level security;
revoke all on public.historiques_khosmos from public, anon, authenticated;
grant select on public.historiques_khosmos to authenticated;
create policy historique_lecture_proprietaire on public.historiques_khosmos
  for select to authenticated using (owner_id = auth.uid());

create function public.lire_historique_khosmos() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select contenu from public.historiques_khosmos where owner_id = auth.uid();
$$;
revoke all on function public.lire_historique_khosmos() from public, anon;
grant execute on function public.lire_historique_khosmos() to authenticated;

create function public.enregistrer_historique_khosmos(p_analyse jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  proprietaire uuid := auth.uid(); existant jsonb; d jsonb; champ text; refs text[] := '{}';
begin
  if proprietaire is null then raise exception 'connexion_requise'; end if;
  if p_analyse is null or jsonb_typeof(p_analyse) <> 'object' then raise exception 'analyse_invalide'; end if;
  if jsonb_typeof(p_analyse->'documents') is distinct from 'array'
    or jsonb_typeof(p_analyse->'erreurs') is distinct from 'array'
    or jsonb_typeof(p_analyse->'annexes') is distinct from 'array'
    or jsonb_typeof(p_analyse->'copies') is distinct from 'array'
    or jsonb_typeof(p_analyse->'genereLe') is distinct from 'string' then raise exception 'analyse_invalide'; end if;
  if jsonb_array_length(p_analyse->'documents') not between 1 and 10000 or octet_length(p_analyse::text) > 31457280 then raise exception 'analyse_trop_volumineuse'; end if;
  for d in select value from jsonb_array_elements(p_analyse->'documents') loop
    if jsonb_typeof(d) <> 'object' or coalesce(d->>'ref','') !~ '^[FDA][0-9]{4}-[0-9]{5}$'
      or coalesce(d->>'type','') not in ('Devis','Facture','Acompte','Avoir')
      or d->>'ref' = any(refs) then raise exception 'document_invalide'; end if;
    refs := array_append(refs, d->>'ref');
    foreach champ in array array['ref','client','date','statut','echeance'] loop
      if jsonb_typeof(d->champ) is distinct from 'string' then raise exception 'document_invalide'; end if;
    end loop;
    foreach champ in array array['sources','liens','alertes','infos'] loop
      if jsonb_typeof(d->champ) is distinct from 'array' then raise exception 'document_invalide'; end if;
      if exists(select 1 from jsonb_array_elements(d->champ) x where jsonb_typeof(x.value) <> 'string') then raise exception 'document_invalide'; end if;
    end loop;
    foreach champ in array array['ht','tva','ttc','pdfHt','pdfTva','pdfTtc','net'] loop
      if jsonb_typeof(d->champ) = 'null' then continue; end if;
      if jsonb_typeof(d->champ) is distinct from 'number' then raise exception 'montant_invalide'; end if;
      if (d->>champ)::numeric <> trunc((d->>champ)::numeric) or abs((d->>champ)::numeric) > 9007199254740991 then raise exception 'montant_invalide'; end if;
    end loop;
  end loop;
  -- Même transaction : concurrence et reprise après coupure ne créent aucun doublon.
  insert into public.historiques_khosmos(owner_id,contenu) values(proprietaire,p_analyse)
    on conflict(owner_id) do nothing;
  select contenu into existant from public.historiques_khosmos where owner_id=proprietaire for update;
  if existant->'documents' <> p_analyse->'documents' then raise exception 'historique_different'; end if;
  return existant;
end;
$$;
revoke all on function public.enregistrer_historique_khosmos(jsonb) from public, anon;
grant execute on function public.enregistrer_historique_khosmos(jsonb) to authenticated;
commit;
