/**
 * Mentions obligatoires des factures (décision de Baptiste du 08/11/2026).
 * Pénalités de retard et indemnité forfaitaire de recouvrement (articles L441-10 et D441-5 du Code de commerce) :
 * affichées sur l'aperçu et le PDF des factures et des factures d'acompte (jamais sur les devis ni les avoirs).
 * Toujours sur les brouillons ; sur un document finalisé, seulement s'il est daté du 08/11/2026 ou après : les factures déjà émises restent telles qu'elles ont été envoyées.
 * Si les remarques contiennent déjà une mention de pénalités (bibliothèque de mentions), rien n'est ajouté.
 */
export const MENTION_RETARD =
  "En cas de retard de paiement, des pénalités sont exigibles au taux de trois fois le taux d'intérêt légal (article L441-10 du Code de commerce). " +
  "Pour les clients professionnels, une indemnité forfaitaire de 40 € pour frais de recouvrement est également due (article D441-5 du Code de commerce). " +
  "Pas d'escompte en cas de paiement anticipé.";
export const DEBUT_MENTION_RETARD = "2026-11-08";

export function mentionRetard(o: { facture: boolean; avoir: boolean; finalise: boolean; date: string; remarques: string }): string | null {
  if (!o.facture || o.avoir) return null;
  if (o.finalise && (!/^\d{4}-\d{2}-\d{2}$/.test(o.date) || o.date < DEBUT_MENTION_RETARD)) return null;
  if (/p[ée]nalit[ée]s?\s+de\s+retard|retard\s+de\s+paiement/i.test(o.remarques)) return null;
  return MENTION_RETARD;
}

/** Date de réalisation : obligatoire sur une facture ordinaire (pas sur un acompte). */
export const MSG_DATE_REALISATION = "Indiquez la date de réalisation des prestations (obligatoire sur une facture).";
