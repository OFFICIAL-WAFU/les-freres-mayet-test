import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useEtatDocuments } from "@/data/documents";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";
import { AvoirForm } from "@/components/AvoirForm";

export const Route = createFileRoute("/_authenticated/avoirs/$id/modifier")({
  head: () => ({
    meta: [
      { title: "Modifier l'avoir brouillon — Les Frères Mayet" },
      { name: "description", content: "Modifier la date, le motif et les remarques d'un avoir brouillon." },
      { property: "og:title", content: "Modifier l'avoir brouillon — Les Frères Mayet" },
      { property: "og:description", content: "Modifier la date, le motif et les remarques d'un avoir brouillon." },
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
    <AppLayout titre="Modifier l'avoir brouillon">
      {doc?.devis ? <AvoirForm key={`${doc.id}-${doc.version}`} doc={doc} /> : <EtatBrouillon statut={etat.statut} />}
      {false && <Link to="/" />}{false && <Button />}
    </AppLayout>
  );
}
