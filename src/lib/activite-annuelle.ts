import type { DocumentAvecDevis } from "@/data/documents";
import { dateDocumentIso } from "./suivi-clients";
import { dateParis } from "./echeances";
import { ttcBrut, type ModeMontant } from "./montants";

/**
 * Chiffre d'affaires HT par mois d'émission (même calcul que Khosmos) : factures finalisées pour leur montant HT
 * complet (acompte compris), moins les avoirs émis sur ces factures. Les factures d'acompte n'entrent pas dans
 * le chiffre d'affaires : elles sont comptées avec la facture de solde. Aucun paiement n'est pris en compte.
 * En mode TTC, mêmes documents à leur montant TTC complet.
 */
export function activiteAnnuelle(documents: DocumentAvecDevis[], aujourdHui = dateParis(), mode: ModeMontant = "ht") {
  const annee = aujourdHui.slice(0, 4);
  const mois = Array<bigint>(12).fill(0n);
  let incomplets = 0;
  const natureSource = new Map(documents.filter(d => d.type === "facture" || d.type === "acompte").map(d => [d.id, d.type]));
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé") continue;
    if (d.type === "avoir" && natureSource.get(d.factureSource?.id ?? "") !== "facture") continue;
    if (d.type !== "facture" && d.type !== "avoir") continue;
    const date = dateDocumentIso(d.date);
    if (!date) { incomplets++; continue; }
    if (!date.startsWith(annee) || date > aujourdHui) continue;
    if (d.montantHTCentimes === undefined) { incomplets++; continue; }
    const ht = mode === "ttc" ? ttcBrut(d)
      : d.type === "facture" && d.deduction?.statut === "finalise" ? d.montantHTCentimes + d.deduction.ht : d.montantHTCentimes;
    const index = Number(date.slice(5,7)) - 1;
    mois[index] = mois[index]! + (d.type === "avoir" ? -ht : ht);
  }
  return { annee, mois, total: mois.reduce((s,v) => s+v,0n), incomplets };
}
