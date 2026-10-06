import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Info, Loader2 } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { DevisApercu, versPublic } from "@/components/DevisApercu";
import { Button } from "@/components/ui/button";
import { FacturePdfBouton } from "@/components/FacturePdfBouton";
import { useEtatDocuments } from "@/data/documents";
import { chargerEntreprise, useEtatEntreprise } from "@/data/entreprise";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";

export const Route = createFileRoute("/_authenticated/factures/$id/apercu")({
  head: () => ({
    meta: [
      { title: "Aperçu de la facture brouillon — Les Frères Mayet" },
      { name: "description", content: "Aperçu d'une facture brouillon non émise." },
      { property: "og:title", content: "Aperçu de la facture brouillon — Les Frères Mayet" },
      { property: "og:description", content: "Aperçu d'une facture brouillon non émise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const etatEnt = useEtatEntreprise();
  const etat = useEtatDocuments();
  const doc = etat.brouillons.find((d) => d.id === id && (d.type === "facture" || d.type === "acompte"));
  const finalisee = doc?.statut === "Finalisé";
  const entreprise = finalisee ? doc?.entrepriseFigee ?? null : etatEnt.statut === "pret" ? etatEnt.fiche : null;

  return (
    <AppLayout titre="Aperçu de la facture">
      {doc?.devis ? (
        <div className="min-w-0">
          <Button asChild variant="outline" size="sm">
            <Link to="/factures/$id" params={{ id }}><ArrowLeft /> Retour à la facture</Link>
          </Button>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold lg:text-3xl">Aperçu de la facture</h1>
              <p className="mt-1 text-sm text-muted-foreground">{finalisee ? `Facture finalisée ${doc.numero} — données figées.` : "Données enregistrées — brouillon non émis."}</p>
            </div>
            <FacturePdfBouton doc={doc} />
          </div>
          {!finalisee && (etatEnt.statut === "inactif" || etatEnt.statut === "chargement") && (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement des informations de l'entreprise…</p>
          )}
          {!finalisee && etatEnt.statut === "erreur" && (
            <div role="alert" className="mt-4 flex flex-col gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm sm:flex-row sm:items-center">
              <p className="flex-1">Les informations de l'entreprise n'ont pas pu être chargées.</p>
              <Button size="sm" variant="outline" onClick={() => void chargerEntreprise()}>Réessayer</Button>
            </div>
          )}
          {!finalisee && etatEnt.statut === "absente" && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm sm:flex-row sm:items-center">
              <Info className="size-4 shrink-0 text-muted-foreground" />
              <p className="flex-1">Enregistrez d'abord les informations de votre entreprise pour afficher l'aperçu.</p>
              <Button asChild size="sm" variant="outline"><Link to="/entreprise">Aller à Entreprise</Link></Button>
            </div>
          )}
          {entreprise && (
            <div className="-mx-4 mt-4 bg-neutral-soft px-2 py-4 sm:mx-0 sm:rounded-2xl sm:p-8">
              <DevisApercu
                devis={versPublic(doc.devis)}
                numero={doc.numero}
                entreprise={entreprise}
                facture={{ sourceRef: doc.devisSource?.reference ?? "", finalisee, ...(doc.pourcentage !== undefined ? { acompte: doc.pourcentage } : {}), ...(doc.deduction ? { deduction: doc.deduction } : {}) }}
              />
            </div>
          )}
        </div>
      ) : (
        <EtatBrouillon statut={etat.statut} />
      )}
    </AppLayout>
  );
}
