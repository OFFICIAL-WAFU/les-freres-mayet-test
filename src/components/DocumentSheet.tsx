import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AvoirDetail } from "@/components/AvoirDetail";
import { DevisDetail } from "@/components/DevisDetail";
import { TYPE_LABELS, formaterMontant, useDocuments, type DocumentAvecDevis } from "@/data/documents";

/** Panneau de consultation d'un document (étape 1), partagé entre Documents et Clients. */
export function DocumentSheet({
  document: docInitial,
  onClose,
}: {
  document: DocumentAvecDevis | null;
  onClose: () => void;
}) {
  // Version à jour (ex. après un règlement) : la liste partagée est rechargée, la fiche suit.
  const liste = useDocuments();
  const doc = docInitial ? (liste.find((x) => x.id === docInitial.id) ?? docInitial) : null;
  return (
    <Sheet open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{doc?.numero}</SheetTitle>
          <SheetDescription>
            {doc?.devis
              ? `${doc.type === "avoir" ? "Avoir" : doc.type === "acompte" ? "Facture d'acompte" : doc.type === "facture" ? "Facture" : "Devis"} — ${doc.devis.objet}`
              : "Document de démonstration — contenu détaillé à construire."}
          </SheetDescription>
        </SheetHeader>
        {doc?.devis && (
          <div className="mt-6">
            {doc.type === "avoir" ? <AvoirDetail doc={doc} onNavigate={onClose} /> : <DevisDetail doc={doc} />}
          </div>
        )}
        {doc && !doc.devis && (
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
              <dd className="font-medium">{formaterMontant(doc.montantTTC)}{doc.deduction?.statut === "finalise" && <span className="ml-1 text-xs font-normal text-muted-foreground">(solde, acompte déduit)</span>}</dd>
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
