export type AchatGraphique = { date_achat: string; total_ht_centimes: number | string | null };

/** Le CA est celui des barres en HT, jamais celui d'une vue ni des coûts de devis. */
export function margeGraphique(caHT: readonly bigint[], achats: readonly AchatGraphique[], annee: string) {
  const achatsMois = Array<bigint>(12).fill(0n);
  for (const achat of achats) {
    if (achat.date_achat.slice(0, 4) !== annee) continue;
    const i = Number(achat.date_achat.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) achatsMois[i] = (achatsMois[i] ?? 0n) + BigInt(achat.total_ht_centimes ?? 0);
  }
  const ventes = Array.from({ length: 12 }, (_, i) => caHT[i] ?? 0n);
  const marge = ventes.map((ca, i) => ca - (achatsMois[i] ?? 0n));
  const totalVentes = ventes.reduce((s, v) => s + v, 0n);
  const totalAchats = achatsMois.reduce((s, v) => s + v, 0n);
  return { ventes, achats: achatsMois, marge, totalVentes, totalAchats, totalMarge: totalVentes - totalAchats };
}

/** Une base nulle ne définit pas de taux ; une base négative reste calculable. */
export function tauxMargeGraphique(marge: bigint, ca: bigint): string {
  if (ca === 0n) return "–";
  return `${(Number(marge) / Number(ca) * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}