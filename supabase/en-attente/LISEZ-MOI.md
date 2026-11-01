# Migrations en attente

Ce dossier contient des migrations validées dans une base temporaire mais **pas encore appliquées** à la base TEST.
Elles sont volontairement hors de `supabase/migrations/` pour qu'aucune synchronisation ne les applique par surprise.

Pour installer : relire le fichier, l'appliquer sur la base TEST (Lovable > Cloud > SQL, ou demander à Claude), puis le
déplacer dans `supabase/migrations/` avec le même nom.

- `20261101150000_signature_devis_distante.sql` : signature à distance des devis — **déjà appliquée** sur TEST le 01/11/2026 (ne pas rejouer).
- `20261101200000_avoirs_partiels.sql` : avoirs partiels (plusieurs avoirs par facture, plafond = montant de la facture). Testée par `verification-avoirs-partiels-sql.mjs` (17 contrôles). **À installer seulement après accord de Baptiste** : elle modifie preparer_avoir, finaliser_avoir et le déclencheur avoirs_garde. Les 4 avoirs existants deviennent « total » sans changement. Retour arrière : la migration ne supprime aucune donnée ; avant installation, sauvegarde conseillée de la table avoirs.
