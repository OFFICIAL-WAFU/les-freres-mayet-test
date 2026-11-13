-- Remise sur facture (13/11/2026, demande de Baptiste) : ligne « REMISE » à prix négatif, sur les factures uniquement.
--
-- 1. Arrondi au centime « demi éloigné de zéro » (public.arrondi_millieme). Pour un nombre positif le résultat est
--    STRICTEMENT identique à l'ancien calcul (n*2+1000)/2000 : aucune facture existante ne change.
--    Pour un nombre négatif, l'ancien calcul (division entière tronquée) donnait 1 centime de trop.
-- 2. Contrainte des lignes : prix >= 0, OU ligne de remise = prestation libre, forfait, quantité 1, désignation « REMISE… ».
-- 3. Déclencheur des lignes : remise refusée sur un acompte ; calcul HT/TVA avec le nouvel arrondi.
-- 4. Finalisation : même arrondi pour le contrôle des montants ; refus si la remise dépasse les lignes d'un taux de TVA.
-- Inchangé : avoirs (une remise n'est pas créditable en avoir partiel ; l'avoir total recopie toutes les lignes ; plafond
-- = montant de la facture), acomptes, déduction d'acompte, devis (devis_lignes garde prix >= 0).
--
-- Sécurité : chaque fonction n'est modifiée que si sa définition actuelle a l'empreinte relevée le 13/11/2026
-- (identique en TEST et en PRODUCTION) ; sinon la migration s'arrête sans rien changer.
-- Retour arrière : voir le bas du fichier.

BEGIN;

CREATE OR REPLACE FUNCTION public.arrondi_millieme(n bigint) RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT CASE WHEN n >= 0 THEN (n * 2 + 1000) / 2000 ELSE -(((-n) * 2 + 1000) / 2000) END
$$;
REVOKE ALL ON FUNCTION public.arrondi_millieme(bigint) FROM anon;

ALTER TABLE public.factures_lignes DROP CONSTRAINT factures_lignes_prix_ht_centimes_check;
ALTER TABLE public.factures_lignes ADD CONSTRAINT factures_lignes_prix_ou_remise CHECK (
  prix_ht_centimes >= 0
  OR (type = 'prestation' AND article_id IS NULL AND unite = 'forfait' AND quantite_milliemes = 1000 AND upper(btrim(designation)) LIKE 'REMISE%')
);

DO $migration$
DECLARE d text; avant text;
BEGIN
  -- factures_lignes_calculer ------------------------------------------------------------------------------------
  d := pg_get_functiondef('public.factures_lignes_calculer()'::regprocedure);
  IF md5(d) <> '79141899461b6cec65a2b25c07069f4e' THEN RAISE EXCEPTION 'factures_lignes_calculer : définition inattendue, migration arrêtée'; END IF;
  avant := d;
  d := replace(d,
    E'  NEW.ht_centimes := (NEW.quantite_milliemes * NEW.prix_ht_centimes * 2 + 1000) / 2000;\n  NEW.tva_centimes := (NEW.ht_centimes * NEW.taux_tva_milliemes * 2 + 1000) / 2000;',
    E'  IF NEW.prix_ht_centimes < 0 AND NOT EXISTS (SELECT 1 FROM public.factures f WHERE f.id = NEW.facture_id AND f.nature = ''facture'') THEN\n    RAISE EXCEPTION ''remise_non_autorisee'' USING ERRCODE = ''23514'';\n  END IF;\n  NEW.ht_centimes := public.arrondi_millieme(NEW.quantite_milliemes * NEW.prix_ht_centimes);\n  NEW.tva_centimes := public.arrondi_millieme(NEW.ht_centimes * NEW.taux_tva_milliemes);');
  IF d = avant THEN RAISE EXCEPTION 'factures_lignes_calculer : remplacement non appliqué'; END IF;
  EXECUTE d;

  -- finaliser_facture -------------------------------------------------------------------------------------------
  d := pg_get_functiondef('public.finaliser_facture(uuid, integer)'::regprocedure);
  IF md5(d) <> '700d145d6ca11ea61fa5729695d7e59e' THEN RAISE EXCEPTION 'finaliser_facture : définition inattendue, migration arrêtée'; END IF;
  avant := d;
  d := replace(d,
    E'count(*) FILTER (WHERE ht_centimes <> (quantite_milliemes * prix_ht_centimes * 2 + 1000) / 2000\n      OR tva_centimes <> (ht_centimes * taux_tva_milliemes * 2 + 1000) / 2000 OR ttc_centimes <> ht_centimes + tva_centimes)',
    E'count(*) FILTER (WHERE ht_centimes <> public.arrondi_millieme(quantite_milliemes * prix_ht_centimes)\n      OR tva_centimes <> public.arrondi_millieme(ht_centimes * taux_tva_milliemes) OR ttc_centimes <> ht_centimes + tva_centimes)');
  d := replace(d,
    E'    RAISE EXCEPTION ''montants_incoherents'' USING ERRCODE = ''23514'';\n  END IF;\n  IF f.nature = ''acompte'' THEN',
    E'    RAISE EXCEPTION ''montants_incoherents'' USING ERRCODE = ''23514'';\n  END IF;\n  IF EXISTS (SELECT 1 FROM public.factures_lignes WHERE facture_id = p_id GROUP BY taux_tva_milliemes HAVING sum(ht_centimes) < 0 OR sum(tva_centimes) < 0) THEN\n    RAISE EXCEPTION ''remise_superieure'' USING ERRCODE = ''23514'';\n  END IF;\n  IF f.nature = ''acompte'' THEN');
  IF d = avant OR position('remise_superieure' in d) = 0 OR position('arrondi_millieme' in d) = 0 THEN
    RAISE EXCEPTION 'finaliser_facture : remplacement non appliqué'; END IF;
  EXECUTE d;
END $migration$;

COMMIT;

-- Retour arrière (seulement s'il n'existe AUCUNE ligne à prix négatif) :
--   la contrainte d'origine est CHECK (prix_ht_centimes >= 0) ; les deux fonctions d'origine sont dans
--   supabase/migrations/20261006121253_732d64b3-877c-4a77-8301-a6b134b70b02.sql et 20261006122118_2cbc2828-5fd9-47e8-883c-f264765e6934.sql
--   (vérifier leur empreinte md5 ci-dessus après restauration).
