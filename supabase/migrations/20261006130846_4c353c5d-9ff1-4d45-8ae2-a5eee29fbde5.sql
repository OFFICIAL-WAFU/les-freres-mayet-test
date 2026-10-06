ALTER TABLE public.avoirs DROP CONSTRAINT IF EXISTS avoirs_statut_check;
ALTER TABLE public.avoirs ADD CONSTRAINT avoirs_statut_check CHECK (statut IN ('brouillon','finalise'));
ALTER TABLE public.avoirs ADD COLUMN reference_definitive text, ADD COLUMN entreprise_copie jsonb,
  ADD COLUMN finalise_le timestamptz, ADD COLUMN finalise_par uuid;
CREATE UNIQUE INDEX avoirs_ref_def_uniq ON public.avoirs(owner_id, reference_definitive) WHERE reference_definitive IS NOT NULL;

CREATE OR REPLACE FUNCTION public.avoirs_garde() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.avoir', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'avoir_via_operation' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.statut <> 'brouillon' OR NEW.reference_definitive IS NOT NULL OR NEW.finalise_le IS NOT NULL) THEN
    RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.statut = 'finalise' THEN RAISE EXCEPTION 'avoir_finalise' USING ERRCODE = '42501'; END IF;
    IF (NEW.reference, NEW.facture_source_id, NEW.facture_source_reference, NEW.client_id, NEW.client_copie,
        NEW.objet, NEW.lignes, NEW.total_ht_centimes, NEW.total_tva_centimes, NEW.total_ttc_centimes, NEW.ventilation_tva)
      IS DISTINCT FROM (OLD.reference, OLD.facture_source_id, OLD.facture_source_reference, OLD.client_id, OLD.client_copie,
        OLD.objet, OLD.lignes, OLD.total_ht_centimes, OLD.total_tva_centimes, OLD.total_ttc_centimes, OLD.ventilation_tva) THEN
      RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501'; END IF;
    IF (NEW.statut, NEW.reference_definitive, NEW.entreprise_copie, NEW.finalise_le, NEW.finalise_par)
       IS DISTINCT FROM (OLD.statut, OLD.reference_definitive, OLD.entreprise_copie, OLD.finalise_le, OLD.finalise_par)
       AND current_setting('app.avoir_finalisation', true) IS DISTINCT FROM NEW.id::text THEN
      RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_avoir(p_id uuid, p_version integer, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); a public.avoirs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.avoirs WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF a.statut = 'finalise' THEN RAISE EXCEPTION 'avoir_finalise' USING ERRCODE = '23514'; END IF;
  IF a.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  IF COALESCE(btrim(p->>'motif'), '') = '' THEN RAISE EXCEPTION 'motif_requis' USING ERRCODE = '23514'; END IF;
  PERFORM set_config('app.avoir', p_id::text, true);
  UPDATE public.avoirs SET date_avoir = (p->>'date_avoir')::date, motif = btrim(p->>'motif'),
    remarques = COALESCE(p->>'remarques', ''), version = version + 1
  WHERE id = p_id RETURNING * INTO a;
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $$;

-- Montant crédité par avoirs finalisés
CREATE OR REPLACE FUNCTION public.facture_credite(p_facture_id uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT COALESCE(sum(total_ttc_centimes), 0)::bigint FROM public.avoirs WHERE facture_source_id = p_facture_id AND statut = 'finalise';
$$;

CREATE OR REPLACE FUNCTION public.finaliser_avoir(p_id uuid, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); a public.avoirs%ROWTYPE; f public.factures%ROWTYPE; e public.entreprises%ROWTYPE;
  fid uuid; n integer; an integer; lignes_src jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT facture_source_id INTO fid FROM public.avoirs WHERE id = p_id AND owner_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  -- Verrou de la facture source d'abord : même ordre que enregistrer_reglement
  SELECT * INTO f FROM public.factures WHERE id = fid AND owner_id = uid FOR UPDATE;
  SELECT * INTO a FROM public.avoirs WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF a.statut = 'finalise' THEN RETURN to_jsonb(a); END IF;
  IF a.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  IF f.statut <> 'finalise' THEN RAISE EXCEPTION 'avoir_facture_non_finalisee' USING ERRCODE = '23514'; END IF;
  IF f.nature = 'acompte' OR f.deduction IS NOT NULL OR f.acompte_deduit_id IS NOT NULL THEN
    RAISE EXCEPTION 'avoir_acompte_a_venir' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.avoirs WHERE facture_source_id = fid AND statut = 'finalise' AND id <> p_id) THEN
    RAISE EXCEPTION 'avoir_deja_finalise' USING ERRCODE = '23514'; END IF;
  lignes_src := COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'owner_id' - 'facture_id' ORDER BY l.position) FROM public.factures_lignes l WHERE l.facture_id = fid), '[]'::jsonb);
  IF (a.total_ht_centimes, a.total_tva_centimes, a.total_ttc_centimes, a.ventilation_tva, a.lignes, a.facture_source_reference)
     IS DISTINCT FROM (f.total_ht_centimes, f.total_tva_centimes, f.total_ttc_centimes, f.ventilation_tva, lignes_src, f.reference_definitive) THEN
    RAISE EXCEPTION 'montants_incoherents' USING ERRCODE = '23514'; END IF;
  SELECT * INTO e FROM public.entreprises WHERE owner_id = uid;
  IF NOT FOUND OR btrim(e.raison_sociale) = '' THEN RAISE EXCEPTION 'fiche_entreprise' USING ERRCODE = '23514'; END IF;
  an := extract(year FROM (now() AT TIME ZONE 'Europe/Paris'))::integer;
  INSERT INTO public.compteurs_references(owner_id, type_document, annee, dernier) VALUES (uid, 'avoir', an, 1)
    ON CONFLICT (owner_id, type_document, annee) DO UPDATE SET dernier = public.compteurs_references.dernier + 1
    RETURNING dernier INTO n;
  PERFORM set_config('app.avoir', p_id::text, true);
  PERFORM set_config('app.avoir_finalisation', p_id::text, true);
  UPDATE public.avoirs SET statut = 'finalise', reference_definitive = 'AV-LFM-' || an || '-' || lpad(n::text, 5, '0'),
    finalise_le = now(), finalise_par = uid,
    entreprise_copie = to_jsonb(e) - 'id' - 'owner_id' - 'created_at' - 'updated_at', version = version + 1
  WHERE id = p_id RETURNING * INTO a;
  PERFORM set_config('app.avoir_finalisation', '', true);
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_reglement(p_id uuid, p_facture_id uuid, p_montant bigint, p_date date, p_mode text, p_commentaire text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; r public.reglements%ROWTYPE; regle bigint; reste bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_facture_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO r FROM public.reglements WHERE id = p_id;
  IF FOUND THEN
    IF r.owner_id <> uid OR r.facture_id <> p_facture_id THEN RAISE EXCEPTION 'reglement_non_autorise' USING ERRCODE = '42501'; END IF;
    RETURN to_jsonb(r);
  END IF;
  IF f.statut <> 'finalise' THEN RAISE EXCEPTION 'facture_non_finalisee' USING ERRCODE = '23514'; END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RAISE EXCEPTION 'montant_invalide' USING ERRCODE = '23514'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'date_invalide' USING ERRCODE = '23514'; END IF;
  SELECT COALESCE(sum(montant_centimes), 0) INTO regle FROM public.reglements WHERE facture_id = p_facture_id AND annule_le IS NULL;
  reste := public.facture_a_regler(f) - public.facture_credite(p_facture_id) - regle;
  IF public.facture_credite(p_facture_id) > 0 AND reste <= 0 THEN RAISE EXCEPTION 'facture_creditee' USING ERRCODE = '23514'; END IF;
  IF p_montant > reste THEN RAISE EXCEPTION 'reglement_depasse' USING ERRCODE = '23514'; END IF;
  PERFORM set_config('app.reglement', p_id::text, true);
  INSERT INTO public.reglements(id, owner_id, facture_id, montant_centimes, date_reglement, mode, commentaire, cree_par)
  VALUES (p_id, uid, p_facture_id, p_montant, p_date, p_mode, COALESCE(btrim(p_commentaire), ''), uid) RETURNING * INTO r;
  PERFORM set_config('app.reglement', '', true);
  RETURN to_jsonb(r);
END $$;
GRANT EXECUTE ON FUNCTION public.finaliser_avoir(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.facture_credite(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finaliser_avoir(uuid, integer) FROM anon;