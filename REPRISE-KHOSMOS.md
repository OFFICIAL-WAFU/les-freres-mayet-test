# Reprise des données Khosmos

Réalisée sur la base **TEST** le 03/11/2026 (nuit), avec l'accord de Baptiste. Production non touchée.

## Source
- Khosmos (web.khosmos.fr) lu **en lecture seule** depuis le Chrome de Baptiste, via les appels que l'application fait elle-même
  (`/api/references?mode=team`, `/api/services`, `/api/clients`, `/api/quotes`, `/api/billings`, `/api/credits`, `/api/mentions`, `/api/default-messages`).
  Le serveur limite le débit (HTTP 429) : une requête toutes les 3 s, pause d'une minute en cas de refus.
- Transfert vers la base par une fonction temporaire protégée par une clé à usage unique (empreinte SHA-256 seule stockée),
  supprimée dès réception, ainsi que la table de données brutes.

## Résultat (TEST)
| Élément | Nombre | Contrôle |
|---|---|---|
| Articles + prestations | 362 + 17 | somme des prix identique au centime |
| Clients | 101 (95 déjà présents rattachés par `code_source`, 6 ajoutés) | aucun doublon |
| Devis / factures / acomptes / avoirs | 170 / 94 / 16 / 16 | totaux = export CSV Khosmos (écart total 2 centimes, arrondis Khosmos) |
| Modèles de devis | 8 | à valider |
| Connaissances métier | 20 | statut « a_valider » |

Compteurs calés : prochain devis n°219, facture n°112, avoir n°18.

## Pour la production
1. Appliquer `20261103220000_accueil_donnees.sql` puis `20261103233000_numerotation_khosmos.sql`.
2. Refaire la lecture Khosmos **le jour de la bascule** (pour avoir les derniers numéros), même procédure.
3. `select caler_compteurs_historique(<owner>)`, puis ne plus émettre aucun document dans Khosmos.
