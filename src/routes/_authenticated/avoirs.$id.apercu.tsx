import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useEtatDocuments } from "@/data/documents";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";
import { ArrowLeft } from "lucide-react";
import { DevisApercu, versPublic } from "@/components/DevisApercu";
import { useEtatEntreprise } from "@/data/entreprise";

export const Route = createFileRoute("/_authenticated/avoirs/$id/apercu")({
  head: () => ({
    meta: [
      { title: "Aperçu de l'avoir brouillon — Les Frères Mayet" },
      { name: "description", content: "Aperçu d'un avoir brouillon non émis." },
      { property: "og:title", content: "Aperçu de l'avoir brouillon — Les Frères Mayet" },
      { property: "og:description", content: "Aperçu d'un avoir brouillon non émis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const etat = useEtatDocuments();
  const doc = etat.brouillons.find((d) => d.id === id && d.type === "avoir");
  const etatEnt = useEtatEntreprise();
  return (
    <AppLayout titre="Aperçu de l'avoir">
      {doc?.devis ? (
        <div className="min-w-0">
          <Button asChild variant="outline" size="sm"><Link to="/avoirs/$id" params={{ id }}><ArrowLeft /> Retour à l'avoir</Link></Button>
          <h1 className="mt-4 text-2xl font-semibold lg:text-3xl">Aperçu de l'avoir</h1>
          <p className="mt-1 text-sm text-muted-foreground">Données enregistrées — brouillon non émis. Pas de PDF à cette étape.</p>
          {etatEnt.statut === "pret" ? (
            <div className="-mx-4 mt-4 bg-neutral-soft px-2 py-4 sm:mx-0 sm:rounded-2xl sm:p-8">
              <DevisApercu devis={versPublic(doc.devis)} numero={doc.numero} entreprise={etatEnt.fiche}
                avoir={{ sourceRef: doc.factureSource?.reference ?? "", motif: doc.motif ?? "" }} />
            </div>
          ) : <p className="mt-4 text-sm text-muted-foreground">{etatEnt.statut === "absente" ? "Enregistrez d'abord les informations de votre entreprise." : "Chargement des informations de l'entreprise…"}</p>}
        </div>
      ) : <EtatBrouillon statut={etat.statut} />}
    </AppLayout>
  );
}
