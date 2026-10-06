-- Étape 14 : factures brouillons issues d'un devis finalisé.
CREATE TABLE public.compteurs_factures_brouillon (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid(),
  dernier integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE ON public.compteurs_factures_brouillon TO authenticated;
GRANT ALL ON public.compteurs_factures_brouillon TO service_role;
REVOKE ALL ON public.compteurs_factures_brouillon FROM anon;
ALTER TABLE public.compteurs_factures_brouillon ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Compteur factures lecture" ON public.compteurs_factures_brouillon FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Compteur factures création" ON public.compteurs_factures_brouillon FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Compteur factures modification" ON public.compteurs_factures_brouillon FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  reference text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut = 'brouillon'),
  devis_source_id uuid NOT NULL REFERENCES public.devis(id),
  devis_source_reference text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  client_copie jsonb NOT NULL,
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  date_facture date NOT NULL,
  date_echeance date,
  remarques text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  total_ht_centimes bigint NOT NULL DEFAULT 0,
  total_tva_centimes bigint NOT NULL DEFAULT 0,
  total_ttc_centimes bigint NOT NULL DEFAULT 0,
  ventilation_tva jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT factures_reference_unique UNIQUE (owner_id, reference),
  CONSTRAINT factures_un_par_devis UNIQUE (devis_source_id),
  CONSTRAINT factures_echeance_coherente CHECK (date_echeance IS NULL OR date_echeance >= date_facture)
);
CREATE INDEX factures_owner ON public.factures(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.factures TO authenticated;
GRANT ALL ON public.factures TO service_role;
REVOKE ALL ON public.factures FROM anon;
REVOKE DELETE, TRUNCATE ON public.factures FROM authenticated;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture de ses factures" ON public.factures FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Création de ses factures" ON public.factures FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Modification de ses factures" ON public.factures FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER factures_horodatage BEFORE INSERT OR UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.clients_horodatage();

CREATE TABLE public.factures_lignes (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  facture_id uuid NOT NULL REFERENCES public.factures(id),
  position integer NOT NULL CHECK (position >= 0),
  type text NOT NULL CHECK (type IN ('materiel','prestation')),
  article_id uuid REFERENCES public.articles(id),
  reference text NOT NULL DEFAULT '',
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  description text NOT NULL DEFAULT '',
  unite text NOT NULL CHECK (unite IN ('piece','heure','forfait','metre','m2','m3')),
  quantite_milliemes bigint NOT NULL CHECK (quantite_milliemes > 0),
  prix_ht_centimes bigint NOT NULL CHECK (prix_ht_centimes >= 0),
  taux_tva_milliemes integer NOT NULL CHECK (taux_tva_milliemes IN (0,55,100,200)),
  ht_centimes bigint NOT NULL,
  tva_centimes bigint NOT NULL,
  ttc_centimes bigint NOT NULL,
  CONSTRAINT factures_lignes_position_unique UNIQUE (facture_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX factures_lignes_facture ON public.factures_lignes(facture_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.factures_lignes TO authenticated;
GRANT ALL ON public.factures_lignes TO service_role;
REVOKE ALL ON public.factures_lignes FROM anon;
REVOKE TRUNCATE ON public.factures_lignes FROM authenticated;
ALTER TABLE public.factures_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture des lignes de ses factures" ON public.factures_lignes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_id AND f.owner_id = auth.uid()));
CREATE POLICY "Création des lignes de ses factures" ON public.factures_lignes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_id AND f.owner_id = auth.uid()));
CREATE POLICY "Modification des lignes de ses factures" ON public.factures_lignes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_id AND f.owner_id = auth.uid()));
CREATE POLICY "Retrait des lignes de ses factures brouillons" ON public.factures_lignes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.factures f WHERE f.id = facture_id AND f.owner_id = auth.uid() AND f.statut = 'brouillon'));

-- Cohérence : client et devis du même propriétaire, devis finalisé ; rattachements immuables.
CREATE OR REPLACE FUNCTION public.factures_verifier() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.devis_source_id IS DISTINCT FROM OLD.devis_source_id
      OR NEW.devis_source_reference IS DISTINCT FROM OLD.devis_source_reference OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.client_copie IS DISTINCT FROM OLD.client_copie OR NEW.reference IS DISTINCT FROM OLD.reference) THEN
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
CREATE TRIGGER factures_verifier BEFORE INSERT OR UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.factures_verifier();

CREATE OR REPLACE FUNCTION public.factures_lignes_calculer() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.facture_id IS DISTINCT FROM OLD.facture_id) THEN
    RAISE EXCEPTION 'Le rattachement d''une ligne ne peut pas être modifié';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.factures f WHERE f.id = NEW.facture_id AND f.owner_id = NEW.owner_id AND f.statut = 'brouillon') THEN
    RAISE EXCEPTION 'facture_non_autorisee' USING ERRCODE = '42501';
  END IF;
  IF NEW.article_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.articles a WHERE a.id = NEW.article_id AND a.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'article_non_autorise' USING ERRCODE = '42501';
  END IF;
  NEW.ht_centimes := (NEW.quantite_milliemes * NEW.prix_ht_centimes * 2 + 1000) / 2000;
  NEW.tva_centimes := (NEW.ht_centimes * NEW.taux_tva_milliemes * 2 + 1000) / 2000;
  NEW.ttc_centimes := NEW.ht_centimes + NEW.tva_centimes;
  RETURN NEW;
END $$;
CREATE TRIGGER factures_lignes_calculer BEFORE INSERT OR UPDATE ON public.factures_lignes FOR EACH ROW EXECUTE FUNCTION public.factures_lignes_calculer();

CREATE OR REPLACE FUNCTION public.lire_facture(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT to_jsonb(f) || jsonb_build_object('lignes', COALESCE((
    SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position) FROM public.factures_lignes l WHERE l.facture_id = f.id), '[]'::jsonb))
  FROM public.factures f WHERE f.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.facture_recalculer(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE t_ht bigint; t_tva bigint; vent jsonb;
BEGIN
  SELECT COALESCE(sum(ht_centimes),0), COALESCE(sum(tva_centimes),0) INTO t_ht, t_tva FROM public.factures_lignes WHERE facture_id = p_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taux', taux, 'base', base, 'tva', tva) ORDER BY taux), '[]'::jsonb) INTO vent FROM (
    SELECT taux_tva_milliemes AS taux, sum(ht_centimes) AS base, sum(tva_centimes) AS tva
    FROM public.factures_lignes WHERE facture_id = p_id GROUP BY taux_tva_milliemes) s;
  UPDATE public.factures SET total_ht_centimes = t_ht, total_tva_centimes = t_tva, total_ttc_centimes = t_ht + t_tva,
    ventilation_tva = vent WHERE id = p_id;
END $$;

-- Préparation idempotente : une seule facture par devis ; verrou sur le devis contre les demandes simultanées.
CREATE OR REPLACE FUNCTION public.preparer_facture(p_devis_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d public.devis%ROWTYPE;
  fid uuid;
  n integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  SELECT * INTO d FROM public.devis WHERE id = p_devis_id AND owner_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'introuvable' USING ERRCODE = 'P0002'; END IF;
  SELECT id INTO fid FROM public.factures WHERE devis_source_id = p_devis_id;
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

-- Enregistrement atomique d'une facture brouillon (client et devis source non modifiables).
CREATE OR REPLACE FUNCTION public.enregistrer_facture(p_id uuid, p_version integer, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  f public.factures%ROWTYPE;
  n integer; l jsonb; i integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p->'lignes') <> 'array' OR jsonb_array_length(p->'lignes') = 0 THEN
    RAISE EXCEPTION 'lignes_requises' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO f FROM public.factures WHERE id = p_id AND owner_id = uid FOR UPDATE;
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
END $$;

REVOKE ALL ON FUNCTION public.lire_facture(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lire_facture(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.facture_recalculer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facture_recalculer(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.preparer_facture(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparer_facture(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.enregistrer_facture(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_facture(uuid, integer, jsonb) TO authenticated;