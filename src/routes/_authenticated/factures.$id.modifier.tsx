import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";
import { useEtatDocuments } from "@/data/documents";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";

export const Route = createFileRoute("/_authenticated/factures/$id/modifier")({
  head: () => ({
    meta: [
      { title: "Modifier la facture brouillon — Les Frères Mayet" },
      { name: "description", content: "Modifier une facture brouillon non émise." },
      { property: "og:title", content: "Modifier la facture brouillon — Les Frères Mayet" },
      { property: "og:description", content: "Modifier une facture brouillon non émise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const etat = useEtatDocuments();
  const doc = etat.brouillons.find((d) => d.id === id && (d.type === "facture" || d.type === "acompte"));
  return (
    <AppLayout titre="Modifier la facture brouillon">
      {doc?.statut === "Finalisé" ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>Cette facture est finalisée ({doc.numero}) : son contenu ne peut plus être modifié.</p>
          <Button asChild variant="outline" className="self-start"><Link to="/factures/$id" params={{ id }}>Ouvrir la facture</Link></Button>
        </div>
      ) : doc?.devis ? (
        <DevisForm
          key={`${doc.id}-${doc.version}`}
          initial={doc.devis}
          documentId={doc.id}
          numero={doc.numero}
          version={doc.version}
          facture={{ sourceRef: doc.devisSource?.reference ?? "" }}
        />
      ) : (
        <EtatBrouillon statut={etat.statut} />
      )}
    </AppLayout>
  );
}
