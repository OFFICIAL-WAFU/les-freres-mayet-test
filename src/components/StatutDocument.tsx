import type { DocumentAvecDevis } from "@/data/documents";
import { suiviDocumentClient } from "@/lib/suivi-clients";
import { statutAffiche } from "@/lib/statuts";
import { formaterCentimes } from "@/data/devis";
import { StatutBadge, TONS_STATUT } from "@/components/StatutBadge";

/** L'état du paiement ou la réponse du client est calculé ; il ne remplace jamais le statut d'émission. */
export function StatutDocument({ document: d }: { document: DocumentAvecDevis }) {
  const affiche = statutAffiche(d);
  const s = suiviDocumentClient(d);
  if (!s || affiche === "Annulée" || affiche === "Annulé") return <StatutBadge statut={affiche} />;
  const couleur = s.retard ? TONS_STATUT.alerte : s.reste > 0n ? TONS_STATUT.attente : TONS_STATUT.valide;
  const label = s.retard ? "En retard" : s.etat === "Non réglée" ? "En attente de paiement" : s.etat === "Réglée" ? (d.type === "acompte" ? "Payé" : "Payée") : s.etat;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${couleur}`} title={`Document finalisé · Reste à régler : ${formaterCentimes(s.reste)}`}>
    {label}
  </span>;
}
