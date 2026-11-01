-- Avoirs partiels : plusieurs avoirs par facture, total plafonné au montant de la facture.
-- NON APPLIQUÉE. À relire puis installer après accord (voir LISEZ-MOI.md).
-- Écrite d'après les définitions réelles lues dans la base TEST le 01/11/2026
-- (preparer_avoir, finaliser_avoir, avoirs_garde, facture_credite, factures_lignes_calculer, facture_recalculer).
-- Règles : un avoir finalisé reste figé ; numérotation AV continue (seule la finalisation consomme un numéro) ;
-- un seul brouillon ouvert par facture ; un brouillon qu'on ne veut plus est « abandonné » (jamais supprimé).

-- 1. Structure ---------------------------------------------------------------------------------------------
ALTER TABLE public.avoirs ADD COLUMN IF NOT EXISTS type_avoir text NOT NULL DEFAULT 'total';
ALTER TABLE public.avoirs ADD CONSTRAINT avoirs_type_avoir_check CHECK (type_avoir IN ('total', 'partiel'));
ALTER TABLE public.avoirs DROP CONSTRAINT avoirs_statut_check;
ALTER TABLE public.avoirs ADD CONSTRAINT avoirs_statut_check CHECK (statut IN ('brouillon', 'finalise', 'abandonne'));
ALTER TABLE public.avoirs DROP CONSTRAINT avoirs_facture_source_id_key;
CREATE INDEX IF NOT EXISTS avoirs_facture_source_idx ON public.avoirs (facture_source_id);
CREATE UNIQUE INDEX IF NOT EXISTS avoirs_un_brouillon_par_facture ON public.avoirs (facture_source_id) WHERE statut = 'brouillon';

-- 2. Garde : abandonné = figé comme finalisé ; le type ne change jamais ---------------------------------------
CREATE OR REPLACE FUNCTION public.avoirs_garde() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF current_setting('app.avoir', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'avoir_via_operation' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.statut <> 'brouillon' OR NEW.reference_definitive IS NOT NULL OR NEW.finalise_le IS NOT NULL) THEN
    RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.statut IN ('finalise', 'abandonne') THEN RAISE EXCEPTION 'avoir_finalise' USING ERRCODE = '42501'; END IF;
    IF (NEW.reference, NEW.facture_source_id, NEW.facture_source_reference, NEW.client_id, NEW.client_copie,
        NEW.objet, NEW.lignes, NEW.total_ht_centimes, NEW.total_tva_centimes, NEW.total_ttc_centimes, NEW.ventilation_tva, NEW.type_avoir)
      IS DISTINCT FROM (OLD.reference, OLD.facture_source_id, OLD.facture_source_reference, OLD.client_id, OLD.client_copie,
        OLD.objet, OLD.lignes, OLD.total_ht_centimes, OLD.total_tva_centimes, OLD.total_ttc_centimes, OLD.ventilation_tva, OLD.type_avoir) THEN
      RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501'; END IF;
    IF (NEW.statut, NEW.reference_definitive, NEW.entreprise_copie, NEW.finalise_le, NEW.finalise_par)
       IS DISTINCT FROM (OLD.statut, OLD.reference_definitive, OLD.entreprise_copie, OLD.finalise_le, OLD.finalise_par)
       AND current_setting('app.avoir_finalisation', true) IS DISTINCT FROM NEW.id::text THEN
      RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 3. Calcul des lignes d'un avoir partiel (utilisé à la préparation ET à la finalisation) --------------------
-- p_lignes : tableau de {ligne_id | id, quantite_milliemes}. Retourne {lignes, ht, tva, ttc, ventilation}.
-- Quantité déjà créditée = lignes des avoirs FINALISÉS de la facture. Mêmes arrondis que factures_lignes_calculer.
-- Quand la quantité demandée solde la ligne, le montant est « le reste exact » : la somme des avoirs d'une ligne
-- ne dépasse alors jamais le montant facturé (pas d'écart d'arrondi d'un centime).
CREATE OR REPLACE FUNCTION public.avoir_calculer_lignes(p_facture_id uuid, p_lignes jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $function$
DECLARE e jsonb; l public.factures_lignes%ROWTYPE; lid uuid; q bigint; deja_q bigint; deja_ht bigint; deja_tva bigint;
  reste bigint; ht bigint; tva bigint; sortie jsonb := '[]'::jsonb; vu uuid[] := '{}'; vent jsonb; t_ht bigint := 0; t_tva bigint := 0;
BEGIN
  IF p_lignes IS NULL OR jsonb_typeof(p_lignes) <> 'array' OR jsonb_array_length(p_lignes) = 0 OR jsonb_array_length(p_lignes) > 300 THEN
    RAISE EXCEPTION 'lignes_invalides' USING ERRCODE = '23514'; END IF;
  FOR e IN SELECT x FROM jsonb_array_elements(p_lignes) x LOOP
    BEGIN
      lid := COALESCE(e->>'ligne_id', e->>'id')::uuid; q := (e->>'quantite_milliemes')::bigint;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'lignes_invalides' USING ERRCODE = '23514'; END;
    IF lid IS NULL OR q IS NULL OR q <= 0 THEN RAISE EXCEPTION 'lignes_invalides' USING ERRCODE = '23514'; END IF;
    IF lid = ANY (vu) THEN RAISE EXCEPTION 'lignes_invalides' USING ERRCODE = '23514'; END IF;
    vu := vu || lid;
    SELECT * INTO l FROM public.factures_lignes WHERE id = lid AND facture_id = p_facture_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ligne_inconnue' USING ERRCODE = '23514'; END IF;
    IF l.quantite_milliemes <= 0 OR l.prix_ht_centimes < 0 THEN RAISE EXCEPTION 'ligne_non_creditable' USING ERRCODE = '23514'; END IF;
    SELECT COALESCE(sum((x->>'quantite_milliemes')::bigint), 0), COALESCE(sum((x->>'ht_centimes')::bigint), 0), COALESCE(sum((x->>'tva_centimes')::bigint), 0)
      INTO deja_q, deja_ht, deja_tva
      FROM public.avoirs a, jsonb_array_elements(a.lignes) x
      WHERE a.facture_source_id = p_facture_id AND a.statut = 'finalise' AND (x->>'id')::uuid = l.id;
    reste := l.quantite_milliemes - deja_q;
    IF q > reste THEN RAISE EXCEPTION 'quantite_depassee' USING ERRCODE = '23514'; END IF;
    IF q = reste THEN ht := l.ht_centimes - deja_ht; tva := l.tva_centimes - deja_tva;
    ELSE ht := (q * l.prix_ht_centimes * 2 + 1000) / 2000; tva := (ht * l.taux_tva_milliemes * 2 + 1000) / 2000; END IF;
    sortie := sortie || jsonb_build_array((to_jsonb(l) - 'owner_id' - 'facture_id') ||
      jsonb_build_object('quantite_milliemes', q, 'ht_centimes', ht, 'tva_centimes', tva, 'ttc_centimes', ht + tva));
    t_ht := t_ht + ht; t_tva := t_tva + tva;
  END LOOP;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taux', taux, 'base', base, 'tva', tv) ORDER BY taux), '[]'::jsonb) INTO vent FROM (
    SELECT (x->>'taux_tva_milliemes')::int AS taux, sum((x->>'ht_centimes')::bigint) AS base, sum((x->>'tva_centimes')::bigint) AS tv
    FROM jsonb_array_elements(sortie) x GROUP BY 1) s;
  -- Lignes dans l'ordre de la facture.
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'position')::int), '[]'::jsonb) INTO sortie FROM jsonb_array_elements(sortie) x;
  RETURN jsonb_build_object('lignes', sortie, 'ht', t_ht, 'tva', t_tva, 'ttc', t_ht + t_tva, 'ventilation', vent);
END $function$;

-- 4. Préparer un avoir total (comportement conservé ; un brouillon ouvert est simplement retrouvé) ------------
CREATE OR REPLACE FUNCTION public.preparer_avoir(p_facture_id uuid, p_motif text) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; a public.avoirs%ROWTYPE; n integer; aid uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_facture_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO a FROM public.avoirs WHERE facture_source_id = p_facture_id AND statut = 'brouillon';
  IF FOUND THEN RETURN to_jsonb(a); END IF;
  SELECT * INTO a FROM public.avoirs WHERE facture_source_id = p_facture_id AND statut = 'finalise' AND type_avoir = 'total';
  IF FOUND THEN RETURN to_jsonb(a); END IF;
  IF f.statut <> 'finalise' THEN RAISE EXCEPTION 'avoir_facture_non_finalisee' USING ERRCODE = '23514'; END IF;
  IF f.nature = 'acompte' OR f.deduction IS NOT NULL OR f.acompte_deduit_id IS NOT NULL THEN
    RAISE EXCEPTION 'avoir_acompte_a_venir' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.avoirs WHERE facture_source_id = p_facture_id AND statut = 'finalise') THEN
    RAISE EXCEPTION 'avoir_deja_partiel' USING ERRCODE = '23514'; END IF;
  IF COALESCE(btrim(p_motif), '') = '' THEN RAISE EXCEPTION 'motif_requis' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.compteurs_factures_brouillon(owner_id, dernier_avoir) VALUES (uid, 1)
    ON CONFLICT (owner_id) DO UPDATE SET dernier_avoir = public.compteurs_factures_brouillon.dernier_avoir + 1
    RETURNING dernier_avoir INTO n;
  PERFORM set_config('app.avoir', aid::text, true);
  INSERT INTO public.avoirs(id, owner_id, reference, facture_source_id, facture_source_reference, client_id, client_copie, objet, lignes,
    total_ht_centimes, total_tva_centimes, total_ttc_centimes, ventilation_tva, date_avoir, motif, type_avoir)
  SELECT aid, uid, 'BROUILLON-AV-' || lpad(n::text, 3, '0'), f.id, f.reference_definitive, f.client_id, f.client_copie, f.objet,
    COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'owner_id' - 'facture_id' ORDER BY l.position) FROM public.factures_lignes l WHERE l.facture_id = f.id), '[]'::jsonb),
    f.total_ht_centimes, f.total_tva_centimes, f.total_ttc_centimes, f.ventilation_tva, (now() AT TIME ZONE 'Europe/Paris')::date, btrim(p_motif), 'total'
  RETURNING * INTO a;
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $function$;

-- 5. Préparer un avoir partiel ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preparer_avoir_partiel(p_facture_id uuid, p_motif text, p_lignes jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; a public.avoirs%ROWTYPE; n integer; aid uuid := gen_random_uuid();
  c jsonb; deja bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_facture_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO a FROM public.avoirs WHERE facture_source_id = p_facture_id AND statut = 'brouillon';
  IF FOUND THEN RETURN to_jsonb(a); END IF;
  IF f.statut <> 'finalise' THEN RAISE EXCEPTION 'avoir_facture_non_finalisee' USING ERRCODE = '23514'; END IF;
  IF f.nature = 'acompte' OR f.deduction IS NOT NULL OR f.acompte_deduit_id IS NOT NULL THEN
    RAISE EXCEPTION 'avoir_acompte_a_venir' USING ERRCODE = '23514'; END IF;
  IF COALESCE(btrim(p_motif), '') = '' THEN RAISE EXCEPTION 'motif_requis' USING ERRCODE = '23514'; END IF;
  c := public.avoir_calculer_lignes(p_facture_id, p_lignes);
  SELECT COALESCE(sum(total_ttc_centimes), 0) INTO deja FROM public.avoirs WHERE facture_source_id = p_facture_id AND statut = 'finalise';
  IF (c->>'ttc')::bigint <= 0 THEN RAISE EXCEPTION 'avoir_montant_nul' USING ERRCODE = '23514'; END IF;
  IF deja + (c->>'ttc')::bigint > f.total_ttc_centimes THEN RAISE EXCEPTION 'avoir_depasse_facture' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.compteurs_factures_brouillon(owner_id, dernier_avoir) VALUES (uid, 1)
    ON CONFLICT (owner_id) DO UPDATE SET dernier_avoir = public.compteurs_factures_brouillon.dernier_avoir + 1
    RETURNING dernier_avoir INTO n;
  PERFORM set_config('app.avoir', aid::text, true);
  INSERT INTO public.avoirs(id, owner_id, reference, facture_source_id, facture_source_reference, client_id, client_copie, objet, lignes,
    total_ht_centimes, total_tva_centimes, total_ttc_centimes, ventilation_tva, date_avoir, motif, type_avoir)
  VALUES (aid, uid, 'BROUILLON-AV-' || lpad(n::text, 3, '0'), f.id, f.reference_definitive, f.client_id, f.client_copie, f.objet, c->'lignes',
    (c->>'ht')::bigint, (c->>'tva')::bigint, (c->>'ttc')::bigint, c->'ventilation', (now() AT TIME ZONE 'Europe/Paris')::date, btrim(p_motif), 'partiel')
  RETURNING * INTO a;
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $function$;

-- 6. Finalisation : total = identique à la facture ; partiel = quantités restantes + plafond ---------------------
CREATE OR REPLACE FUNCTION public.finaliser_avoir(p_id uuid, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); a public.avoirs%ROWTYPE; f public.factures%ROWTYPE; e public.entreprises%ROWTYPE;
  fid uuid; n integer; an integer; lignes_src jsonb; c jsonb; deja bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT facture_source_id INTO fid FROM public.avoirs WHERE id = p_id AND owner_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  -- Verrou de la facture source d'abord : même ordre que enregistrer_reglement
  SELECT * INTO f FROM public.factures WHERE id = fid AND owner_id = uid FOR UPDATE;
  SELECT * INTO a FROM public.avoirs WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF a.statut = 'finalise' THEN RETURN to_jsonb(a); END IF;
  IF a.statut = 'abandonne' THEN RAISE EXCEPTION 'avoir_abandonne' USING ERRCODE = '23514'; END IF;
  IF a.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  IF f.statut <> 'finalise' THEN RAISE EXCEPTION 'avoir_facture_non_finalisee' USING ERRCODE = '23514'; END IF;
  IF f.nature = 'acompte' OR f.deduction IS NOT NULL OR f.acompte_deduit_id IS NOT NULL THEN
    RAISE EXCEPTION 'avoir_acompte_a_venir' USING ERRCODE = '23514'; END IF;
  SELECT COALESCE(sum(total_ttc_centimes), 0) INTO deja FROM public.avoirs WHERE facture_source_id = fid AND statut = 'finalise' AND id <> p_id;
  IF a.type_avoir = 'total' THEN
    IF deja > 0 THEN RAISE EXCEPTION 'avoir_deja_finalise' USING ERRCODE = '23514'; END IF;
    lignes_src := COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'owner_id' - 'facture_id' ORDER BY l.position) FROM public.factures_lignes l WHERE l.facture_id = fid), '[]'::jsonb);
    IF (a.total_ht_centimes, a.total_tva_centimes, a.total_ttc_centimes, a.ventilation_tva, a.lignes, a.facture_source_reference)
       IS DISTINCT FROM (f.total_ht_centimes, f.total_tva_centimes, f.total_ttc_centimes, f.ventilation_tva, lignes_src, f.reference_definitive) THEN
      RAISE EXCEPTION 'montants_incoherents' USING ERRCODE = '23514'; END IF;
  ELSE
    -- Recalcul complet sous verrou : quantités restantes et montants doivent être exactement ceux de l'avoir.
    c := public.avoir_calculer_lignes(fid, a.lignes);
    IF (a.total_ht_centimes, a.total_tva_centimes, a.total_ttc_centimes, a.ventilation_tva, a.lignes, a.facture_source_reference)
       IS DISTINCT FROM ((c->>'ht')::bigint, (c->>'tva')::bigint, (c->>'ttc')::bigint, c->'ventilation', c->'lignes', f.reference_definitive) THEN
      RAISE EXCEPTION 'montants_incoherents' USING ERRCODE = '23514'; END IF;
    IF deja + a.total_ttc_centimes > f.total_ttc_centimes THEN RAISE EXCEPTION 'avoir_depasse_facture' USING ERRCODE = '23514'; END IF;
  END IF;
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
END $function$;

-- 7. Abandon d'un brouillon (aucun numéro consommé, trace conservée) -------------------------------------------
CREATE OR REPLACE FUNCTION public.abandonner_avoir(p_id uuid, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE uid uuid := auth.uid(); a public.avoirs%ROWTYPE; fid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT facture_source_id INTO fid FROM public.avoirs WHERE id = p_id AND owner_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.factures WHERE id = fid AND owner_id = uid FOR UPDATE;
  SELECT * INTO a FROM public.avoirs WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF a.statut = 'abandonne' THEN RETURN to_jsonb(a); END IF;
  IF a.statut = 'finalise' THEN RAISE EXCEPTION 'avoir_finalise' USING ERRCODE = '23514'; END IF;
  IF a.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  PERFORM set_config('app.avoir', p_id::text, true);
  PERFORM set_config('app.avoir_finalisation', p_id::text, true);
  UPDATE public.avoirs SET statut = 'abandonne', version = version + 1 WHERE id = p_id RETURNING * INTO a;
  PERFORM set_config('app.avoir_finalisation', '', true);
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $function$;

-- 8. Droits ---------------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.avoir_calculer_lignes(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preparer_avoir_partiel(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.abandonner_avoir(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avoir_calculer_lignes(uuid, jsonb), public.preparer_avoir_partiel(uuid, text, jsonb), public.abandonner_avoir(uuid, integer) TO authenticated;
