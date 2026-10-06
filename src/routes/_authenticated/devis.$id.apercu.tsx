import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Download, Info, Loader2 } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { DevisApercu, versPublic } from "@/components/DevisApercu";
import { Button } from "@/components/ui/button";
import { useEtatDocuments } from "@/data/documents";
import { chargerEntreprise, useEtatEntreprise } from "@/data/entreprise";
import { telechargerDevisPdf } from "@/lib/devisPdf";
import { EtatBrouillon } from "@/routes/_authenticated/devis.$id.modifier";

export const Route = createFileRoute("/_authenticated/devis/$id/apercu")({
  head: () => ({
    meta: [
      { title: "Aperçu du devis — Les Frères Mayet" },
      { name: "description", content: "Aperçu d'un brouillon de devis enregistré." },
      { property: "og:title", content: "Aperçu du devis — Les Frères Mayet" },
      { property: "og:description", content: "Aperçu d'un brouillon de devis enregistré." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const etatEnt = useEtatEntreprise();
  const etatDocs0 = useEtatDocuments();
  const doc0 = etatDocs0.brouillons.find((d) => d.id === id);
  const finalise = doc0?.statut === "Finalisé";
  // Devis finalisé : uniquement la copie figée de l'entreprise.
  const entreprise = finalise ? doc0?.entrepriseFigee ?? null : etatEnt.statut === "pret" ? etatEnt.fiche : null;
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState(false);
  const etatDocs = useEtatDocuments();
  const doc = etatDocs.brouillons.find((d) => d.id === id);
  const telecharger = async () => {
    if (!doc?.devis || !entreprise || enCours) return;
    // Instantané des données enregistrées au moment du clic.
    const instantane = structuredClone(versPublic(doc.devis));
    const ent = { ...entreprise };
    setEnCours(true);
    setEchec(false);
    try {
      await telechargerDevisPdf(instantane, doc.numero, ent, finalise);
    } catch {
      setEchec(true);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <AppLayout titre="Aperçu du devis">
      {doc?.devis ? (
        <div className="min-w-0">
          <Button asChild variant="outline" size="sm">
            <Link to="/devis/$id" params={{ id }}><ArrowLeft /> {finalise ? "Retour au devis" : "Retour au brouillon"}</Link>
          </Button>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
          <h1 className=" text-2xl font-semibold lg:text-3xl">Aperçu du devis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Document enregistré — non émis</p>
          </div>
          <Button variant="action" onClick={telecharger} disabled={enCours || !entreprise} aria-busy={enCours} className="shrink-0">
            {enCours ? <Loader2 className="animate-spin" /> : <Download />}
            {enCours ? "Génération du PDF…" : finalise ? "Télécharger le PDF" : "Télécharger le PDF de brouillon"}
          </Button>
          </div>
          {echec && (
            <div role="alert" className="mt-4 flex flex-col gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm sm:flex-row sm:items-center">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <p className="flex-1">{finalise ? "Le PDF n'a pas pu être généré. Le devis reste finalisé avec la même référence ; vous pouvez réessayer le téléchargement." : "Le PDF n'a pas pu être généré. Votre brouillon est intact ; vous pouvez réessayer."}</p>
              <Button size="sm" variant="outline" onClick={telecharger} disabled={enCours}>Réessayer</Button>
            </div>
          )}
          {!finalise && (etatEnt.statut === "inactif" || etatEnt.statut === "chargement") && (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Chargement des informations de l'entreprise…</p>
          )}
          {!finalise && etatEnt.statut === "erreur" && (
            <div role="alert" className="mt-4 flex flex-col gap-2 rounded-xl border border-destructive/40 bg-card p-3 text-sm sm:flex-row sm:items-center">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              <p className="flex-1">Les informations de l'entreprise n'ont pas pu être chargées. Le PDF est indisponible tant qu'elles ne le sont pas.</p>
              <Button size="sm" variant="outline" onClick={() => void chargerEntreprise()}>Réessayer</Button>
            </div>
          )}
          {!finalise && etatEnt.statut === "absente" && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-sm sm:flex-row sm:items-center">
              <Info className="size-4 shrink-0 text-muted-foreground" />
              <p className="flex-1">Enregistrez d'abord les informations de votre entreprise pour afficher l'aperçu et télécharger le PDF. Votre brouillon reste intact.</p>
              <Button asChild size="sm" variant="outline"><Link to="/entreprise">Aller à Entreprise</Link></Button>
            </div>
          )}
          {entreprise && !entreprise.adresse && (
          <p className="mt-4 flex gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            Adresse de l'entreprise non renseignée.
          </p>
          )}
          {entreprise && <div className="-mx-4 mt-4 bg-neutral-soft px-2 py-4 sm:mx-0 sm:rounded-2xl sm:p-8">
            <DevisApercu devis={versPublic(doc.devis)} numero={doc.numero} entreprise={entreprise} finalise={finalise} />
          </div>}
        </div>
      ) : (
        <EtatBrouillon statut={etatDocs.statut} />
      )}
    </AppLayout>
  );
}
