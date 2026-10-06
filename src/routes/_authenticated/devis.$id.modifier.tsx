import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";
import { Button } from "@/components/ui/button";
import { chargerDocuments, useEtatDocuments } from "@/data/documents";

export const Route = createFileRoute("/_authenticated/devis/$id/modifier")({
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
  const etat = useEtatDocuments();
  const doc = etat.brouillons.find((d) => d.id === id);
  return (
    <AppLayout titre="Modifier le brouillon">
      {doc?.statut === "Finalisé" ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">Document finalisé — contenu verrouillé. Il ne peut plus être modifié.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/devis/$id" params={{ id }}>Consulter le devis</Link></Button>
        </div>
      ) : doc?.devis ? (
        <DevisForm key={`${doc.id}-${doc.version}`} initial={doc.devis} documentId={doc.id} numero={doc.numero} version={doc.version} />
      ) : (
        <EtatBrouillon statut={etat.statut} />
      )}
    </AppLayout>
  );
}

/** Chargement, erreur ou absence d'un brouillon. */
export function EtatBrouillon({ statut }: { statut: string }) {
  if (statut === "inactif" || statut === "chargement")
    return <p role="status" className="text-sm text-muted-foreground">Chargement du brouillon…</p>;
  if (statut === "erreur")
    return (
      <div role="alert" className="rounded-2xl border border-destructive/40 bg-card p-6 text-center">
        <p className="text-sm font-medium">Le brouillon n'a pas pu être chargé. Vérifiez votre connexion puis réessayez.</p>
        <Button variant="outline" className="mt-4" onClick={() => void chargerDocuments()}>Réessayer</Button>
      </div>
    );
  return <Introuvable />;
}

export function Introuvable() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-sm font-medium">Ce brouillon est introuvable.</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/">Retour aux documents</Link></Button>
    </div>
  );
}
