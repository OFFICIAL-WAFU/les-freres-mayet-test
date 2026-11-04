-- Historique Khosmos recréé en vrais documents (devis, factures, acomptes, avoirs, règlements).
--
-- 1. Les documents repris portent un lot_import : il ne peut être posé que par l'outil de reprise
--    (exécuté en mode réplica, triggers suspendus), jamais par l'application.
-- 2. Réponse du client sur un devis finalisé : attente / accepté / refusé, enregistrée en base
--    (et non plus seulement sur l'appareil). « Expiré » se déduit de la date de validité.
-- 3. Un devis repris peut avoir eu deux acomptes ou deux factures dans Khosmos (l'un annulé par avoir) :
--    l'unicité devis/nature ne s'applique qu'aux documents créés dans l'application, et les recherches
--    de « l'acompte du devis » ignorent les acomptes annulés par un avoir total.

begin;

alter table public.devis      add column if not exists lot_import uuid references public.lots_import(id);
alter table public.factures   add column if not exists lot_import uuid references public.lots_import(id);
alter table public.avoirs     add column if not exists lot_import uuid references public.lots_import(id);
alter table public.reglements add column if not exists lot_import uuid references public.lots_import(id);

create or replace function public.lot_import_reserve() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if (tg_op = 'INSERT' and new.lot_import is not null)
     or (tg_op = 'UPDATE' and new.lot_import is distinct from old.lot_import) then
    raise exception 'lot_import_reserve' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists devis_lot_import_reserve on public.devis;
create trigger devis_lot_import_reserve before insert or update on public.devis for each row execute function public.lot_import_reserve();
drop trigger if exists factures_lot_import_reserve on public.factures;
create trigger factures_lot_import_reserve before insert or update on public.factures for each row execute function public.lot_import_reserve();
drop trigger if exists avoirs_lot_import_reserve on public.avoirs;
create trigger avoirs_lot_import_reserve before insert or update on public.avoirs for each row execute function public.lot_import_reserve();
drop trigger if exists reglements_lot_import_reserve on public.reglements;
create trigger reglements_lot_import_reserve before insert or update on public.reglements for each row execute function public.lot_import_reserve();

-- Réponse du client -----------------------------------------------------------
alter table public.devis add column if not exists reponse_client text not null default 'attente';
alter table public.devis add column if not exists reponse_le date;
alter table public.devis add column if not exists reponse_mode text;
alter table public.devis drop constraint if exists devis_reponse_client_check;
alter table public.devis add constraint devis_reponse_client_check check (reponse_client in ('attente','accepte','refuse'));
alter table public.devis drop constraint if exists devis_reponse_mode_check;
alter table public.devis add constraint devis_reponse_mode_check check (reponse_mode is null or reponse_mode in ('signature_distante','signature_khosmos','manuelle'));
alter table public.devis drop constraint if exists devis_reponse_coherente;
alter table public.devis add constraint devis_reponse_coherente check (reponse_client = 'attente' or statut = 'finalise');

-- Acompte annulé : avoir total finalisé, ou avoirs finalisés couvrant tout le TTC.
create or replace function public.facture_annulee(p_id uuid) returns boolean
language sql stable set search_path to 'public' as $$
  select exists (select 1 from public.avoirs a where a.facture_source_id = p_id and a.statut = 'finalise' and a.type_avoir = 'total')
      or coalesce((select sum(a.total_ttc_centimes) from public.avoirs a where a.facture_source_id = p_id and a.statut = 'finalise'), 0)
         >= (select f.total_ttc_centimes from public.factures f where f.id = p_id) and exists (select 1 from public.avoirs a where a.facture_source_id = p_id and a.statut = 'finalise');
$$;

alter table public.factures drop constraint if exists factures_un_par_devis_et_nature;
drop index if exists public.factures_un_par_devis_et_nature;
create unique index factures_un_par_devis_et_nature on public.factures (devis_source_id, nature) where lot_import is null;

-- Corrections ciblées de fonctions existantes (texte vérifié : chaque remplacement doit trouver
-- exactement une occurrence, sinon la migration échoue sans rien changer).
do $$
declare
  r record; def text; n int;
  sfx constant text := ' AND NOT public.facture_annulee(id) ORDER BY created_at DESC LIMIT 1';
begin
  for r in select * from (values
    ('deduction_live',
     $a$WHERE devis_source_id = f.devis_source_id AND nature = 'acompte' AND owner_id = f.owner_id;$a$,
     $a$WHERE devis_source_id = f.devis_source_id AND nature = 'acompte' AND owner_id = f.owner_id$a$ || sfx || ';'),
    ('facture_garde_nature',
     $a$SELECT * INTO a FROM public.factures WHERE devis_source_id = NEW.devis_source_id AND nature = 'acompte';$a$,
     $a$SELECT * INTO a FROM public.factures WHERE devis_source_id = NEW.devis_source_id AND nature = 'acompte'$a$ || sfx || ';'),
    ('finaliser_facture',
     $a$WHERE devis_source_id = f.devis_source_id AND nature = 'acompte' AND owner_id = uid FOR SHARE;$a$,
     $a$WHERE devis_source_id = f.devis_source_id AND nature = 'acompte' AND owner_id = uid$a$ || sfx || ' FOR SHARE;'),
    ('preparer_acompte',
     $a$SELECT id INTO fid FROM public.factures WHERE devis_source_id = p_devis_id AND nature = 'acompte';$a$,
     $a$SELECT id INTO fid FROM public.factures WHERE devis_source_id = p_devis_id AND nature = 'acompte'$a$ || sfx || ';'),
    ('devis_verrouiller',
     $a$  IF OLD.statut = 'finalise' THEN RAISE EXCEPTION 'devis_finalise_verrouille' USING ERRCODE = '42501'; END IF;$a$,
     $a$  IF OLD.statut = 'finalise' THEN
    IF current_setting('app.reponse_devis', true) = NEW.id::text
       AND (to_jsonb(NEW) - ARRAY['reponse_client','reponse_le','reponse_mode','updated_at'])
         = (to_jsonb(OLD) - ARRAY['reponse_client','reponse_le','reponse_mode','updated_at']) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'devis_finalise_verrouille' USING ERRCODE = '42501';
  END IF;$a$)
  ) as t(fn, avant, apres)
  loop
    select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.fn;
    if def is null then raise exception 'fonction absente : %', r.fn; end if;
    if position(r.apres in def) > 0 then continue; end if; -- déjà appliqué
    n := (length(def) - length(replace(def, r.avant, ''))) / length(r.avant);
    if n <> 1 then raise exception 'fonction % : % occurrence(s) du texte attendu', r.fn, n; end if;
    execute replace(def, r.avant, r.apres);
  end loop;
end $$;

-- Noter la réponse du client sur un devis finalisé.
create or replace function public.noter_reponse_devis(p_id uuid, p_reponse text, p_date date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); d public.devis%rowtype;
begin
  if uid is null then raise exception 'non_authentifie' using errcode = '42501'; end if;
  if p_reponse not in ('attente','accepte','refuse') then raise exception 'reponse_invalide' using errcode = '22023'; end if;
  select * into d from public.devis where id = p_id and owner_id = uid for update;
  if not found then raise exception 'introuvable' using errcode = 'P0002'; end if;
  if d.statut <> 'finalise' then raise exception 'devis_non_finalise' using errcode = '23514'; end if;
  if d.reponse_mode in ('signature_distante','signature_khosmos') and p_reponse <> 'accepte' then
    raise exception 'devis_signe' using errcode = '23514';
  end if;
  perform set_config('app.reponse_devis', p_id::text, true);
  update public.devis set reponse_client = p_reponse,
    reponse_le = case when p_reponse = 'attente' then null else coalesce(p_date, (now() at time zone 'Europe/Paris')::date) end,
    reponse_mode = case when p_reponse = 'attente' then null when d.reponse_mode in ('signature_distante','signature_khosmos') then d.reponse_mode else 'manuelle' end
  where id = p_id;
  perform set_config('app.reponse_devis', '', true);
  return jsonb_build_object('id', p_id, 'reponse_client', p_reponse);
end $$;
revoke all on function public.noter_reponse_devis(uuid, text, date) from public, anon;
grant execute on function public.noter_reponse_devis(uuid, text, date) to authenticated;

-- Une signature à distance marque le devis comme accepté.
create or replace function public.signature_vers_reponse() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.signe_le is not null and old.signe_le is null then
    perform set_config('app.reponse_devis', new.devis_id::text, true);
    update public.devis set reponse_client = 'accepte', reponse_le = (new.signe_le at time zone 'Europe/Paris')::date, reponse_mode = 'signature_distante'
      where id = new.devis_id and statut = 'finalise';
    perform set_config('app.reponse_devis', '', true);
  end if;
  return new;
end $$;
drop trigger if exists signatures_vers_reponse on public.signatures_devis;
create trigger signatures_vers_reponse after update on public.signatures_devis for each row execute function public.signature_vers_reponse();

-- Devis déjà signés à distance avant cette migration.
do $$
declare s record;
begin
  for s in select distinct on (devis_id) devis_id, signe_le from public.signatures_devis where signe_le is not null order by devis_id, signe_le loop
    perform set_config('app.reponse_devis', s.devis_id::text, true);
    update public.devis set reponse_client = 'accepte', reponse_le = (s.signe_le at time zone 'Europe/Paris')::date, reponse_mode = 'signature_distante'
      where id = s.devis_id and statut = 'finalise';
  end loop;
  perform set_config('app.reponse_devis', '', true);
end $$;

commit;
