-- Conflit de version : code PT409 (HTTP 409) au lieu de 40001, que l'API réessaie indéfiniment.
CREATE OR REPLACE FUNCTION public.enregistrer_brouillon(p_id uuid, p_version integer, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.devis(id, owner_id, reference, client_id, client_copie, objet, date_devis, date_validite, remarques, notes)
      VALUES (p_id, uid, 'BROUILLON-' || lpad(n::text, 3, '0'), (p->>'client_id')::uuid, p->'client_copie',
              p->>'objet', (p->>'date_devis')::date, NULLIF(p->>'date_validite','')::date,
              COALESCE(p->>'remarques',''), COALESCE(p->>'notes',''));
    END IF;
  ELSE
    IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
    IF existant.version <> v_attendue THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  END IF;

  IF v_attendue IS NOT NULL THEN
    UPDATE public.devis SET client_id = (p->>'client_id')::uuid, client_copie = p->'client_copie',
      objet = p->>'objet', date_devis = (p->>'date_devis')::date, date_validite = NULLIF(p->>'date_validite','')::date,
      remarques = COALESCE(p->>'remarques',''), notes = COALESCE(p->>'notes',''), version = version + 1
    WHERE id = p_id AND version = v_attendue;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
    DELETE FROM public.devis_lignes WHERE devis_id = p_id
      AND id NOT IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p->'lignes') x);
  END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p->'lignes') LOOP
    INSERT INTO public.devis_lignes(id, owner_id, devis_id, position, type, article_id, reference, designation, description,
      unite, quantite_milliemes, prix_ht_centimes, taux_tva_milliemes, ht_centimes, tva_centimes, ttc_centimes)
    VALUES ((l->>'id')::uuid, uid, p_id, i, l->>'type', NULLIF(l->>'article_id','')::uuid, COALESCE(l->>'reference',''),
      l->>'designation', COALESCE(l->>'description',''), l->>'unite', (l->>'quantite_milliemes')::bigint,
      (l->>'prix_ht_centimes')::bigint, (l->>'taux_tva_milliemes')::integer, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, type = EXCLUDED.type, article_id = EXCLUDED.article_id,
      reference = EXCLUDED.reference, designation = EXCLUDED.designation, description = EXCLUDED.description,
      unite = EXCLUDED.unite, quantite_milliemes = EXCLUDED.quantite_milliemes, prix_ht_centimes = EXCLUDED.prix_ht_centimes,
      taux_tva_milliemes = EXCLUDED.taux_tva_milliemes
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

CREATE OR REPLACE FUNCTION public.finaliser_devis(p_id uuid, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  d public.devis%ROWTYPE;
  e public.entreprises%ROWTYPE;
  manque text[] := '{}';
  n integer; an integer; s_ht bigint; s_tva bigint; nb integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.devis WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF d.statut = 'finalise' THEN RETURN public.lire_devis(p_id); END IF;
  IF d.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;

  SELECT * INTO e FROM public.entreprises WHERE owner_id = uid;
  IF NOT FOUND THEN manque := manque || 'fiche_entreprise'::text;
  ELSE
    IF btrim(e.raison_sociale) = '' THEN manque := manque || 'raison_sociale_entreprise'::text; END IF;
    IF btrim(e.adresse) = '' OR btrim(e.code_postal) = '' OR btrim(e.ville) = '' THEN manque := manque || 'adresse_entreprise'::text; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = d.client_id AND c.owner_id = uid) THEN manque := manque || 'client'::text; END IF;
  IF COALESCE(btrim(d.client_copie->>'nom'),'') = '' THEN manque := manque || 'nom_client'::text; END IF;
  IF jsonb_typeof(d.client_copie->'adresse') IS DISTINCT FROM 'array' OR jsonb_array_length(d.client_copie->'adresse') = 0 THEN
    manque := manque || 'adresse_client'::text; END IF;
  IF btrim(d.objet) = '' THEN manque := manque || 'objet'::text; END IF;
  SELECT count(*), COALESCE(sum(ht_centimes),0), COALESCE(sum(tva_centimes),0) INTO nb, s_ht, s_tva FROM public.devis_lignes WHERE devis_id = p_id;
  IF nb = 0 THEN manque := manque || 'lignes'::text; END IF;
  IF array_length(manque, 1) > 0 THEN
    RAISE EXCEPTION 'incomplet:%', array_to_string(manque, ',') USING ERRCODE = '23514';
  END IF;
  IF s_ht <> d.total_ht_centimes OR s_tva <> d.total_tva_centimes OR d.total_ttc_centimes <> s_ht + s_tva THEN
    RAISE EXCEPTION 'montants_incoherents' USING ERRCODE = '23514';
  END IF;

  an := extract(year FROM (now() AT TIME ZONE 'Europe/Paris'))::integer;
  INSERT INTO public.compteurs_references(owner_id, type_document, annee, dernier) VALUES (uid, 'devis', an, 1)
    ON CONFLICT (owner_id, type_document, annee) DO UPDATE SET dernier = public.compteurs_references.dernier + 1
    RETURNING dernier INTO n;

  PERFORM set_config('app.finalisation', p_id::text, true);
  UPDATE public.devis SET statut = 'finalise',
    reference_definitive = 'DEV-LFM-' || an || '-' || lpad(n::text, 5, '0'),
    finalise_le = now(), finalise_par = uid,
    entreprise_copie = to_jsonb(e) - 'id' - 'owner_id' - 'created_at' - 'updated_at',
    version = version + 1
  WHERE id = p_id AND version = p_version;
  PERFORM set_config('app.finalisation', '', true);
  RETURN public.lire_devis(p_id);
END $function$;

CREATE OR REPLACE FUNCTION public.enregistrer_facture(p_id uuid, p_version integer, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  f public.factures%ROWTYPE;
  n integer; l jsonb; i integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p->'lignes') <> 'array' OR jsonb_array_length(p->'lignes') = 0 THEN
    RAISE EXCEPTION 'lignes_requises' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_id AND owner_id = uid AND nature = 'facture' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF f.statut <> 'brouillon' THEN RAISE EXCEPTION 'facture_verrouillee' USING ERRCODE = '42501'; END IF;
  IF f.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;

  UPDATE public.factures SET objet = p->>'objet', date_facture = (p->>'date_facture')::date,
    date_echeance = NULLIF(p->>'date_echeance','')::date, remarques = COALESCE(p->>'remarques',''),
    notes = COALESCE(p->>'notes',''), version = version + 1
  WHERE id = p_id AND version = p_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;

  DELETE FROM public.factures_lignes WHERE facture_id = p_id
    AND id NOT IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p->'lignes') x);
  FOR l IN SELECT * FROM jsonb_array_elements(p->'lignes') LOOP
    INSERT INTO public.factures_lignes(id, owner_id, facture_id, position, type, article_id, reference, designation, description,
      unite, quantite_milliemes, prix_ht_centimes, taux_tva_milliemes, ht_centimes, tva_centimes, ttc_centimes)
    VALUES ((l->>'id')::uuid, uid, p_id, i, l->>'type', NULLIF(l->>'article_id','')::uuid, COALESCE(l->>'reference',''),
      l->>'designation', COALESCE(l->>'description',''), l->>'unite', (l->>'quantite_milliemes')::bigint,
      (l->>'prix_ht_centimes')::bigint, (l->>'taux_tva_milliemes')::integer, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, type = EXCLUDED.type, article_id = EXCLUDED.article_id,
      reference = EXCLUDED.reference, designation = EXCLUDED.designation, description = EXCLUDED.description,
      unite = EXCLUDED.unite, quantite_milliemes = EXCLUDED.quantite_milliemes, prix_ht_centimes = EXCLUDED.prix_ht_centimes,
      taux_tva_milliemes = EXCLUDED.taux_tva_milliemes
    WHERE public.factures_lignes.facture_id = EXCLUDED.facture_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'ligne_non_autorisee' USING ERRCODE = '42501'; END IF;
    i := i + 1;
  END LOOP;
  PERFORM public.facture_recalculer(p_id);
  RETURN public.lire_facture(p_id);
END $function$;

CREATE OR REPLACE FUNCTION public.finaliser_facture(p_id uuid, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  f public.factures%ROWTYPE;
  e public.entreprises%ROWTYPE;
  manque text[] := '{}';
  n integer; an integer; s_ht bigint; s_tva bigint; nb integer; nb_invalides integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF f.statut = 'finalise' THEN RETURN public.lire_facture(p_id); END IF;
  IF f.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;

  SELECT * INTO e FROM public.entreprises WHERE owner_id = uid;
  IF NOT FOUND THEN manque := manque || 'fiche_entreprise'::text;
  ELSE
    IF btrim(e.raison_sociale) = '' THEN manque := manque || 'raison_sociale_entreprise'::text; END IF;
    IF btrim(e.adresse) = '' OR btrim(e.code_postal) = '' OR btrim(e.ville) = '' THEN manque := manque || 'adresse_entreprise'::text; END IF;
  END IF;
  IF COALESCE(btrim(f.client_copie->>'nom'),'') = '' THEN manque := manque || 'nom_client'::text; END IF;
  IF jsonb_typeof(f.client_copie->'adresse') IS DISTINCT FROM 'array' OR jsonb_array_length(f.client_copie->'adresse') = 0 THEN
    manque := manque || 'adresse_client'::text; END IF;
  IF btrim(f.objet) = '' THEN manque := manque || 'objet'::text; END IF;
  SELECT count(*), COALESCE(sum(ht_centimes),0), COALESCE(sum(tva_centimes),0),
    count(*) FILTER (WHERE ht_centimes <> (quantite_milliemes * prix_ht_centimes * 2 + 1000) / 2000
      OR tva_centimes <> (ht_centimes * taux_tva_milliemes * 2 + 1000) / 2000 OR ttc_centimes <> ht_centimes + tva_centimes)
    INTO nb, s_ht, s_tva, nb_invalides FROM public.factures_lignes WHERE facture_id = p_id;
  IF nb = 0 THEN manque := manque || 'lignes'::text; END IF;
  IF array_length(manque, 1) > 0 THEN
    RAISE EXCEPTION 'incomplet:%', array_to_string(manque, ',') USING ERRCODE = '23514';
  END IF;
  IF nb_invalides > 0 OR s_ht <> f.total_ht_centimes OR s_tva <> f.total_tva_centimes OR f.total_ttc_centimes <> s_ht + s_tva THEN
    RAISE EXCEPTION 'montants_incoherents' USING ERRCODE = '23514';
  END IF;

  an := extract(year FROM (now() AT TIME ZONE 'Europe/Paris'))::integer;
  INSERT INTO public.compteurs_references(owner_id, type_document, annee, dernier) VALUES (uid, 'facture', an, 1)
    ON CONFLICT (owner_id, type_document, annee) DO UPDATE SET dernier = public.compteurs_references.dernier + 1
    RETURNING dernier INTO n;

  PERFORM set_config('app.finalisation_facture', p_id::text, true);
  UPDATE public.factures SET statut = 'finalise',
    reference_definitive = 'FAC-LFM-' || an || '-' || lpad(n::text, 5, '0'),
    finalise_le = now(), finalise_par = uid,
    entreprise_copie = to_jsonb(e) - 'id' - 'owner_id' - 'created_at' - 'updated_at',
    version = version + 1
  WHERE id = p_id AND version = p_version;
  PERFORM set_config('app.finalisation_facture', '', true);
  RETURN public.lire_facture(p_id);
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_acompte(p_id uuid, p_version integer, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; pct numeric; calc jsonb; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_id AND owner_id = uid AND nature = 'acompte' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF f.statut <> 'brouillon' THEN RAISE EXCEPTION 'facture_verrouillee' USING ERRCODE = '42501'; END IF;
  IF f.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  pct := (p->>'pourcentage')::numeric;
  calc := public.acompte_calcul(f.devis_source_id, pct);
  PERFORM set_config('app.acompte_ecriture', p_id::text, true);
  UPDATE public.factures SET pourcentage = pct, date_facture = (p->>'date_facture')::date,
    date_echeance = NULLIF(p->>'date_echeance','')::date, remarques = COALESCE(p->>'remarques',''),
    notes = COALESCE(p->>'notes',''), version = version + 1
  WHERE id = p_id AND version = p_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  PERFORM public.acompte_ecrire_lignes(p_id, f.devis_source_reference, calc, pct);
  RETURN public.lire_facture(p_id);
END $$;