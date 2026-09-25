import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TYPE_LABELS, formaterMontant, type DemoDocument } from "@/data/documents";

/** Panneau de consultation d'un document (étape 1), partagé entre Documents et Clients. */
export function DocumentSheet({
  document: doc,
  onClose,
}: {
  document: DemoDocument | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{doc?.numero}</SheetTitle>
          <SheetDescription>
            Document de démonstration — contenu détaillé à construire.
          </SheetDescription>
        </SheetHeader>
        {doc && (
          <dl className="mt-6 flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-medium">{doc.date}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="font-medium">{doc.client}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium">{TYPE_LABELS[doc.type]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Montant TTC</dt>
              <dd className="font-medium">{formaterMontant(doc.montantTTC)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Statut</dt>
              <dd className="mt-1">
                <StatutBadge statut={doc.statut} />
              </dd>
            </div>
          </dl>
        )}
        <Button variant="outline" className="mt-8 w-full" onClick={onClose}>
          Fermer
        </Button>
      </SheetContent>
    </Sheet>
  );
}
