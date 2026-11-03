import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DevisDetail } from "@/components/DevisDetail";
import { Button } from "@/components/ui/button";
import { useEtatDocuments } from "@/data/documents";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";

export const Route = createFileRoute("/_authenticated/devis/$id/")({
  head: () => ({
    meta: [
      { title: "Brouillon de devis — Les Frères Mayet" },
      { name: "description", content: "Consulter un brouillon de devis enregistré." },
      { property: "og:title", content: "Brouillon de devis — Les Frères Mayet" },
      { property: "og:description", content: "Consulter un brouillon de devis enregistré." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const etatDocs = useEtatDocuments();
  const doc = etatDocs.brouillons.find((d) => d.id === id && d.type === "devis");
  return (
    <AppLayout titre={doc?.statut === "Finalisé" ? "Devis" : "Brouillon de devis"}>
      {doc?.devis ? (
        <div className="max-w-3xl">
          <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/">← Documents</Link></Button>
          <h1 className="text-2xl font-semibold lg:text-3xl">Devis — {doc.devis.objet}</h1>
          <p className="mt-2 text-xs text-muted-foreground">{doc.statut === "Finalisé" ? "Aucun envoi ni signature n'a été effectué depuis l'application." : "Les brouillons enregistrés sont conservés dans votre espace privé."}</p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 lg:p-6">
            <DevisDetail doc={doc} />
          </div>
        </div>
      ) : (
        <EtatBrouillon statut={etatDocs.statut} />
      )}
    </AppLayout>
  );
}
