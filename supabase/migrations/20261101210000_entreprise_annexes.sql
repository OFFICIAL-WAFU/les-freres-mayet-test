-- Annexes de la fiche Entreprise : coordonnées bancaires, assurance, logo, CGV, bandeau.
-- Additive (nouvelles colonnes avec valeur par défaut vide) : aucune donnée existante n'est modifiée.
-- Ces champs sont copiés avec le reste de la fiche dans entreprise_copie à la finalisation (to_jsonb(e)) :
-- un document finalisé garde donc les coordonnées bancaires, le logo et les CGV de son époque.
ALTER TABLE public.entreprises
  ADD COLUMN IF NOT EXISTS iban text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bic text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assureur text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contrat_assurance text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS code_naf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS regime_tva text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bandeau text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cgv text NOT NULL DEFAULT '';
ALTER TABLE public.entreprises
  ADD CONSTRAINT entreprises_iban_format CHECK (iban = '' OR iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  ADD CONSTRAINT entreprises_bic_format CHECK (bic = '' OR bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  ADD CONSTRAINT entreprises_assureur_long CHECK (char_length(assureur) <= 200),
  ADD CONSTRAINT entreprises_contrat_long CHECK (char_length(contrat_assurance) <= 100),
  ADD CONSTRAINT entreprises_naf_long CHECK (char_length(code_naf) <= 20),
  ADD CONSTRAINT entreprises_regime_tva_long CHECK (char_length(regime_tva) <= 200),
  ADD CONSTRAINT entreprises_bandeau_long CHECK (char_length(bandeau) <= 200),
  ADD CONSTRAINT entreprises_logo_format CHECK (logo = '' OR (logo ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$' AND char_length(logo) <= 300000)),
  ADD CONSTRAINT entreprises_cgv_long CHECK (char_length(cgv) <= 60000);
