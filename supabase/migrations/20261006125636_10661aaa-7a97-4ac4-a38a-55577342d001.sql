CREATE TABLE public.reglements (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  facture_id uuid NOT NULL REFERENCES public.factures(id),
  montant_centimes bigint NOT NULL CHECK (montant_centimes > 0),
  date_reglement date NOT NULL,
  mode text NOT NULL CHECK (mode IN ('virement','cheque','especes','carte','autre')),
  commentaire text NOT NULL DEFAULT '',
  cree_par uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  annule_le timestamptz,
  annule_par uuid,
  motif_annulation text
);
CREATE INDEX reglements_facture_idx ON public.reglements(facture_id);
GRANT SELECT, INSERT, UPDATE ON public.reglements TO authenticated;
GRANT ALL ON public.reglements TO service_role;
REVOKE ALL ON public.reglements FROM anon;
ALTER TABLE public.reglements ENABLE ROW LEVEL SECURITY;
CREATE POLICY reglements_select ON public.reglements FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY reglements_insert ON public.reglements FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY reglements_update ON public.reglements FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reglements_garde() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.reglement', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'reglement_via_operation' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.annule_le IS NOT NULL THEN RAISE EXCEPTION 'reglement_deja_annule' USING ERRCODE = '23514'; END IF;
    IF (NEW.id, NEW.owner_id, NEW.facture_id, NEW.montant_centimes, NEW.date_reglement, NEW.mode, NEW.commentaire, NEW.cree_par, NEW.created_at)
       IS DISTINCT FROM (OLD.id, OLD.owner_id, OLD.facture_id, OLD.montant_centimes, OLD.date_reglement, OLD.mode, OLD.commentaire, OLD.cree_par, OLD.created_at) THEN
      RAISE EXCEPTION 'reglement_immuable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reglements_garde BEFORE INSERT OR UPDATE ON public.reglements FOR EACH ROW EXECUTE FUNCTION public.reglements_garde();

CREATE OR REPLACE FUNCTION public.facture_a_regler(f public.factures) RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT f.total_ttc_centimes - COALESCE((f.deduction->>'ttc')::bigint, 0);
$$;

CREATE OR REPLACE FUNCTION public.enregistrer_reglement(p_id uuid, p_facture_id uuid, p_montant bigint, p_date date, p_mode text, p_commentaire text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; r public.reglements%ROWTYPE; regle bigint;
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
  IF p_montant > public.facture_a_regler(f) - regle THEN RAISE EXCEPTION 'reglement_depasse' USING ERRCODE = '23514'; END IF;
  PERFORM set_config('app.reglement', p_id::text, true);
  INSERT INTO public.reglements(id, owner_id, facture_id, montant_centimes, date_reglement, mode, commentaire, cree_par)
  VALUES (p_id, uid, p_facture_id, p_montant, p_date, p_mode, COALESCE(btrim(p_commentaire), ''), uid) RETURNING * INTO r;
  PERFORM set_config('app.reglement', '', true);
  RETURN to_jsonb(r);
END $$;

CREATE OR REPLACE FUNCTION public.annuler_reglement(p_id uuid, p_motif text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); r public.reglements%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  IF COALESCE(btrim(p_motif), '') = '' THEN RAISE EXCEPTION 'motif_requis' USING ERRCODE = '23514'; END IF;
  PERFORM 1 FROM public.factures f JOIN public.reglements x ON x.facture_id = f.id WHERE x.id = p_id AND f.owner_id = uid FOR UPDATE OF f;
  SELECT * INTO r FROM public.reglements WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF r.annule_le IS NOT NULL THEN RETURN to_jsonb(r); END IF;
  PERFORM set_config('app.reglement', p_id::text, true);
  UPDATE public.reglements SET annule_le = now(), annule_par = uid, motif_annulation = btrim(p_motif) WHERE id = p_id RETURNING * INTO r;
  PERFORM set_config('app.reglement', '', true);
  RETURN to_jsonb(r);
END $$;