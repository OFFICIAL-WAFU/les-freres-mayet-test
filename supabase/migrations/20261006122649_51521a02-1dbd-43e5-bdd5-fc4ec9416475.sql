-- Étape 17 : factures d'acompte brouillons (une par devis), distinctes des factures ordinaires.
ALTER TABLE public.factures ADD COLUMN nature text NOT NULL DEFAULT 'facture' CHECK (nature IN ('facture','acompte'));
ALTER TABLE public.factures ADD COLUMN pourcentage numeric(5,2);
ALTER TABLE public.factures ADD CONSTRAINT factures_pourcentage_coherent CHECK (
  (nature = 'facture' AND pourcentage IS NULL) OR (nature = 'acompte' AND pourcentage > 0 AND pourcentage < 100));
ALTER TABLE public.factures DROP CONSTRAINT factures_un_par_devis;
ALTER TABLE public.factures ADD CONSTRAINT factures_un_par_devis_et_nature UNIQUE (devis_source_id, nature);
ALTER TABLE public.compteurs_factures_brouillon ADD COLUMN dernier_acompte integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.factures_verifier() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.devis_source_id IS DISTINCT FROM OLD.devis_source_id
      OR NEW.devis_source_reference IS DISTINCT FROM OLD.devis_source_reference OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.client_copie IS DISTINCT FROM OLD.client_copie OR NEW.reference IS DISTINCT FROM OLD.reference
      OR NEW.nature IS DISTINCT FROM OLD.nature) THEN
    RAISE EXCEPTION 'rattachement_facture_immuable' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'client_non_autorise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.devis d WHERE d.id = NEW.devis_source_id AND d.owner_id = NEW.owner_id AND d.statut = 'finalise') THEN
    RAISE EXCEPTION 'devis_source_non_autorise' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Calcul unique (aperçu et enregistrement) : base HT par taux × pourcentage, arrondi demi-centime vers le haut.
CREATE OR REPLACE FUNCTION public.acompte_calcul(p_devis_id uuid, p_pourcentage numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF p_pourcentage IS NULL OR p_pourcentage <= 0 OR p_pourcentage >= 100 OR p_pourcentage <> round(p_pourcentage, 2) THEN
    RAISE EXCEPTION 'pourcentage_invalide' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taux', taux, 'base_devis', base, 'ht', ht, 'tva', tva, 'ttc', ht + tva) ORDER BY taux), '[]'::jsonb)
  INTO res FROM (
    SELECT taux, base, ht, floor((ht * taux)::numeric / 1000 + 0.5)::bigint AS tva FROM (
      SELECT l.taux_tva_milliemes AS taux, sum(l.ht_centimes) AS base,
        floor(sum(l.ht_centimes)::numeric * p_pourcentage / 100 + 0.5)::bigint AS ht
      FROM public.devis_lignes l JOIN public.devis d ON d.id = l.devis_id
      WHERE l.devis_id = p_devis_id AND d.owner_id = auth.uid()
      GROUP BY l.taux_tva_milliemes) s) t;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.acompte_ecrire_lignes(p_facture_id uuid, p_devis_ref text, p_calcul jsonb, p_pourcentage numeric)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE x jsonb; i integer := 0; pct text := replace(trim_scale(p_pourcentage)::text, '.', ',');
BEGIN
  IF COALESCE((SELECT sum((v->>'ttc')::bigint) FROM jsonb_array_elements(p_calcul) v), 0) <= 0 THEN
    RAISE EXCEPTION 'acompte_nul' USING ERRCODE = '23514';
  END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.preparer_acompte(p_devis_id uuid, p_pourcentage numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.devis%ROWTYPE; fid uuid; n integer; calc jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.devis WHERE id = p_devis_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT id INTO fid FROM public.factures WHERE devis_source_id = p_devis_id AND nature = 'acompte';
  IF FOUND THEN RETURN public.lire_facture(fid); END IF;
  IF d.statut <> 'finalise' THEN RAISE EXCEPTION 'devis_non_finalise' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.factures WHERE devis_source_id = p_devis_id AND nature = 'facture' AND statut = 'finalise') THEN
    RAISE EXCEPTION 'facture_deja_finalisee' USING ERRCODE = '23514';
  END IF;
  calc := public.acompte_calcul(p_devis_id, p_pourcentage);

  INSERT INTO public.compteurs_factures_brouillon(owner_id, dernier_acompte) VALUES (uid, 1)
    ON CONFLICT (owner_id) DO UPDATE SET dernier_acompte = public.compteurs_factures_brouillon.dernier_acompte + 1
    RETURNING dernier_acompte INTO n;
  INSERT INTO public.factures(owner_id, reference, nature, pourcentage, devis_source_id, devis_source_reference, client_id, client_copie, objet, date_facture)
  VALUES (uid, 'BROUILLON-ACP-' || lpad(n::text, 3, '0'), 'acompte', p_pourcentage, d.id, d.reference_definitive, d.client_id, d.client_copie,
          'Acompte — ' || d.objet, (now() AT TIME ZONE 'Europe/Paris')::date)
  RETURNING id INTO fid;
  PERFORM public.acompte_ecrire_lignes(fid, d.reference_definitive, calc, p_pourcentage);
  RETURN public.lire_facture(fid);
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
  UPDATE public.factures SET pourcentage = pct, date_facture = (p->>'date_facture')::date,
    date_echeance = NULLIF(p->>'date_echeance','')::date, remarques = COALESCE(p->>'remarques',''),
    notes = COALESCE(p->>'notes',''), version = version + 1
  WHERE id = p_id AND version = p_version;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;
  PERFORM public.acompte_ecrire_lignes(p_id, f.devis_source_reference, calc, pct);
  RETURN public.lire_facture(p_id);
END $$;

-- Factures ordinaires : la préparation ne retrouve que la facture ordinaire ; l'enregistrement refuse les acomptes.
CREATE OR REPLACE FUNCTION public.preparer_facture(p_devis_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); d public.devis%ROWTYPE; fid uuid; n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.devis WHERE id = p_devis_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT id INTO fid FROM public.factures WHERE devis_source_id = p_devis_id AND nature = 'facture';
  IF FOUND THEN RETURN public.lire_facture(fid); END IF;
  IF d.statut <> 'finalise' THEN RAISE EXCEPTION 'devis_non_finalise' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.compteurs_factures_brouillon(owner_id, dernier) VALUES (uid, 1)
    ON CONFLICT (owner_id) DO UPDATE SET dernier = public.compteurs_factures_brouillon.dernier + 1
    RETURNING dernier INTO n;
  INSERT INTO public.factures(owner_id, reference, devis_source_id, devis_source_reference, client_id, client_copie, objet, date_facture)
  VALUES (uid, 'BROUILLON-FAC-' || lpad(n::text, 3, '0'), d.id, d.reference_definitive, d.client_id, d.client_copie, d.objet,
          (now() AT TIME ZONE 'Europe/Paris')::date)
  RETURNING id INTO fid;
  INSERT INTO public.factures_lignes(id, owner_id, facture_id, position, type, article_id, reference, designation, description,
    unite, quantite_milliemes, prix_ht_centimes, taux_tva_milliemes, ht_centimes, tva_centimes, ttc_centimes)
  SELECT gen_random_uuid(), uid, fid, l.position, l.type, l.article_id, l.reference, l.designation, l.description,
    l.unite, l.quantite_milliemes, l.prix_ht_centimes, l.taux_tva_milliemes, 0, 0, 0
  FROM public.devis_lignes l WHERE l.devis_id = d.id ORDER BY l.position;
  PERFORM public.facture_recalculer(fid);
  RETURN public.lire_facture(fid);
END $$;

CREATE OR REPLACE FUNCTION public.facture_garde_nature() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Les lignes d'un acompte ne sont écrites que par les fonctions d'acompte (ligne manuelle interdite via enregistrer_facture).
  IF NEW.statut = 'finalise' AND OLD.statut = 'brouillon' THEN
    IF NEW.nature = 'acompte' THEN RAISE EXCEPTION 'finalisation_acompte_indisponible' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.factures a WHERE a.devis_source_id = NEW.devis_source_id AND a.nature = 'acompte') THEN
      RAISE EXCEPTION 'acompte_deduction_requise' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER factures_garde_nature BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.facture_garde_nature();

CREATE OR REPLACE FUNCTION public.enregistrer_facture_garde() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RETURN NEW; END $$;
DROP FUNCTION public.enregistrer_facture_garde();

REVOKE ALL ON FUNCTION public.acompte_calcul(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acompte_calcul(uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.acompte_ecrire_lignes(uuid, text, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acompte_ecrire_lignes(uuid, text, jsonb, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.preparer_acompte(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparer_acompte(uuid, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_acompte(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_acompte(uuid, integer, jsonb) TO authenticated;