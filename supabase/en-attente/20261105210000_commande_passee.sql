-- Suivi des devis : étape « Commande passée » après la signature (matériel commandé).
-- La date se note avec noter_commande_devis ; elle n'existe que pour un devis signé et disparaît s'il redevient
-- « en attente » ou passe « refusé ». Seuls les champs de réponse et de commande restent modifiables sur un devis finalisé.

begin;

alter table public.devis add column if not exists commande_passee_le date;
alter table public.devis drop constraint if exists devis_commande_apres_signature;
alter table public.devis add constraint devis_commande_apres_signature check (commande_passee_le is null or reponse_client = 'accepte');

-- Le verrou des devis finalisés laisse aussi passer la date de commande (même réglage app.reponse_devis).
do $$
declare def text; avant constant text := $a$ARRAY['reponse_client','reponse_le','reponse_mode','updated_at']$a$;
  apres constant text := $a$ARRAY['reponse_client','reponse_le','reponse_mode','commande_passee_le','updated_at']$a$;
begin
  select pg_get_functiondef('public.devis_verrouiller()'::regprocedure) into def;
  if position(apres in def) > 0 then return; end if;
  if (length(def) - length(replace(def, avant, ''))) / length(avant) <> 2 then raise exception 'devis_verrouiller : texte attendu absent'; end if;
  execute replace(def, avant, apres);
end $$;

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
    reponse_le = case when p_reponse = 'attente' then null
                      when p_reponse = d.reponse_client and p_date is null then d.reponse_le
                      else coalesce(p_date, (now() at time zone 'Europe/Paris')::date) end,
    reponse_mode = case when p_reponse = 'attente' then null when d.reponse_mode in ('signature_distante','signature_khosmos') then d.reponse_mode else 'manuelle' end,
    commande_passee_le = case when p_reponse = 'accepte' then d.commande_passee_le else null end
  where id = p_id;
  perform set_config('app.reponse_devis', '', true);
  return jsonb_build_object('id', p_id, 'reponse_client', p_reponse);
end $$;

-- p_date null : la commande n'est plus notée comme passée.
create or replace function public.noter_commande_devis(p_id uuid, p_date date)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); d public.devis%rowtype;
begin
  if uid is null then raise exception 'non_authentifie' using errcode = '42501'; end if;
  select * into d from public.devis where id = p_id and owner_id = uid for update;
  if not found then raise exception 'introuvable' using errcode = 'P0002'; end if;
  if p_date is not null and (d.statut <> 'finalise' or d.reponse_client <> 'accepte') then
    raise exception 'devis_non_signe' using errcode = '23514';
  end if;
  perform set_config('app.reponse_devis', p_id::text, true);
  update public.devis set commande_passee_le = p_date where id = p_id;
  perform set_config('app.reponse_devis', '', true);
  return jsonb_build_object('id', p_id, 'commande_passee_le', p_date);
end $$;
revoke all on function public.noter_commande_devis(uuid, date) from public, anon;
grant execute on function public.noter_commande_devis(uuid, date) to authenticated;

commit;
