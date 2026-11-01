import type { PieceKhosmos } from "./khosmos";
import { celluleCsv } from "./csv";

const montant = (c: number | null) => c === null ? "" : (c / 100).toFixed(2).replace(".", ",");
/** Inventaire historique, sans reconstitution des règlements ou de la comptabilité. */
export function historiqueCsv(documents: PieceKhosmos[]): string {
  const lignes = [["Référence Khosmos", "Type", "Client", "Date source", "Statut source", "Échéance source", "HT source EUR", "TVA source EUR", "TTC source EUR", "HT PDF EUR", "TVA PDF EUR", "TTC PDF EUR", "Net PDF EUR", "Documents liés", "Fichiers originaux", "Informations de contrôle", "Anomalies"]];
  for (const d of documents) lignes.push([d.ref, d.type, d.client, d.date, d.statut, d.echeance, montant(d.ht), montant(d.tva), montant(d.ttc), montant(d.pdfHt), montant(d.pdfTva), montant(d.pdfTtc), montant(d.net), d.liens.join(" | "), d.sources.join(" | "), d.infos.join(" | "), d.alertes.join(" | ")]);
  return "\uFEFF" + lignes.map(l => l.map(celluleCsv).join(";")).join("\r\n") + "\r\n";
}
