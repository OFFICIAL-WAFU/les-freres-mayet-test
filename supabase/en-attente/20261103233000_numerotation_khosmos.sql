-- Correctif de 20261103220000_accueil_donnees (03/11/2026) : la numérotation réelle de Khosmos, lue dans ses données,
-- est un simple numéro continu par type, sans année : Devis n°218, Facture n°111 (acomptes inclus), Avoir n°17.
-- Le nouveau logiciel continue cette série : n°219, n°112, n°18… et ne remet jamais le compteur à zéro au 1er janvier.
-- À appliquer APRÈS 20261103220000_accueil_donnees.
begin;

-- 1. Historique : numéros purement numériques, uniques par série (devis / factures+acomptes / avoirs).
alter table public.documents_importes
  drop constraint documents_importes_reference_check,
  drop constraint documents_importes_prefixe,
  drop constraint documents_importes_reference_unique,
  add constraint documents_importes_reference_numerique check (reference ~ '^[1-9][0-9]{0,8}$');
create function public.serie_document(p_type text) returns text
language sql immutable set search_path to '' as $$
  select case p_type when 'acompte' then 'facture' else p_type end
$$;
create unique index documents_importes_reference_unique on public.documents_importes(owner_id, public.serie_document(type), reference);

-- 2. Format : le numéro seul. Compteur unique (annee = 0), jamais remis à zéro.
create or replace function public.reference_document(p_prefixe text, p_annee integer, p_numero integer) returns text
language sql immutable set search_path to '' as $$
  select p_numero::text
$$;
do $$
declare r record; def text;
begin
  for r in select * from (values
    ('public.finaliser_devis(uuid,integer)', 'VALUES (uid, ''devis'', an, 1)', 'VALUES (uid, ''devis'', 0, 1)'),
    ('public.finaliser_facture(uuid,integer)', 'VALUES (uid, ''facture'', an, 1)', 'VALUES (uid, ''facture'', 0, 1)'),
    ('public.finaliser_avoir(uuid,integer)', 'VALUES (uid, ''avoir'', an, 1)', 'VALUES (uid, ''avoir'', 0, 1)')
  ) v(fonction, ancien, remplacement) loop
    def := pg_get_functiondef(r.fonction::regprocedure);
    if (length(def) - length(replace(def, r.ancien, ''))) / length(r.ancien) <> 1 then
      raise exception 'compteur_introuvable dans %', r.fonction; end if;
    execute replace(def, r.ancien, r.remplacement);
  end loop;
end $$;

-- 3. Un numéro de l'historique n'est jamais réattribué, dans la même série.
create or replace function public.reference_hors_historique() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare serie text := case tg_table_name when 'devis' then 'devis' when 'factures' then 'facture' else 'avoir' end;
begin
  if new.reference_definitive is not null and new.reference_definitive is distinct from old.reference_definitive
     and exists (select 1 from public.documents_importes d where d.owner_id = new.owner_id
                 and public.serie_document(d.type) = serie and d.reference = new.reference_definitive) then
    raise exception 'numero_deja_dans_historique' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function public.reference_hors_historique() from public, anon, authenticated;

-- 4. Calage : compteur continu (annee = 0) sur le plus grand numéro importé de chaque série, sans jamais reculer.
create or replace function public.caler_compteurs_historique(p_owner uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare resultat jsonb;
begin
  insert into public.compteurs_references(owner_id, type_document, annee, dernier)
  select p_owner, public.serie_document(type), 0, max(reference::integer)
  from public.documents_importes where owner_id = p_owner group by 2
  on conflict (owner_id, type_document, annee) do update
    set dernier = greatest(public.compteurs_references.dernier, excluded.dernier);
  select coalesce(jsonb_agg(jsonb_build_object('type', type_document, 'annee', annee, 'dernier', dernier) order by type_document, annee), '[]')
    into resultat from public.compteurs_references where owner_id = p_owner;
  return resultat;
end $$;
revoke all on function public.caler_compteurs_historique(uuid) from public, anon, authenticated;

commit;
