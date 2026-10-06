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
  IF f.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;

  UPDATE public.factures SET objet = p->>'objet', date_facture = (p->>'date_facture')::date,
    date_echeance = NULLIF(p->>'date_echeance','')::date, remarques = COALESCE(p->>'remarques',''),
    notes = COALESCE(p->>'notes',''), version = version + 1
  WHERE id = p_id AND version = p_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;

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

-- Lignes et pourcentage d'un acompte : écrits uniquement par les fonctions d'acompte.
CREATE OR REPLACE FUNCTION public.factures_lignes_verrouiller() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE fid uuid := COALESCE(NEW.facture_id, OLD.facture_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.factures f WHERE f.id = fid AND f.statut <> 'brouillon') THEN
    RAISE EXCEPTION 'facture_finalisee_verrouillee' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.factures f WHERE f.id = fid AND f.nature = 'acompte')
     AND current_setting('app.acompte_ecriture', true) IS DISTINCT FROM fid::text THEN
    RAISE EXCEPTION 'lignes_acompte_calculees' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.facture_garde_nature() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.nature = 'acompte' AND NEW.pourcentage IS DISTINCT FROM OLD.pourcentage
     AND current_setting('app.acompte_ecriture', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'pourcentage_via_enregistrement' USING ERRCODE = '42501';
  END IF;
  IF NEW.statut = 'finalise' AND OLD.statut = 'brouillon' THEN
    IF NEW.nature = 'acompte' THEN RAISE EXCEPTION 'finalisation_acompte_indisponible' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.factures a WHERE a.devis_source_id = NEW.devis_source_id AND a.nature = 'acompte') THEN
      RAISE EXCEPTION 'acompte_deduction_requise' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.acompte_ecrire_lignes(p_facture_id uuid, p_devis_ref text, p_calcul jsonb, p_pourcentage numeric)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE x jsonb; i integer := 0; pct text := replace(trim_scale(p_pourcentage)::text, '.', ',');
BEGIN
  IF COALESCE((SELECT sum((v->>'ttc')::bigint) FROM jsonb_array_elements(p_calcul) v), 0) <= 0 THEN
    RAISE EXCEPTION 'acompte_nul' USING ERRCODE = '23514';
  END IF;
  PERFORM set_config('app.acompte_ecriture', p_facture_id::text, true);
  DELETE FROM public.factures_lignes WHERE facture_id = p_facture_id;
  FOR x IN SELECT * FROM jsonb_array_elements(p_calcul) LOOP
    IF (x->>'ht')::bigint > 0 THEN
      INSERT INTO public.factures_lignes(id, owner_id, facture_id, position, type, article_id, reference, designation, description,
        unite, quantite_milliemes, prix_ht_centimes, taux_tva_milliemes, ht_centimes, tva_centimes, ttc_centimes)
      VALUES (gen_random_uuid(), auth.uid(), p_facture_id, i, 'prestation', NULL, '',
        'Acompte de ' || pct || ' % sur devis ' || p_devis_ref || ' — part à TVA ' ||
          replace(trim_scale(((x->>'taux')::numeric / 10))::text, '.', ',') || ' %',
        'Base HT du devis à ce taux : ' || replace(to_char((x->>'base_devis')::numeric / 100, 'FM999999999990.00'), '.', ',') || ' €',
        'forfait', 1000, (x->>'ht')::bigint, (x->>'taux')::integer, 0, 0, 0);
      i := i + 1;
    END IF;
  END LOOP;
  PERFORM public.facture_recalculer(p_facture_id);
  PERFORM set_config('app.acompte_ecriture', '', true);
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_acompte(p_id uuid, p_version integer, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; pct numeric; calc jsonb; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_id AND owner_id = uid AND nature = 'acompte' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF f.statut <> 'brouillon' THEN RAISE EXCEPTION 'facture_verrouillee' USING ERRCODE = '42501'; END IF;
  IF f.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;
  pct := (p->>'pourcentage')::numeric;
  calc := public.acompte_calcul(f.devis_source_id, pct);
  PERFORM set_config('app.acompte_ecriture', p_id::text, true);
  UPDATE public.factures SET pourcentage = pct, date_facture = (p->>'date_facture')::date,
    date_echeance = NULLIF(p->>'date_echeance','')::date, remarques = COALESCE(p->>'remarques',''),
    notes = COALESCE(p->>'notes',''), version = version + 1
  WHERE id = p_id AND version = p_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;
  PERFORM public.acompte_ecrire_lignes(p_id, f.devis_source_reference, calc, pct);
  RETURN public.lire_facture(p_id);
END $$;