CREATE OR REPLACE FUNCTION public.facture_garde_nature() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.nature = 'acompte' AND NEW.pourcentage IS DISTINCT FROM OLD.pourcentage
     AND current_setting('app.acompte_ecriture', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'pourcentage_via_enregistrement' USING ERRCODE = '42501';
  END IF;
  IF NEW.statut = 'finalise' AND OLD.statut = 'brouillon' THEN
    IF NEW.nature = 'acompte' THEN
      IF EXISTS (SELECT 1 FROM public.factures x WHERE x.devis_source_id = NEW.devis_source_id AND x.nature = 'facture' AND x.statut = 'finalise') THEN
        RAISE EXCEPTION 'facture_deja_finalisee' USING ERRCODE = '23514';
      END IF;
    ELSIF EXISTS (SELECT 1 FROM public.factures a WHERE a.devis_source_id = NEW.devis_source_id AND a.nature = 'acompte') THEN
      RAISE EXCEPTION 'acompte_deduction_requise' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.finaliser_facture(p_id uuid, p_version integer)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  f public.factures%ROWTYPE;
  e public.entreprises%ROWTYPE;
  manque text[] := '{}';
  n integer; an integer; s_ht bigint; s_tva bigint; nb integer; nb_invalides integer;
  calc jsonb; c_ht bigint; c_ttc bigint;
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
  IF f.nature = 'acompte' THEN
    IF f.pourcentage IS NULL OR f.pourcentage <= 0 OR f.pourcentage >= 100 THEN
      RAISE EXCEPTION 'pourcentage_invalide' USING ERRCODE = '23514'; END IF;
    calc := public.acompte_calcul(f.devis_source_id, f.pourcentage);
    SELECT COALESCE(sum((v->>'ht')::bigint),0), COALESCE(sum((v->>'ttc')::bigint),0) INTO c_ht, c_ttc FROM jsonb_array_elements(calc) v;
    IF c_ht <> f.total_ht_centimes OR c_ttc <> f.total_ttc_centimes THEN
      RAISE EXCEPTION 'montants_incoherents' USING ERRCODE = '23514'; END IF;
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
END $function$;