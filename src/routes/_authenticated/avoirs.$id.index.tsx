import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useEtatDocuments } from "@/data/documents";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";
import { AvoirDetail } from "@/components/AvoirDetail";

export const Route = createFileRoute("/_authenticated/avoirs/$id/")({
  head: () => ({
    meta: [
      { title: "Avoir — Les Frères Mayet" },
      { name: "description", content: "Consulter un avoir brouillon préparé depuis une facture." },
      { property: "og:title", content: "Avoir — Les Frères Mayet" },
      { property: "og:description", content: "Consulter un avoir brouillon préparé depuis une facture." },
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
  return (
    <AppLayout titre="Avoir">
      {doc?.devis ? (
        <div className="max-w-3xl">
          <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/">← Documents</Link></Button>
          <h1 className="text-2xl font-semibold lg:text-3xl">{doc.statut === "Finalisé" ? `Avoir ${doc.numero}` : "Avoir brouillon"} — {doc.devis.objet}</h1>
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 lg:p-6"><AvoirDetail doc={doc} /></div>
        </div>
      ) : <EtatBrouillon statut={etat.statut} />}
    </AppLayout>
  );
}
