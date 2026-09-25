CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL CHECK (type IN ('particulier', 'entreprise')),
  prenom text NOT NULL DEFAULT '' CHECK (char_length(prenom) <= 100),
  nom text NOT NULL DEFAULT '' CHECK (char_length(nom) <= 100),
  raison_sociale text NOT NULL DEFAULT '' CHECK (char_length(raison_sociale) <= 200),
  nom_contact text NOT NULL DEFAULT '' CHECK (char_length(nom_contact) <= 100),
  telephone text NOT NULL DEFAULT '' CHECK (char_length(telephone) <= 40),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 255),
  siret text NOT NULL DEFAULT '' CHECK (siret = '' OR siret ~ '^[0-9]{14}$'),
  tva text NOT NULL DEFAULT '' CHECK (char_length(tva) <= 40),
  adresse text NOT NULL DEFAULT '' CHECK (char_length(adresse) <= 200),
  complement text NOT NULL DEFAULT '' CHECK (char_length(complement) <= 200),
  code_postal text NOT NULL DEFAULT '' CHECK (char_length(code_postal) <= 20),
  ville text NOT NULL DEFAULT '' CHECK (char_length(ville) <= 100),
  pays text NOT NULL DEFAULT '' CHECK (char_length(pays) <= 100),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_nom_requis CHECK (
    (type = 'particulier' AND btrim(nom) <> '')
    OR (type = 'entreprise' AND btrim(raison_sociale) <> '')
  )
);

CREATE INDEX clients_owner_idx ON public.clients (owner_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture de ses propres clients" ON public.clients
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Création pour soi-même" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Modification de ses propres clients" ON public.clients
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Dates gérées par le serveur ; propriétaire et date de création immuables.
CREATE OR REPLACE FUNCTION public.clients_horodatage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSE
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Le propriétaire d''une fiche ne peut pas être modifié';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clients_horodatage
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_horodatage();