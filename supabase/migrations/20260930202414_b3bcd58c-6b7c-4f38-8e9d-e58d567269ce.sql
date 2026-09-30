CREATE TABLE public.entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  raison_sociale text NOT NULL,
  nom_commercial text NOT NULL DEFAULT '',
  activite text NOT NULL DEFAULT '',
  adresse text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  code_postal text NOT NULL DEFAULT '',
  ville text NOT NULL DEFAULT '',
  pays text NOT NULL DEFAULT '',
  telephone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  site text NOT NULL DEFAULT '',
  forme_juridique text NOT NULL DEFAULT '',
  capital numeric(15,2),
  siret text NOT NULL DEFAULT '',
  tva text NOT NULL DEFAULT '',
  immatriculation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entreprises_un_par_proprietaire UNIQUE (owner_id),
  CONSTRAINT entreprises_raison_sociale_requise CHECK (btrim(raison_sociale) <> ''),
  CONSTRAINT entreprises_siret_format CHECK (siret = '' OR siret ~ '^[0-9]{14}$'),
  CONSTRAINT entreprises_capital_positif CHECK (capital IS NULL OR capital >= 0),
  CONSTRAINT entreprises_email_format CHECK (email = '' OR email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT entreprises_site_format CHECK (site = '' OR site ~* '^https?://')
);
GRANT SELECT, INSERT, UPDATE ON public.entreprises TO authenticated;
GRANT ALL ON public.entreprises TO service_role;
REVOKE ALL ON public.entreprises FROM anon;
REVOKE DELETE, TRUNCATE ON public.entreprises FROM authenticated;
ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture de sa propre fiche entreprise" ON public.entreprises FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Création de sa fiche entreprise" ON public.entreprises FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Modification de sa fiche entreprise" ON public.entreprises FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER entreprises_horodatage BEFORE INSERT OR UPDATE ON public.entreprises FOR EACH ROW EXECUTE FUNCTION public.clients_horodatage();