ALTER TABLE public.devis DROP CONSTRAINT IF EXISTS devis_statut_check;
ALTER TABLE public.devis ADD CONSTRAINT devis_statut_check CHECK (statut IN ('brouillon','finalise'));
ALTER TABLE public.devis
  ADD COLUMN reference_definitive text,
  ADD COLUMN finalise_le timestamptz,
  ADD COLUMN finalise_par uuid,
  ADD COLUMN entreprise_copie jsonb,
  ADD CONSTRAINT devis_reference_definitive_unique UNIQUE (owner_id, reference_definitive),
  ADD CONSTRAINT devis_finalise_complet CHECK (statut = 'brouillon' OR (reference_definitive IS NOT NULL AND finalise_le IS NOT NULL AND finalise_par IS NOT NULL AND entreprise_copie IS NOT NULL));

CREATE TABLE public.compteurs_references (
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  type_document text NOT NULL,
  annee integer NOT NULL,
  dernier integer NOT NULL DEFAULT 0,
  PRIMARY KEY (owner_id, type_document, annee)
);
GRANT SELECT, INSERT, UPDATE ON public.compteurs_references TO authenticated;
GRANT ALL ON public.compteurs_references TO service_role;
REVOKE ALL ON public.compteurs_references FROM anon;
REVOKE DELETE, TRUNCATE ON public.compteurs_references FROM authenticated;
ALTER TABLE public.compteurs_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Compteurs définitifs lecture" ON public.compteurs_references FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Compteurs définitifs création" ON public.compteurs_references FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Compteurs définitifs modification" ON public.compteurs_references FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Verrouillage : un devis finalisé ne change plus ; la finalisation passe uniquement par finaliser_devis.
CREATE OR REPLACE FUNCTION public.devis_verrouiller() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.statut <> 'brouillon' OR NEW.reference_definitive IS NOT NULL THEN RAISE EXCEPTION 'creation_brouillon_uniquement'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.statut = 'finalise' THEN RAISE EXCEPTION 'devis_finalise_verrouille' USING ERRCODE = '42501'; END IF;
  IF NEW.statut = 'finalise' AND current_setting('app.finalisation', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'finalisation_directe_interdite' USING ERRCODE = '42501';
  END IF;
  IF NEW.statut = 'brouillon' AND (NEW.reference_definitive IS NOT NULL OR NEW.entreprise_copie IS NOT NULL OR NEW.finalise_le IS NOT NULL) THEN
    RAISE EXCEPTION 'champs_finalisation_reserves';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER devis_verrouiller BEFORE INSERT OR UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.devis_verrouiller();

CREATE OR REPLACE FUNCTION public.devis_lignes_verrouiller() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE did uuid := COALESCE(NEW.devis_id, OLD.devis_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.devis d WHERE d.id = did AND d.statut <> 'brouillon') THEN
    RAISE EXCEPTION 'devis_finalise_verrouille' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER devis_lignes_verrouiller BEFORE INSERT OR UPDATE OR DELETE ON public.devis_lignes FOR EACH ROW EXECUTE FUNCTION public.devis_lignes_verrouiller();

CREATE OR REPLACE FUNCTION public.finaliser_devis(p_id uuid, p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
  -- Nouvelle tentative après succès : on renvoie le même devis finalisé, sans nouveau numéro.
  IF d.statut = 'finalise' THEN RETURN public.lire_devis(p_id); END IF;
  IF d.version <> p_version THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;

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
END $$;
REVOKE ALL ON FUNCTION public.finaliser_devis(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finaliser_devis(uuid, integer) TO authenticated;