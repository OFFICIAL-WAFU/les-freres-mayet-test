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

## 20261104230000_historique_natif.sql — appliquée (TEST et PRODUCTION)
L'historique Khosmos devient de vrais documents : colonnes `lot_import` (réservées à l'outil de reprise), réponse du
client sur les devis (`reponse_client` attente/accepte/refuse, `reponse_le`, `reponse_mode`, RPC `noter_reponse_devis`,
signature à distance → accepté), unicité devis/nature limitée aux documents de l'application, et recherche de
« l'acompte du devis » qui ignore les acomptes annulés par avoir (`facture_annulee`).

## 20261105200000_rentabilite_devis.sql — appliquée (TEST et PRODUCTION, 05/11/2026, ne pas rejouer)
Rentabilité des devis : sur chaque ligne de devis, prix d'achat, coefficient matériel, temps de pose, taux horaire vendu,
coût horaire figé et « prix calculé » (colonnes facultatives, informations internes) ; réglages par défaut dans
habitudes_documents (coefficient 1,6, coût réel 25 €/h, taux vendu 50 €/h — décision de Baptiste du 05/11/2026) ;
enregistrer_brouillon recopiée à l'identique avec ces colonnes en plus. Montants, verrous, factures et projection de
signature inchangés. Contrôles : `verification-rentabilite-sql.mjs` (9) et `verification-rentabilite.mjs`. Avant
installation en production : relire la définition de enregistrer_brouillon en production (pg_get_functiondef) et vérifier
qu'elle est identique à celle de TEST d'avant migration (md5 daf1b5290ac72962fdd7bd25974dfaca).
## 20261105210000_commande_passee.sql — appliquée (TEST et PRODUCTION)
Suivi des devis : colonne `commande_passee_le` (seulement sur un devis signé), RPC `noter_commande_devis`, et
`noter_reponse_devis` qui garde la date de signature et efface la commande si le devis repasse en attente ou refusé.
