# Migrations en attente

Ce dossier contient des migrations validées dans une base temporaire mais **pas encore appliquées** à la base TEST.
Elles sont volontairement hors de `supabase/migrations/` pour qu'aucune synchronisation ne les applique par surprise.

Pour installer : relire le fichier, l'appliquer sur la base TEST (Lovable > Cloud > SQL, ou demander à Claude), puis le
déplacer dans `supabase/migrations/` avec le même nom.

- `20261101150000_signature_devis_distante.sql` : signature à distance des devis — **déjà appliquée** sur TEST le 01/11/2026 (ne pas rejouer).
- `20261101200000_avoirs_partiels.sql` : avoirs partiels (plusieurs avoirs par facture, plafond = montant de la facture). Testée par `verification-avoirs-partiels-sql.mjs` (17 contrôles). **À installer seulement après accord de Baptiste** : elle modifie preparer_avoir, finaliser_avoir et le déclencheur avoirs_garde. Les 4 avoirs existants deviennent « total » sans changement. Retour arrière : la migration ne supprime aucune donnée ; avant installation, sauvegarde conseillée de la table avoirs.
- `20261103220000_accueil_donnees.sql` : accueil des données reprises de Khosmos (lots d'import, prix d'achat/famille/fournisseur, ouvrages, code client d'origine, documents historiques figés avec leur numéro d'origine, numérotation D/F/A AAAA-NNNNN, modèles de devis, connaissances métier). **Appliquée sur TEST le 03/11/2026** avec l'accord de Baptiste, après 17 contrôles réussis dans une transaction annulée (`verification-accueil-donnees.sql`). **Appliquée en PRODUCTION le 04/11/2026** (structure identique à TEST vérifiée par empreinte). Ne pas rejouer.
- `20261103233000_numerotation_khosmos.sql` : correctif de la précédente. La vraie numérotation Khosmos (lue dans ses données) est un simple numéro continu par série : Devis n°218, Facture n°111 (acomptes inclus), Avoir n°17. Le nouveau logiciel continue la série (n°219, n°112, n°18), sans remise à zéro annuelle (compteur annee = 0). **Appliquée sur TEST le 03/11/2026 et en PRODUCTION le 04/11/2026**. Après `20261103220000_accueil_donnees.sql`.
- `20261104100000_habitudes_documents.sql` : pré-remplissage des habitudes (validité 30 j, échéance 7 j, mentions). **Appliquée sur TEST et en PRODUCTION le 04/11/2026**.
