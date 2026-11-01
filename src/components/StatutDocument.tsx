import type { DocumentAvecDevis } from "@/data/documents";
import { suiviDocumentClient } from "@/lib/suivi-clients";
import { formaterCentimes } from "@/data/devis";
import { StatutBadge } from "@/components/StatutBadge";

/** L'état du paiement est calculé ; il ne remplace jamais le statut d'émission. */
export function StatutDocument({ document: d }: { document: DocumentAvecDevis }) {
  const s = suiviDocumentClient(d);
  if (!s) return <StatutBadge statut={d.statut} />;
  const couleur = s.retard ? "bg-rose-100 text-rose-700 border-rose-200" : s.reste > 0n ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-teal-100 text-teal-700 border-teal-200";
  const label = s.retard ? "En retard" : s.etat === "Non réglée" ? "En attente de paiement" : s.etat === "Réglée" ? "Payée" : s.etat;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${couleur}`} title={`Document finalisé · Reste à régler : ${formaterCentimes(s.reste)}`}>
    {label}
  </span>;
}
