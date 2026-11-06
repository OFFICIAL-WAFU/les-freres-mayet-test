CREATE TABLE public.achats_lignes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 date_achat date NOT NULL,
 fournisseur text NOT NULL DEFAULT '',
 num_facture text NOT NULL DEFAULT '',
 chantier_texte text NOT NULL DEFAULT '',
 client_id uuid REFERENCES public.clients(id),
 facture_id uuid REFERENCES public.factures(id),
 reference text NOT NULL DEFAULT '',
 designation text NOT NULL DEFAULT '',
 metier text NOT NULL DEFAULT 'fournitures' CHECK (metier IN ('plomberie','electricite','climatisation','fournitures','frais','sous_traitance','electromenager')),
 quantite numeric NOT NULL DEFAULT 1,
 unite text NOT NULL DEFAULT '',
 prix_unitaire_ht_centimes bigint NOT NULL DEFAULT 0,
 total_ht_centimes bigint NOT NULL DEFAULT 0,
 statut_affectation text NOT NULL DEFAULT 'a_rapprocher' CHECK (statut_affectation IN ('a_rapprocher','affecte','stock','frais_generaux')),
 lot_import uuid REFERENCES public.lots_import(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achats_lignes TO authenticated;
GRANT ALL ON public.achats_lignes TO service_role;
ALTER TABLE public.achats_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY achats_owner_read ON public.achats_lignes FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY achats_owner_insert ON public.achats_lignes FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.owner_id=auth.uid())) AND (facture_id IS NULL OR EXISTS (SELECT 1 FROM public.factures f WHERE f.id=facture_id AND f.owner_id=auth.uid())) AND (lot_import IS NULL OR EXISTS (SELECT 1 FROM public.lots_import l WHERE l.id=lot_import AND l.owner_id=auth.uid())));
CREATE POLICY achats_owner_update ON public.achats_lignes FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND (client_id IS NULL OR EXISTS (SELECT 1 FROM public.clients c WHERE c.id=client_id AND c.owner_id=auth.uid())) AND (facture_id IS NULL OR EXISTS (SELECT 1 FROM public.factures f WHERE f.id=facture_id AND f.owner_id=auth.uid())) AND (lot_import IS NULL OR EXISTS (SELECT 1 FROM public.lots_import l WHERE l.id=lot_import AND l.owner_id=auth.uid())));
CREATE POLICY achats_owner_delete ON public.achats_lignes FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX achats_owner_date ON public.achats_lignes(owner_id,date_achat);
CREATE VIEW public.marge_mensuelle WITH (security_invoker = on) AS
WITH mouvements AS (
 SELECT owner_id,to_char(date_facture,'YYYY-MM') AS mois,
 (total_ht_centimes - CASE WHEN nature='facture' THEN COALESCE((deduction->>'ht')::bigint,0) ELSE 0 END)::numeric AS ca,0::numeric AS achats
 FROM public.factures WHERE statut='finalise' AND nature IN ('facture','acompte')
 UNION ALL
 SELECT owner_id,to_char(date_avoir,'YYYY-MM'),-total_ht_centimes::numeric,0::numeric FROM public.avoirs WHERE statut='finalise'
 UNION ALL
 SELECT owner_id,to_char(date_achat,'YYYY-MM'),0::numeric,total_ht_centimes::numeric FROM public.achats_lignes
)
SELECT owner_id,mois,SUM(ca) AS ca_ht_centimes,SUM(achats) AS achats_ht_centimes,SUM(ca)-SUM(achats) AS marge_centimes FROM mouvements GROUP BY owner_id,mois;
GRANT SELECT ON public.marge_mensuelle TO authenticated;
GRANT ALL ON public.marge_mensuelle TO service_role;