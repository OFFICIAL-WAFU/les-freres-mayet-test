BEGIN;
ALTER TABLE public.factures ALTER COLUMN devis_source_id DROP NOT NULL,
  ALTER COLUMN devis_source_reference DROP NOT NULL;
ALTER TABLE public.factures ADD CONSTRAINT factures_source_coherente CHECK (
  (devis_source_id IS NOT NULL AND devis_source_reference IS NOT NULL AND btrim(devis_source_reference) <> '')
  OR (nature = 'facture' AND devis_source_id IS NULL AND devis_source_reference IS NULL));

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
  IF NEW.devis_source_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.devis d WHERE d.id = NEW.devis_source_id AND d.owner_id = NEW.owner_id AND d.statut = 'finalise'
  ) THEN RAISE EXCEPTION 'devis_source_non_autorise' USING ERRCODE = '42501'; END IF;
  IF NEW.devis_source_id IS NULL AND NEW.nature <> 'facture' THEN RAISE EXCEPTION 'acompte_sans_devis_interdit'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enregistrer_facture_directe(p_id uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.clients%ROWTYPE; f public.factures%ROWTYPE; n integer; copie jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'non_authentifie' USING ERRCODE = '42501'; END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'identifiant_requis'; END IF;
  -- Sérialise une même tentative, même avant la création de la ligne.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT * INTO f FROM public.factures WHERE id = p_id;
  IF FOUND THEN
    IF f.owner_id <> uid OR f.devis_source_id IS NOT NULL OR f.nature <> 'facture' THEN RAISE EXCEPTION 'tentative_non_autorisee' USING ERRCODE='42501'; END IF;
    RETURN public.lire_facture(p_id);
  END IF;
  SELECT * INTO c FROM public.clients WHERE id = (p->>'client_id')::uuid AND owner_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'client_non_autorise' USING ERRCODE='42501'; END IF;
  copie := jsonb_build_object('nom', CASE WHEN c.type = 'entreprise' THEN c.raison_sociale ELSE btrim(c.prenom || ' ' || c.nom) END,
    'contact',CASE WHEN c.type = 'entreprise' THEN c.nom_contact ELSE '' END, 'telephone',c.telephone,'email',c.email,
    'adresse', (SELECT coalesce(jsonb_agg(x.val ORDER BY x.pos),'[]'::jsonb) FROM
       unnest(array[c.adresse,c.complement,btrim(c.code_postal || ' ' || c.ville),c.pays]) WITH ORDINALITY x(val,pos) WHERE btrim(x.val) <> ''));
  INSERT INTO public.compteurs_factures_brouillon(owner_id,dernier) VALUES(uid,1)
    ON CONFLICT(owner_id) DO UPDATE SET dernier=public.compteurs_factures_brouillon.dernier+1 RETURNING dernier INTO n;
  INSERT INTO public.factures(id,owner_id,reference,nature,devis_source_id,devis_source_reference,client_id,client_copie,objet,date_facture)
    VALUES(p_id,uid,'BROUILLON-FAC-' || lpad(n::text,3,'0'),'facture',NULL,NULL,c.id,copie,p->>'objet',(p->>'date_facture')::date);
  -- Réutilise le calcul, les contrôles de lignes et l'enregistrement atomique existants.
  RETURN public.enregistrer_facture(p_id,1,p);
END $$;
REVOKE ALL ON FUNCTION public.enregistrer_facture_directe(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_facture_directe(uuid,jsonb) TO authenticated;
-- Contrôle en lecture : ne crée aucun brouillon et ne consomme aucun numéro.
CREATE OR REPLACE FUNCTION public.facture_directe_disponible()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT auth.uid() IS NOT NULL $$;
REVOKE ALL ON FUNCTION public.facture_directe_disponible() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.facture_directe_disponible() TO authenticated;
COMMIT;
