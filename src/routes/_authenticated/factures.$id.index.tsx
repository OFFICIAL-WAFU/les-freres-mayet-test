import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DevisDetail } from "@/components/DevisDetail";
import { Button } from "@/components/ui/button";
import { useEtatDocuments } from "@/data/documents";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";

export const Route = createFileRoute("/_authenticated/factures/$id/")({
  validateSearch: (s: Record<string, unknown>): { encaisser?: boolean } => (s["encaisser"] === true || s["encaisser"] === "true" || s["encaisser"] === 1 ? { encaisser: true } : {}),
  head: () => ({
    meta: [
      { title: "Facture — Les Frères Mayet" },
      { name: "description", content: "Consulter une facture brouillon préparée depuis un devis." },
      { property: "og:title", content: "Facture — Les Frères Mayet" },
      { property: "og:description", content: "Consulter une facture brouillon préparée depuis un devis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { encaisser } = Route.useSearch();
  const etat = useEtatDocuments();
  const doc = etat.brouillons.find((d) => d.id === id && (d.type === "facture" || d.type === "acompte"));
  return (
    <AppLayout titre={doc?.statut === "Finalisé" ? "Facture" : "Facture brouillon"}>
      {doc?.devis ? (
        <div className="max-w-3xl">
          <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/">← Documents</Link></Button>
          <h1 className="text-2xl font-semibold lg:text-3xl">{doc.type === "acompte" ? (doc.statut === "Finalisé" ? `Facture d'acompte ${doc.numero}` : "Facture d'acompte brouillon") : doc.statut === "Finalisé" ? `Facture ${doc.numero}` : "Facture brouillon"} — {doc.devis.objet}</h1>
          <p className="mt-2 text-xs text-muted-foreground">Aucune facture n'a été envoyée depuis l'application.</p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 lg:p-6">
            <DevisDetail doc={doc} encaisser={!!encaisser} />
          </div>
        </div>
      ) : (
        <EtatBrouillon statut={etat.statut} />
      )}
    </AppLayout>
  );
}
