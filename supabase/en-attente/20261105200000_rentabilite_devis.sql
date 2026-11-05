-- Rentabilité des devis (décision de Baptiste, 05/11/2026) : sur chaque ligne de devis, prix d'achat, coefficient matériel,
-- temps de pose et taux horaire vendu, plus le coût horaire réel au moment de la saisie. Ce sont des informations INTERNES :
-- elles ne changent ni le prix de vente enregistré (prix_ht_centimes reste la seule source des montants), ni les totaux,
-- ni la projection publique de signature (signature_projection liste ses champs), ni les verrous des devis finalisés.
-- Toutes les colonnes sont facultatives : une ligne sans coût (reprise Khosmos, ancienne ligne) reste « coût à renseigner ».
-- Réglages par défaut (habitudes_documents) : coefficient matériel 1,6 ; coût horaire réel 25 € ; taux horaire vendu 50 €.
begin;

alter table public.habitudes_documents
  add column coef_materiel_milliemes integer not null default 1600 check (coef_materiel_milliemes between 0 and 100000),
  add column cout_horaire_centimes bigint not null default 2500 check (cout_horaire_centimes between 0 and 10000000),
  add column taux_horaire_centimes bigint not null default 5000 check (taux_horaire_centimes between 0 and 10000000);

alter table public.devis_lignes
  add column prix_achat_centimes bigint check (prix_achat_centimes between 0 and 100000000000),
  add column coef_materiel_milliemes integer check (coef_materiel_milliemes between 0 and 100000),
  add column temps_pose_minutes integer check (temps_pose_minutes between 0 and 1000000),
  add column taux_horaire_centimes bigint check (taux_horaire_centimes between 0 and 10000000),
  add column cout_horaire_centimes bigint check (cout_horaire_centimes between 0 and 10000000),
  add column prix_calcule boolean not null default false;

-- Même fonction qu'avant, avec les six colonnes internes en plus (absentes du JSON = NULL / false : rétrocompatible).
create or replace function public.enregistrer_brouillon(p_id uuid, p_version integer, p jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
DECLARE
  uid uuid := auth.uid();
  existant public.devis%ROWTYPE;
  v_attendue integer := p_version;
  n integer;
  l jsonb;
  i integer := 0;
  t_ht bigint := 0; t_tva bigint := 0;
  vent jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p->'lignes') <> 'array' OR jsonb_array_length(p->'lignes') = 0 THEN
    RAISE EXCEPTION 'lignes_requises' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO existant FROM public.devis WHERE id = p_id FOR UPDATE;

  IF v_attendue IS NULL THEN
    IF FOUND THEN
      IF existant.version <> 1 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
      v_attendue := 1;
    ELSE
      INSERT INTO public.compteurs_devis(owner_id, dernier) VALUES (uid, 1)
        ON CONFLICT (owner_id) DO UPDATE SET dernier = public.compteurs_devis.dernier + 1
        RETURNING dernier INTO n;
      INSERT INTO public.devis(id, owner_id, reference, client_id, client_copie, objet, date_devis, date_validite, remarques, notes, conditions_paiement)
      VALUES (p_id, uid, 'BROUILLON-' || lpad(n::text, 3, '0'), (p->>'client_id')::uuid, p->'client_copie',
              p->>'objet', (p->>'date_devis')::date, NULLIF(p->>'date_validite','')::date,
              COALESCE(p->>'remarques',''), COALESCE(p->>'notes',''), COALESCE(p->>'conditions_paiement',''));
    END IF;
  ELSE
    IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
    IF existant.version <> v_attendue THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  END IF;

  IF v_attendue IS NOT NULL THEN
    UPDATE public.devis SET client_id = (p->>'client_id')::uuid, client_copie = p->'client_copie',
      objet = p->>'objet', date_devis = (p->>'date_devis')::date, date_validite = NULLIF(p->>'date_validite','')::date,
      remarques = COALESCE(p->>'remarques',''), conditions_paiement = COALESCE(p->>'conditions_paiement',''), notes = COALESCE(p->>'notes',''), version = version + 1
    WHERE id = p_id AND version = v_attendue;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
    DELETE FROM public.devis_lignes WHERE devis_id = p_id
      AND id NOT IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p->'lignes') x);
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p->'lignes') LOOP
    INSERT INTO public.devis_lignes(id, owner_id, devis_id, position, type, article_id, reference, designation, description,
      unite, quantite_milliemes, prix_ht_centimes, taux_tva_milliemes, ht_centimes, tva_centimes, ttc_centimes,
      prix_achat_centimes, coef_materiel_milliemes, temps_pose_minutes, taux_horaire_centimes, cout_horaire_centimes, prix_calcule)
    VALUES ((l->>'id')::uuid, uid, p_id, i, l->>'type', NULLIF(l->>'article_id','')::uuid, COALESCE(l->>'reference',''),
      l->>'designation', COALESCE(l->>'description',''), l->>'unite', (l->>'quantite_milliemes')::bigint,
      (l->>'prix_ht_centimes')::bigint, (l->>'taux_tva_milliemes')::integer, 0, 0, 0,
      NULLIF(l->>'prix_achat_centimes','')::bigint, NULLIF(l->>'coef_materiel_milliemes','')::integer,
      NULLIF(l->>'temps_pose_minutes','')::integer, NULLIF(l->>'taux_horaire_centimes','')::bigint,
      NULLIF(l->>'cout_horaire_centimes','')::bigint, COALESCE((l->>'prix_calcule')::boolean, false))
    ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, type = EXCLUDED.type, article_id = EXCLUDED.article_id,
      reference = EXCLUDED.reference, designation = EXCLUDED.designation, description = EXCLUDED.description,
      unite = EXCLUDED.unite, quantite_milliemes = EXCLUDED.quantite_milliemes, prix_ht_centimes = EXCLUDED.prix_ht_centimes,
      taux_tva_milliemes = EXCLUDED.taux_tva_milliemes,
      prix_achat_centimes = EXCLUDED.prix_achat_centimes, coef_materiel_milliemes = EXCLUDED.coef_materiel_milliemes,
      temps_pose_minutes = EXCLUDED.temps_pose_minutes, taux_horaire_centimes = EXCLUDED.taux_horaire_centimes,
      cout_horaire_centimes = EXCLUDED.cout_horaire_centimes, prix_calcule = EXCLUDED.prix_calcule
    WHERE public.devis_lignes.devis_id = EXCLUDED.devis_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'ligne_non_autorisee' USING ERRCODE = '42501'; END IF;
    i := i + 1;
  END LOOP;

  SELECT COALESCE(sum(ht_centimes),0), COALESCE(sum(tva_centimes),0) INTO t_ht, t_tva FROM public.devis_lignes WHERE devis_id = p_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taux', taux, 'base', base, 'tva', tva) ORDER BY taux), '[]'::jsonb) INTO vent FROM (
    SELECT taux_tva_milliemes AS taux, sum(ht_centimes) AS base, sum(tva_centimes) AS tva
    FROM public.devis_lignes WHERE devis_id = p_id GROUP BY taux_tva_milliemes) s;
  UPDATE public.devis SET total_ht_centimes = t_ht, total_tva_centimes = t_tva, total_ttc_centimes = t_ht + t_tva,
    ventilation_tva = vent WHERE id = p_id;

  RETURN public.lire_devis(p_id);
END $function$;

commit;
