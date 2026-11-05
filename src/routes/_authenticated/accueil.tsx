import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useEtatDocuments, chargerDocuments, TYPE_LABELS } from "@/data/documents";
import { suiviEcheance } from "@/lib/echeances";
import { suivre } from "@/data/reglements";
import { formaterCentimes } from "@/data/devis";
import { useState } from "react";
import { RelanceDialogue } from "@/components/RelanceDialogue";
import { telechargerDocumentsCsv } from "@/lib/export-documents";
import { SyntheseKhosmos } from "@/components/SyntheseKhosmos";
import { DevisASuivre } from "@/components/DevisASuivre";
import { MontantBasculable } from "@/components/BasculeHtTtc";
import { ListeDocumentsDialog, type ElementListe } from "@/components/ListeDocumentsDialog";
import { ChevronRight, Wallet } from "lucide-react";
import { useModeMontants } from "@/data/mode-montants";
import { enMode } from "@/lib/montants";

export const Route = createFileRoute("/_authenticated/accueil")({
  head: () => ({
    meta: [
      { title: "Accueil — Les Frères Mayet" },
      { name: "description", content: "Accueil de la gestion Les Frères Mayet." },
      { property: "og:title", content: "Accueil — Les Frères Mayet" },
      { property: "og:description", content: "Accueil de la gestion Les Frères Mayet." },
    ],
  }),
  component: Accueil,
});

function Accueil() {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const etat = useEtatDocuments();
  const mode = useModeMontants();
  const [liste, setListe] = useState<{ titre: string; elements: ElementListe[]; encaisser?: boolean; description?: string } | null>(null);
  const docs = etat.liste.filter(d => !d.fictif);
  const factures = docs.filter(d => (d.type === "facture" || d.type === "acompte") && d.statut === "Finalisé" && d.aRegler !== undefined);
  const suivis = factures.map(doc => ({ doc, suivi: suivre(doc.aRegler!, doc.reglements ?? [], doc.credite ?? 0n) }));
  const reste = suivis.reduce((s, d) => s + enMode(d.doc, d.suivi.reste, mode), 0n);
  const credits = suivis.reduce((s, d) => s + enMode(d.doc, d.suivi.creditClient, mode), 0n);
  const enAttente = suivis.filter(d => d.suivi.reste > 0n).sort((a,b) => (a.doc.devis?.validite || "9999").localeCompare(b.doc.devis?.validite || "9999"));
  const retards = enAttente.filter(d => suiviEcheance(d.doc.devis?.validite, d.suivi.reste).etat === "retard");
  const sansDate = enAttente.filter(d => suiviEcheance(d.doc.devis?.validite, d.suivi.reste).etat === "absente");
  const brouillons = docs.filter(d => d.statut === "Brouillon");
  const normaliser = (texte: string) => texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibles = enAttente.filter(({ doc, suivi }) => {
    const echeance = suiviEcheance(doc.devis?.validite, suivi.reste).etat;
    return (filtre === "tous" || echeance === filtre) && normaliser(`${doc.client} ${doc.numero} ${doc.devis?.objet ?? ""}`).includes(normaliser(recherche.trim()));
  });
  const totalVisible = visibles.reduce((s, d) => s + enMode(d.doc, d.suivi.reste, mode), 0n);
  return <AppLayout titre="Accueil">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-semibold">Ma synthèse</h1><p className="mt-2 text-muted-foreground">Devis, factures et règlements, au même endroit.</p></div>
      <Button asChild variant="action"><Link to="/devis/nouveau">Créer un devis</Link></Button>
    </div>
    {etat.statut === "erreur" ? <div role="alert" className="mt-6 rounded-xl border p-4">Impossible de charger les documents. <Button variant="outline" onClick={() => void chargerDocuments()}>Réessayer</Button></div>
      : etat.statut !== "pret" ? <p role="status" className="mt-6">Chargement de votre activité…</p> : <>
      <SyntheseKhosmos documents={docs} />
      <div className="khosmos-summary mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["À encaisser", formaterCentimes(reste), "Factures et acomptes finalisés, après avoirs et règlements", () => setListe({ titre: "À encaisser", elements: enAttente.map(d => ({ doc: d.doc, montant: enMode(d.doc, d.suivi.reste, mode) })), encaisser: true, description: "Reste à régler de chaque document." })],
          ["Paiements attendus", String(enAttente.length), "Documents avec un reste à régler", () => setListe({ titre: "Paiements attendus", elements: enAttente.map(d => ({ doc: d.doc, montant: enMode(d.doc, d.suivi.reste, mode) })), encaisser: true })],
          ["Brouillons", String(brouillons.length), "Documents à compléter", () => setListe({ titre: "Brouillons", elements: brouillons.map(doc => ({ doc })) })],
          ["Crédits clients", formaterCentimes(credits), "À traiter séparément, sans remboursement automatique", () => setListe({ titre: "Crédits clients", elements: suivis.filter(d => d.suivi.creditClient > 0n).map(d => ({ doc: d.doc, montant: enMode(d.doc, d.suivi.creditClient, mode) })), description: "Trop-perçu ou avoir supérieur au reste dû." })],
        ] as const).map(([titre, valeur, aide, ouvrir]) => <button type="button" key={titre} onClick={ouvrir} className="group rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-secondary/40 focus-visible:outline-2"><h2 className="flex items-center justify-between text-sm text-muted-foreground">{titre}<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /></h2><p className="mt-2 text-2xl font-semibold">{valeur}</p><p className="mt-2 text-xs text-muted-foreground">{aide}</p></button>)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Ces montants concernent cet espace. Ils ne représentent pas votre solde bancaire.</p>
      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Paiements à suivre</h2>
        <p className="mt-2 text-sm text-muted-foreground">{retards.length} document(s) en retard · {sansDate.length} échéance(s) à renseigner. Les échéances les plus anciennes apparaissent en premier.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 gap-1 text-sm">Rechercher un paiement<input className="w-full rounded-md border bg-background p-2" placeholder="Client, numéro ou objet…" value={recherche} onChange={e => setRecherche(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Échéance<select className="max-w-full rounded-md border bg-background p-2" value={filtre} onChange={e => setFiltre(e.target.value)}><option value="tous">Tous les paiements attendus</option><option value="retard">En retard</option><option value="aujourdhui">À régler aujourd’hui</option><option value="avenir">À venir</option><option value="absente">Sans échéance</option></select></label>
          <Button variant="outline" disabled={!visibles.length} onClick={() => telechargerDocumentsCsv(visibles.map(v => v.doc))}>Exporter les paiements affichés</Button>
          {(recherche || filtre !== "tous") && <Button variant="ghost" onClick={() => { setRecherche(""); setFiltre("tous"); }}>Réinitialiser</Button>}
        </div>
        <p aria-live="polite" className="mt-3 text-sm font-medium">{visibles.length} paiement(s) affiché(s) · reste à encaisser : <MontantBasculable>{formaterCentimes(totalVisible)}</MontantBasculable></p>
        {visibles.length === 0 ? <p className="mt-3 text-muted-foreground">{enAttente.length === 0 ? "Aucun paiement en attente." : "Aucun paiement ne correspond à cette recherche."}</p> : <div className="mt-3 divide-y">{visibles.map(({doc, suivi}) => <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium">{doc.client}</p><p className="break-words text-sm text-muted-foreground">{TYPE_LABELS[doc.type]} · {doc.numero}</p><p className={suiviEcheance(doc.devis?.validite, suivi.reste).etat === "retard" ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>{suiviEcheance(doc.devis?.validite, suivi.reste).libelle}</p></div><div className="flex flex-wrap items-center gap-3"><span className="font-semibold"><MontantBasculable>{formaterCentimes(enMode(doc, suivi.reste, mode))}</MontantBasculable></span><RelanceDialogue doc={doc} compact /><Button asChild size="sm" variant="action"><Link to="/factures/$id" params={{id:doc.id}} search={{ encaisser: true }}><Wallet className="size-4" /> Encaisser</Link></Button><Button asChild size="sm" variant="outline"><Link to="/factures/$id" params={{id:doc.id}}>Ouvrir</Link></Button></div></div>)}</div>}
        <p className="mt-3 text-xs text-muted-foreground">Les rappels sont des messages à relire et envoyer vous-même. L’export reprend uniquement les paiements affichés ; aucun email n’est envoyé automatiquement.</p>
      </section>
      <DevisASuivre documents={docs} />
      <ListeDocumentsDialog ouvert={!!liste} onFermer={() => setListe(null)} titre={liste?.titre ?? ""} elements={liste?.elements ?? []} mode={mode} encaisser={liste?.encaisser} description={liste?.description} />
    </>}
    <section className="mt-6 rounded-2xl border bg-card p-5"><h2 className="text-lg font-semibold">Vos raccourcis</h2><div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><Link to="/">Tous les documents</Link></Button><Button asChild variant="outline"><Link to="/clients">Clients</Link></Button><Button asChild variant="outline"><Link to="/catalogue">Catalogue</Link></Button><Button asChild variant="outline"><Link to="/entreprise">Fiche entreprise</Link></Button></div><p className="mt-4 text-sm text-muted-foreground">Préparez une facture ou un acompte depuis un devis finalisé. Préparez un avoir depuis sa facture.</p></section>
  </AppLayout>;
}
