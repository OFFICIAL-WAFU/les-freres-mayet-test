# Migrations en attente

Ce dossier contient des migrations validées dans une base temporaire mais **pas encore appliquées** à la base TEST.
Elles sont volontairement hors de `supabase/migrations/` pour qu'aucune synchronisation ne les applique par surprise.

Pour installer : relire le fichier, l'appliquer sur la base TEST (Lovable > Cloud > SQL, ou demander à Claude), puis le
déplacer dans `supabase/migrations/` avec le même nom.

- `20261101150000_signature_devis_distante.sql` : signature à distance des devis (voir src/data/AGENTS.md).
