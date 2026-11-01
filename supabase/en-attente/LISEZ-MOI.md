# Migrations hors dossier `migrations/`

Ces migrations ont été validées dans une base temporaire. Elles sont rangées ici pour qu'aucune synchronisation ne les rejoue.

- `20261101150000_signature_devis_distante.sql` : signature à distance des devis (voir src/data/AGENTS.md).
  **Appliquée sur la base TEST le 1er novembre 2026** (vérifiée sur la vraie base : droits, lecture anonyme, création, signature,
  tout annulé ensuite par rollback). **Ne pas la rejouer.** Avant toute installation sur une autre base, la relire.
