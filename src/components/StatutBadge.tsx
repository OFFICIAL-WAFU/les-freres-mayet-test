import { cn } from "@/lib/utils";
import { tonDuStatut, type DocumentStatut } from "@/data/documents";

const CLASSES: Record<string, string> = {
  neutre: "bg-neutral-soft text-muted-foreground border-border",
  attente: "bg-warning-soft text-accent border-accent/30",
  valide: "bg-success-soft text-success border-success/30",
  info: "bg-info-soft text-primary border-primary/20",
};

export function StatutBadge({ statut, libelle }: { statut: DocumentStatut; libelle?: string }) {
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
