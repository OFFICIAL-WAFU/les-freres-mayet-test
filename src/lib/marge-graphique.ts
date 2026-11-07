/**
 * Ligne d'achat telle que lue pour le graphique.
 * - facture_id + date_facture : achat rattaché à une facture client → compté au mois de cette facture.
 * - client_id sans facture_id : chantier en cours (pas encore de facture de solde) → exclu de la marge.
 * - sinon (stock, frais généraux, non rattaché) : compté au mois d'achat.
 */
export type AchatGraphique = {
  date_achat: string;
  total_ht_centimes: number | string | null;
  facture_id?: string | null;
  client_id?: string | null;
  date_facture?: string | null;
};

/** Mois (AAAA-MM-JJ) auquel un achat est imputé, ou null s'il appartient à un chantier en cours. */
export function dateImputation(achat: AchatGraphique): string | null {
  if (achat.facture_id) return achat.date_facture ?? achat.date_achat;
  if (achat.client_id) return null;
  return achat.date_achat;
}

/** Le CA est celui des barres en HT, jamais celui d'une vue ni des coûts de devis. */
export function margeGraphique(caHT: readonly bigint[], achats: readonly AchatGraphique[], annee: string) {
  const achatsMois = Array<bigint>(12).fill(0n);
  let enCours = 0n;
  for (const achat of achats) {
    const date = dateImputation(achat);
    if (date === null) {
      if (achat.date_achat.slice(0, 4) === annee) enCours += BigInt(achat.total_ht_centimes ?? 0);
      continue;
    }
    if (date.slice(0, 4) !== annee) continue;
    const i = Number(date.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) achatsMois[i] = (achatsMois[i] ?? 0n) + BigInt(achat.total_ht_centimes ?? 0);
  }
  const ventes = Array.from({ length: 12 }, (_, i) => caHT[i] ?? 0n);
  const marge = ventes.map((ca, i) => ca - (achatsMois[i] ?? 0n));
  const totalVentes = ventes.reduce((s, v) => s + v, 0n);
  const totalAchats = achatsMois.reduce((s, v) => s + v, 0n);
  return { ventes, achats: achatsMois, marge, totalVentes, totalAchats, totalMarge: totalVentes - totalAchats, enCours };
}

/** Une base nulle ne définit pas de taux ; une base négative reste calculable. */
export function tauxMargeGraphique(marge: bigint, ca: bigint): string {
  if (ca === 0n) return "–";
  return `${(Number(marge) / Number(ca) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
