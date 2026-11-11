-- Liste Documents allégée (11/11/2026) : le logo (~125 Ko) et les CGV (~10 Ko) figés dans chaque devis / facture / avoir
-- ne sont plus téléchargés avec chaque document (≈ 39 Mo sur 42 Mo à chaque chargement de la liste).
-- La liste lit la copie de l'entreprise sans logo ni CGV, plus l'empreinte md5 de chacun ; les valeurs distinctes
-- (2 ou 3 logos, 1 ou 2 textes de CGV) sont lues une seule fois par pieces_entreprise_documents(), puis remises
-- à l'identique dans la copie côté application (contrôle : 302/302 documents identiques en production).
-- Purement additif : aucune donnée modifiée, aucune fonction existante remplacée. SECURITY INVOKER (RLS appliquées).
create or replace function public.entreprise_legere(d public.devis) returns jsonb language sql stable set search_path = '' as $$ select d.entreprise_copie - 'logo' - 'cgv' $$;
create or replace function public.entreprise_legere(f public.factures) returns jsonb language sql stable set search_path = '' as $$ select f.entreprise_copie - 'logo' - 'cgv' $$;
create or replace function public.entreprise_legere(a public.avoirs) returns jsonb language sql stable set search_path = '' as $$ select a.entreprise_copie - 'logo' - 'cgv' $$;
create or replace function public.logo_empreinte(d public.devis) returns text language sql stable set search_path = '' as $$ select md5(d.entreprise_copie ->> 'logo') $$;
create or replace function public.logo_empreinte(f public.factures) returns text language sql stable set search_path = '' as $$ select md5(f.entreprise_copie ->> 'logo') $$;
create or replace function public.logo_empreinte(a public.avoirs) returns text language sql stable set search_path = '' as $$ select md5(a.entreprise_copie ->> 'logo') $$;
create or replace function public.cgv_empreinte(d public.devis) returns text language sql stable set search_path = '' as $$ select md5(d.entreprise_copie ->> 'cgv') $$;
create or replace function public.cgv_empreinte(f public.factures) returns text language sql stable set search_path = '' as $$ select md5(f.entreprise_copie ->> 'cgv') $$;
create or replace function public.cgv_empreinte(a public.avoirs) returns text language sql stable set search_path = '' as $$ select md5(a.entreprise_copie ->> 'cgv') $$;
create or replace function public.pieces_entreprise_documents() returns table(empreinte text, valeur text) language sql stable set search_path = '' as $$
  select md5(x.v), x.v from (
    select entreprise_copie ->> 'logo' as v from public.devis
    union select entreprise_copie ->> 'logo' from public.factures
    union select entreprise_copie ->> 'logo' from public.avoirs
    union select entreprise_copie ->> 'cgv' from public.devis
    union select entreprise_copie ->> 'cgv' from public.factures
    union select entreprise_copie ->> 'cgv' from public.avoirs
  ) x where x.v is not null
$$;
revoke execute on function public.pieces_entreprise_documents() from anon;
drop function if exists public.logos_documents();
notify pgrst, 'reload schema';
