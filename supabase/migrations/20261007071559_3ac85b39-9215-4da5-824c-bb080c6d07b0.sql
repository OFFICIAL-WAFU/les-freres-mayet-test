ALTER TABLE public.devis ADD COLUMN conditions_paiement text NOT NULL DEFAULT '';
ALTER TABLE public.factures ADD COLUMN conditions_paiement text NOT NULL DEFAULT '',
  ADD COLUMN prestation_debut date, ADD COLUMN prestation_fin date;
ALTER TABLE public.factures ADD CONSTRAINT factures_periode_ordre CHECK (prestation_fin IS NULL OR prestation_debut IS NULL OR prestation_fin >= prestation_debut);

DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.enregistrer_brouillon(uuid,integer,jsonb)'::regprocedure);
  d := replace(d, 'date_validite, remarques, notes)', 'date_validite, remarques, notes, conditions_paiement)');
  d := replace(d, 'COALESCE(p->>''notes'',''''));', 'COALESCE(p->>''notes'',''''), COALESCE(p->>''conditions_paiement'',''''));');
  d := replace(d, 'remarques = COALESCE(p->>''remarques'',''''),', 'remarques = COALESCE(p->>''remarques'',''''), conditions_paiement = COALESCE(p->>''conditions_paiement'',''''),');
  IF d !~ 'conditions_paiement\)' OR d !~ 'conditions_paiement =' THEN RAISE EXCEPTION 'patch brouillon'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.enregistrer_facture(uuid,integer,jsonb)'::regprocedure);
  d := replace(d, 'remarques = COALESCE(p->>''remarques'',''''),', 'remarques = COALESCE(p->>''remarques'',''''), conditions_paiement = COALESCE(p->>''conditions_paiement'',''''), prestation_debut = NULLIF(p->>''prestation_debut'','''')::date, prestation_fin = NULLIF(p->>''prestation_fin'','''')::date,');
  IF d !~ 'prestation_fin =' THEN RAISE EXCEPTION 'patch facture'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.enregistrer_acompte(uuid,integer,jsonb)'::regprocedure);
  d := replace(d, 'remarques = COALESCE(p->>''remarques'',''''),', 'remarques = COALESCE(p->>''remarques'',''''), conditions_paiement = COALESCE(p->>''conditions_paiement'',''''),');
  IF d !~ 'conditions_paiement =' THEN RAISE EXCEPTION 'patch acompte'; END IF;
  EXECUTE d;
END $mig$;