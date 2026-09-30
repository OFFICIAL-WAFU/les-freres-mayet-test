CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  reference text NOT NULL,
  reference_normalisee text GENERATED ALWAYS AS (lower(btrim(reference, E' \t\r\n'))) STORED,
  type text NOT NULL CHECK (type IN ('materiel','prestation')),
  designation text NOT NULL,
  description text NOT NULL DEFAULT '',
  metier text NOT NULL CHECK (metier IN ('plomberie','electricite','climatisation','general')),
  unite text NOT NULL CHECK (unite IN ('piece','heure','forfait','metre','m2','m3')),
  prix_ht_centimes bigint NOT NULL CHECK (prix_ht_centimes >= 0),
  marque text NOT NULL DEFAULT '',
  reference_fabricant text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  archive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT articles_reference_requise CHECK (btrim(reference, E' \t\r\n') <> ''),
  CONSTRAINT articles_designation_requise CHECK (btrim(designation, E' \t\r\n') <> ''),
  CONSTRAINT articles_reference_unique UNIQUE (owner_id, reference_normalisee)
);
CREATE INDEX articles_owner_created ON public.articles (owner_id, created_at);

REVOKE ALL ON public.articles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture de ses propres articles" ON public.articles FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Création d'articles pour soi-même" ON public.articles FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Modification de ses propres articles" ON public.articles FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER articles_horodatage BEFORE INSERT OR UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.clients_horodatage();