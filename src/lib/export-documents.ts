import { TYPE_LABELS, type DocumentAvecDevis } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { suiviEcheance } from "@/lib/echeances";

import { celluleCsv } from "./csv";
export { celluleCsv } from "./csv";

function euros(centimes: bigint): string {
  const signe = centimes < 0n ? "-" : "";
  const n = centimes < 0n ? -centimes : centimes;
  return `${signe}${n / 100n},${String(n % 100n).padStart(2, "0")}`;
}

/** Export de suivi, pas un export comptable ni une sauvegarde de la base. */
export function documentsCsv(documents: DocumentAvecDevis[]): string {
  const lignes = [["Date", "Référence", "Type", "Client", "Objet", "Statut", "Montant document TTC EUR", "Montant facturé TTC EUR", "Avoirs finalisés EUR", "Réglé EUR", "Reste à régler EUR", "Crédit client EUR", "État règlement", "Échéance", "Devis source", "Facture source", "Exemple fictif", "Suivi échéance"]];
  for (const d of documents) {
    const paiement = !d.fictif && d.statut === "Finalisé" && (d.type === "facture" || d.type === "acompte") && d.aRegler !== undefined
      ? suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n) : null;
    lignes.push([d.date, d.numero, TYPE_LABELS[d.type], d.client, d.devis?.objet ?? "", d.statut,
      d.montantTTC === null ? "" : d.montantTTC.toFixed(2).replace(".", ","),
      paiement ? euros(paiement.aRegler) : "", paiement ? euros(paiement.credite) : "", paiement ? euros(paiement.regle) : "",
      paiement ? euros(paiement.reste) : "", paiement ? euros(paiement.creditClient) : "", paiement?.etat ?? "",
      d.type === "facture" || d.type === "acompte" ? d.devis?.validite ?? "" : "", d.devisSource?.reference ?? "", d.factureSource?.reference ?? "", d.fictif ? "Oui" : "Non", paiement ? suiviEcheance(d.devis?.validite, paiement.reste).libelle : ""]);
  }
  return "\uFEFF" + lignes.map(l => l.map(celluleCsv).join(";")).join("\r\n") + "\r\n";
}

export function telechargerDocumentsCsv(documents: DocumentAvecDevis[]): void {
  const url = URL.createObjectURL(new Blob([documentsCsv(documents)], { type: "text/csv;charset=utf-8" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `Suivi_documents_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
