import type { DocumentAvecDevis } from "@/data/documents";

/** Affichage des montants des statistiques : toutes taxes comprises ou hors taxes. */
export type ModeMontant = "ttc" | "ht";

/** Montants complets du document (avant déduction d'un acompte), en centimes. */
export function totauxBruts(d: DocumentAvecDevis): { ht: bigint; ttc: bigint } | null {
  if (d.montantHTCentimes === undefined || d.montantTTC === null) return null;
  if ((d.type === "facture" || d.type === "acompte") && d.aRegler !== undefined) {
    const ded = d.deduction?.statut === "finalise" ? d.deduction : undefined;
    return { ht: d.montantHTCentimes + (ded?.ht ?? 0n), ttc: d.aRegler + (ded?.ttc ?? 0n) };
  }
  return { ht: d.montantHTCentimes, ttc: BigInt(Math.round(d.montantTTC * 100)) };
}

/** TTC complet du document (avant déduction d'acompte). */
export const ttcBrut = (d: DocumentAvecDevis) => totauxBruts(d)?.ttc ?? BigInt(Math.round((d.montantTTC ?? 0) * 100));

/**
 * Convertit un montant TTC portant sur un document (reste à payer, règlement, total…) dans le mode demandé.
 * En HT, la part hors taxes suit la proportion HT/TTC du document, arrondie au centime le plus proche.
 */
export function enMode(d: DocumentAvecDevis, ttc: bigint, mode: ModeMontant): bigint {
  if (mode === "ttc" || ttc === 0n) return ttc;
  const t = totauxBruts(d);
  if (!t || t.ttc === 0n) return ttc;
  if (ttc === t.ttc) return t.ht;
  // Net à payer d'une facture de solde (acompte déduit) : HT exact enregistré.
  if (d.deduction?.statut === "finalise" && d.aRegler !== undefined && ttc === d.aRegler && d.montantHTCentimes !== undefined) return d.montantHTCentimes;
  const n = ttc * t.ht * 2n, q = t.ttc * 2n;
  return n >= 0n ? (n + t.ttc) / q : -((-n + t.ttc) / q);
}

export const LIBELLE_MODE: Record<ModeMontant, string> = { ttc: "TTC", ht: "HT" };
