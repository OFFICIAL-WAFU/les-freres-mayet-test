ALTER TABLE public.compteurs_factures_brouillon ADD COLUMN IF NOT EXISTS dernier_avoir integer NOT NULL DEFAULT 0;

CREATE TABLE public.avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  reference text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon')),
  facture_source_id uuid NOT NULL UNIQUE REFERENCES public.factures(id),
  facture_source_reference text NOT NULL,
  client_id uuid NOT NULL,
  client_copie jsonb NOT NULL,
  objet text NOT NULL,
  lignes jsonb NOT NULL,
  total_ht_centimes bigint NOT NULL,
  total_tva_centimes bigint NOT NULL,
  total_ttc_centimes bigint NOT NULL,
  ventilation_tva jsonb NOT NULL,
  date_avoir date NOT NULL,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  remarques text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, reference)
);
GRANT SELECT, INSERT, UPDATE ON public.avoirs TO authenticated;
GRANT ALL ON public.avoirs TO service_role;
REVOKE ALL ON public.avoirs FROM anon;
ALTER TABLE public.avoirs ENABLE ROW LEVEL SECURITY;
CREATE POLICY avoirs_select ON public.avoirs FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY avoirs_insert ON public.avoirs FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY avoirs_update ON public.avoirs FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER avoirs_horodatage BEFORE INSERT OR UPDATE ON public.avoirs FOR EACH ROW EXECUTE FUNCTION public.clients_horodatage();

CREATE OR REPLACE FUNCTION public.avoirs_garde() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.avoir', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'avoir_via_operation' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.reference, NEW.statut, NEW.facture_source_id, NEW.facture_source_reference, NEW.client_id, NEW.client_copie,
      NEW.objet, NEW.lignes, NEW.total_ht_centimes, NEW.total_tva_centimes, NEW.total_ttc_centimes, NEW.ventilation_tva)
    IS DISTINCT FROM (OLD.reference, OLD.statut, OLD.facture_source_id, OLD.facture_source_reference, OLD.client_id, OLD.client_copie,
      OLD.objet, OLD.lignes, OLD.total_ht_centimes, OLD.total_tva_centimes, OLD.total_ttc_centimes, OLD.ventilation_tva) THEN
    RAISE EXCEPTION 'avoir_contenu_immuable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER avoirs_garde BEFORE INSERT OR UPDATE ON public.avoirs FOR EACH ROW EXECUTE FUNCTION public.avoirs_garde();

CREATE OR REPLACE FUNCTION public.preparer_avoir(p_facture_id uuid, p_motif text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); f public.factures%ROWTYPE; a public.avoirs%ROWTYPE; n integer; aid uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_facture_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO a FROM public.avoirs WHERE facture_source_id = p_facture_id;
  IF FOUND THEN RETURN to_jsonb(a); END IF;
  IF f.statut <> 'finalise' THEN RAISE EXCEPTION 'avoir_facture_non_finalisee' USING ERRCODE = '23514'; END IF;
  IF f.nature = 'acompte' OR f.deduction IS NOT NULL OR f.acompte_deduit_id IS NOT NULL THEN
    RAISE EXCEPTION 'avoir_acompte_a_venir' USING ERRCODE = '23514'; END IF;
  IF COALESCE(btrim(p_motif), '') = '' THEN RAISE EXCEPTION 'motif_requis' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.compteurs_factures_brouillon(owner_id, dernier_avoir) VALUES (uid, 1)
    ON CONFLICT (owner_id) DO UPDATE SET dernier_avoir = public.compteurs_factures_brouillon.dernier_avoir + 1
    RETURNING dernier_avoir INTO n;
  PERFORM set_config('app.avoir', aid::text, true);
  INSERT INTO public.avoirs(id, owner_id, reference, facture_source_id, facture_source_reference, client_id, client_copie, objet, lignes,
    total_ht_centimes, total_tva_centimes, total_ttc_centimes, ventilation_tva, date_avoir, motif)
  SELECT aid, uid, 'BROUILLON-AV-' || lpad(n::text, 3, '0'), f.id, f.reference_definitive, f.client_id, f.client_copie, f.objet,
    COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'owner_id' - 'facture_id' ORDER BY l.position) FROM public.factures_lignes l WHERE l.facture_id = f.id), '[]'::jsonb),
    f.total_ht_centimes, f.total_tva_centimes, f.total_ttc_centimes, f.ventilation_tva, (now() AT TIME ZONE 'Europe/Paris')::date, btrim(p_motif)
  RETURNING * INTO a;
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_avoir(p_id uuid, p_version integer, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); a public.avoirs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.avoirs WHERE id = p_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  IF a.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = 'PT409'; END IF;
  IF COALESCE(btrim(p->>'motif'), '') = '' THEN RAISE EXCEPTION 'motif_requis' USING ERRCODE = '23514'; END IF;
  PERFORM set_config('app.avoir', p_id::text, true);
  UPDATE public.avoirs SET date_avoir = (p->>'date_avoir')::date, motif = btrim(p->>'motif'),
    remarques = COALESCE(p->>'remarques', ''), version = version + 1
  WHERE id = p_id RETURNING * INTO a;
  PERFORM set_config('app.avoir', '', true);
  RETURN to_jsonb(a);
END $$;