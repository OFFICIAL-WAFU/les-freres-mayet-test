import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";
import { Button } from "@/components/ui/button";
import { useDocuments } from "@/data/documents";

export const Route = createFileRoute("/devis/$id/modifier")({
  head: () => ({
    meta: [
      { title: "Modifier le brouillon — Les Frères Mayet" },
      { name: "description", content: "Modifier un brouillon de devis de démonstration." },
      { property: "og:title", content: "Modifier le brouillon — Les Frères Mayet" },
      { property: "og:description", content: "Modifier un brouillon de devis de démonstration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const doc = useDocuments().find((d) => d.id === id);
  return (
    <AppLayout titre="Modifier le brouillon">
      {doc?.devis ? (
        <DevisForm key={doc.id} initial={doc.devis} documentId={doc.id} numero={doc.numero} />
      ) : (
        <Introuvable />
      )}
    </AppLayout>
  );
}

export function Introuvable() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-sm font-medium">Ce brouillon est introuvable. Les brouillons de démonstration sont effacés au rechargement.</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/">Retour aux documents</Link></Button>
    </div>
  );
}
