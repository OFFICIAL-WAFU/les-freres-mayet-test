import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Info } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { DevisApercu, versPublic } from "@/components/DevisApercu";
import { Button } from "@/components/ui/button";
import { useDocuments } from "@/data/documents";
import { useEntreprise } from "@/data/entreprise";
import { Introuvable } from "./devis.$id.modifier";

export const Route = createFileRoute("/devis/$id/apercu")({
  head: () => ({
    meta: [
      { title: "Aperçu du devis — Les Frères Mayet" },
      { name: "description", content: "Aperçu d'un brouillon de devis de démonstration." },
      { property: "og:title", content: "Aperçu du devis — Les Frères Mayet" },
      { property: "og:description", content: "Aperçu d'un brouillon de devis de démonstration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const entreprise = useEntreprise();
  const doc = useDocuments().find((d) => d.id === id);
  return (
    <AppLayout titre="Aperçu du devis">
      {doc?.devis ? (
        <div className="min-w-0">
          <Button asChild variant="outline" size="sm">
            <Link to="/devis/$id" params={{ id }}><ArrowLeft /> Retour au brouillon</Link>
          </Button>
          <h1 className="mt-4 text-2xl font-semibold lg:text-3xl">Aperçu du devis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Document de démonstration — non émis</p>
          {!entreprise.adresse && (
          <p className="mt-4 flex gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            Adresse de l'entreprise non renseignée.
          </p>
          )}
          <div className="-mx-4 mt-4 bg-neutral-soft px-2 py-4 sm:mx-0 sm:rounded-2xl sm:p-8">
            <DevisApercu devis={versPublic(doc.devis)} numero={doc.numero} entreprise={entreprise} />
          </div>
        </div>
      ) : (
        <Introuvable />
      )}
    </AppLayout>
  );
}
