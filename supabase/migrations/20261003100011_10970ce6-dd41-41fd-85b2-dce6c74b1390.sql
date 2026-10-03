CREATE TABLE public.compteurs_devis (
  owner_id uuid PRIMARY KEY DEFAULT auth.uid(),
  dernier integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE ON public.compteurs_devis TO authenticated;
GRANT ALL ON public.compteurs_devis TO service_role;
REVOKE ALL ON public.compteurs_devis FROM anon;
ALTER TABLE public.compteurs_devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Compteur personnel lecture" ON public.compteurs_devis FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Compteur personnel création" ON public.compteurs_devis FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Compteur personnel modification" ON public.compteurs_devis FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.devis (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  reference text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut = 'brouillon'),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  client_copie jsonb NOT NULL,
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  date_devis date NOT NULL,
  date_validite date,
  remarques text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  total_ht_centimes bigint NOT NULL DEFAULT 0,
  total_tva_centimes bigint NOT NULL DEFAULT 0,
  total_ttc_centimes bigint NOT NULL DEFAULT 0,
  ventilation_tva jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT devis_reference_unique UNIQUE (owner_id, reference),
  CONSTRAINT devis_validite_coherente CHECK (date_validite IS NULL OR date_validite >= date_devis)
);
CREATE INDEX devis_owner_date ON public.devis(owner_id, date_devis DESC);
GRANT SELECT, INSERT, UPDATE ON public.devis TO authenticated;
GRANT ALL ON public.devis TO service_role;
REVOKE ALL ON public.devis FROM anon;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture de ses devis" ON public.devis FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Création de ses devis" ON public.devis FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Modification de ses devis" ON public.devis FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER devis_horodatage BEFORE INSERT OR UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.clients_horodatage();

CREATE TABLE public.devis_lignes (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  devis_id uuid NOT NULL REFERENCES public.devis(id),
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
  CONSTRAINT devis_lignes_position_unique UNIQUE (devis_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX devis_lignes_devis ON public.devis_lignes(devis_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devis_lignes TO authenticated;
GRANT ALL ON public.devis_lignes TO service_role;
REVOKE ALL ON public.devis_lignes FROM anon;
ALTER TABLE public.devis_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture des lignes de ses devis" ON public.devis_lignes FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.devis d WHERE d.id = devis_id AND d.owner_id = auth.uid()));
CREATE POLICY "Création des lignes de ses devis" ON public.devis_lignes FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.devis d WHERE d.id = devis_id AND d.owner_id = auth.uid()));
CREATE POLICY "Modification des lignes de ses devis" ON public.devis_lignes FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.devis d WHERE d.id = devis_id AND d.owner_id = auth.uid()));
CREATE POLICY "Retrait des lignes de ses brouillons" ON public.devis_lignes FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.devis d WHERE d.id = devis_id AND d.owner_id = auth.uid() AND d.statut = 'brouillon'));

-- Contrôles de cohérence : propriétaire commun, calcul imposé par le serveur.
CREATE OR REPLACE FUNCTION public.devis_verifier() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'client_non_autorise' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER devis_verifier BEFORE INSERT OR UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.devis_verifier();

CREATE OR REPLACE FUNCTION public.devis_lignes_calculer() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.devis_id IS DISTINCT FROM OLD.devis_id) THEN
    RAISE EXCEPTION 'Le rattachement d''une ligne ne peut pas être modifié';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.devis d WHERE d.id = NEW.devis_id AND d.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'devis_non_autorise' USING ERRCODE = '42501';
  END IF;
  IF NEW.article_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.articles a WHERE a.id = NEW.article_id AND a.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'article_non_autorise' USING ERRCODE = '42501';
  END IF;
  -- HT = q × p arrondi au centime (demi vers le haut) ; TVA = HT × taux arrondie ; TTC = HT + TVA.
  NEW.ht_centimes := (NEW.quantite_milliemes * NEW.prix_ht_centimes * 2 + 1000) / 2000;
  NEW.tva_centimes := (NEW.ht_centimes * NEW.taux_tva_milliemes * 2 + 1000) / 2000;
  NEW.ttc_centimes := NEW.ht_centimes + NEW.tva_centimes;
  RETURN NEW;
END $$;
CREATE TRIGGER devis_lignes_calculer BEFORE INSERT OR UPDATE ON public.devis_lignes FOR EACH ROW EXECUTE FUNCTION public.devis_lignes_calculer();

-- Lecture d'un devis complet (droits de l'appelant).
CREATE OR REPLACE FUNCTION public.lire_devis(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT to_jsonb(d) || jsonb_build_object('lignes', COALESCE((
    SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position) FROM public.devis_lignes l WHERE l.devis_id = d.id), '[]'::jsonb))
  FROM public.devis d WHERE d.id = p_id;
$$;

-- Enregistrement atomique d'un brouillon (une seule transaction, droits de l'appelant).
CREATE OR REPLACE FUNCTION public.enregistrer_brouillon(p_id uuid, p_version integer, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
      -- Nouvelle tentative d'une création déjà aboutie : on ne l'applique que si personne ne l'a modifiée depuis.
      IF existant.version <> 1 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;
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
    IF existant.version <> v_attendue THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;
  END IF;

  IF v_attendue IS NOT NULL THEN
    UPDATE public.devis SET client_id = (p->>'client_id')::uuid, client_copie = p->'client_copie',
      objet = p->>'objet', date_devis = (p->>'date_devis')::date, date_validite = NULLIF(p->>'date_validite','')::date,
      remarques = COALESCE(p->>'remarques',''), notes = COALESCE(p->>'notes',''), version = version + 1
    WHERE id = p_id AND version = v_attendue;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN RAISE EXCEPTION 'conflit_version' USING ERRCODE = '40001'; END IF;
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

  -- Totaux recalculés à partir des montants arrondis des lignes.
  SELECT COALESCE(sum(ht_centimes),0), COALESCE(sum(tva_centimes),0) INTO t_ht, t_tva FROM public.devis_lignes WHERE devis_id = p_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('taux', taux, 'base', base, 'tva', tva) ORDER BY taux), '[]'::jsonb) INTO vent FROM (
    SELECT taux_tva_milliemes AS taux, sum(ht_centimes) AS base, sum(tva_centimes) AS tva
    FROM public.devis_lignes WHERE devis_id = p_id GROUP BY taux_tva_milliemes) s;
  UPDATE public.devis SET total_ht_centimes = t_ht, total_tva_centimes = t_tva, total_ttc_centimes = t_ht + t_tva,
    ventilation_tva = vent WHERE id = p_id;

  RETURN public.lire_devis(p_id);
END $$;
REVOKE ALL ON FUNCTION public.enregistrer_brouillon(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_brouillon(uuid, integer, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.lire_devis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lire_devis(uuid) TO authenticated;