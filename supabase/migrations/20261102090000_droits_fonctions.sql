-- Droits d'exécution : seules la lecture et la signature à distance d'un devis sont ouvertes aux visiteurs non connectés.
-- Toutes les autres fonctions (hors déclencheurs) sont réservées aux utilisateurs connectés.
-- Appliquée sur TEST et sur la production le 02/11/2026.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f' AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.proname IN ('lire_devis_pour_signature', 'signer_devis_distant') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;
