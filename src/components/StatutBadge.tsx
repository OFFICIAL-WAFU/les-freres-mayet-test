import { cn } from "@/lib/utils";
import { tonDuStatut, type DocumentStatut } from "@/data/documents";

/**
 * Audit 14/11/2026 : texte foncé sur fond pâle (contraste ≥ 4,5:1, lisible au soleil) et plus d'orange vif dans les statuts :
 * l'orange est réservé aux boutons d'action (« Créer », « Encaisser »). Classes partagées avec StatutDocument.
 */
export const TONS_STATUT = {
  neutre: "bg-neutral-soft text-neutral-ink border-neutral-line",
  attente: "bg-warning-soft text-warning-ink border-warning-line",
  valide: "bg-success-soft text-success-ink border-success-line",
  info: "bg-info-soft text-info-ink border-info-line",
  alerte: "bg-danger-soft text-danger-ink border-danger-line",
} as const;
const CLASSES: Record<string, string> = TONS_STATUT;

export function StatutBadge({ statut, libelle }: { statut: DocumentStatut; libelle?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        CLASSES[tonDuStatut(statut)],
      )}
    >
      {libelle ?? statut}
    </span>
  );
}
