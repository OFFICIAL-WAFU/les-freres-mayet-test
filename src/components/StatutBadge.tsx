import { cn } from "@/lib/utils";
import { tonDuStatut, type DocumentStatut } from "@/data/documents";

/**
 * Audit 14/11/2026 : texte foncé sur fond pâle (contraste ≥ 4,5:1, lisible au soleil) et plus d'orange vif dans les statuts :
 * l'orange est réservé aux boutons d'action (« Créer », « Encaisser »). Classes partagées avec StatutDocument.
 */
export const TONS_STATUT = {
  neutre: "bg-stone-100 text-stone-700 border-stone-200",
  attente: "bg-amber-50 text-amber-900 border-amber-300",
  valide: "bg-emerald-50 text-emerald-800 border-emerald-200",
  info: "bg-sky-50 text-sky-900 border-sky-200",
  alerte: "bg-rose-50 text-rose-800 border-rose-200",
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
