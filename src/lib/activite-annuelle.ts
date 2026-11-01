import type { DocumentAvecDevis } from "@/data/documents";
import { dateDocumentIso } from "./suivi-clients";
import { dateParis } from "./echeances";

/** Facturation HT par mois d'émission, nette des avoirs émis ; aucun paiement ni archive. */
export function activiteAnnuelle(documents: DocumentAvecDevis[], aujourdHui = dateParis()) {
  const annee = aujourdHui.slice(0, 4);
  const mois = Array<bigint>(12).fill(0n);
  let incomplets = 0;
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé" || !["facture", "acompte", "avoir"].includes(d.type)) continue;
    const date = dateDocumentIso(d.date);
    if (!date) { incomplets++; continue; }
    if (!date.startsWith(annee) || date > aujourdHui) continue;
    if (d.montantHTCentimes === undefined) { incomplets++; continue; }
    const index = Number(date.slice(5,7)) - 1;
    mois[index] = mois[index]! + (d.type === "avoir" ? -d.montantHTCentimes : d.montantHTCentimes);
  }
  return { annee, mois, total: mois.reduce((s,v) => s+v,0n), incomplets };
}
