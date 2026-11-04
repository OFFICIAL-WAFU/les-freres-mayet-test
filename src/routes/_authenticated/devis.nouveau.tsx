import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ImporterReprise, conserverReprise } from '@/components/RepriseDevis';
import type { RepriseDevis } from '@/data/reprises-devis';
import { chargerDocuments, useEtatDocuments } from "@/data/documents";
import { devisDepuisModele } from "@/lib/modele-devis";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";
import { lireModele } from "@/data/reprise";
import { devisDepuisModeleTravaux, type ModeleDevis } from "@/lib/reprise";
import { dateParis } from "@/lib/echeances";

export const Route = createFileRoute("/_authenticated/devis/nouveau")({
  validateSearch: (search: Record<string, unknown>): { modele?: string; modeleTravaux?: string } => ({
    ...(typeof search["modele"] === "string" ? { modele: search["modele"] } : {}),
    ...(typeof search["modeleTravaux"] === "string" ? { modeleTravaux: search["modeleTravaux"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Nouveau devis — Les Frères Mayet" },
      { name: "description", content: "Préparer un brouillon de devis." },
      { property: "og:title", content: "Nouveau devis — Les Frères Mayet" },
      { property: "og:description", content: "Préparer un brouillon de devis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const [reprise,setReprise]=useState<RepriseDevis|null>(null);
  const { modele, modeleTravaux } = Route.useSearch(); const etat = useEtatDocuments();
  const [mt, setMt] = useState<{ modele: ModeleDevis | null; erreur: string } | null>(null);
  useEffect(() => { if (!modeleTravaux) return; let actif = true; lireModele(modeleTravaux).then(m => { if (actif) setMt({ modele: m, erreur: "" }); }).catch(e => { if (actif) setMt({ modele: null, erreur: e instanceof Error ? e.message : "Modèle indisponible." }); }); return () => { actif = false; }; }, [modeleTravaux]);
  const initialTravaux = useMemo(() => mt?.modele ? devisDepuisModeleTravaux(mt.modele, dateParis()) : undefined, [mt]);
  const source = modele ? etat.brouillons.find(d => d.id === modele && d.type === "devis" && !d.fictif) : undefined;
  const initial = useMemo(() => source?.devis ? devisDepuisModele(source.devis) : undefined, [source]);
  if (modeleTravaux && !modele) return <AppLayout titre="Nouveau devis">
    {!mt ? <p role="status">Chargement du modèle…</p> : !initialTravaux ? <div role="alert"><p>{mt.erreur || "Ce modèle est introuvable."}</p><Link to="/devis/nouveau" search={{}} className="underline">Créer un devis vide</Link></div> : <>
      <section className="mb-4 rounded-xl border bg-card p-4 text-sm"><h1 className="font-semibold">Nouveau devis · modèle « {mt.modele?.nom} »</h1><p className="mt-2">Lignes habituelles pré-remplies avec vos prix les plus courants. Choisissez le client, complétez les lignes « à choisir », ajustez quantités et prix, et vérifiez la TVA de chaque ligne.</p></section>
      <DevisForm key={modeleTravaux} initial={initialTravaux} />
    </>}
  </AppLayout>;
  return <AppLayout titre="Nouveau devis">
    {modele && etat.statut === "erreur" ? <div role="alert"><p>Le modèle n’a pas pu être chargé. Votre devis d’origine est conservé.</p><button className="mt-2 underline" onClick={() => void chargerDocuments()}>Réessayer</button></div> : modele && etat.statut !== "pret" ? <p>Chargement du modèle…</p> : modele && !initial ? <div role="alert"><p>Ce devis modèle est introuvable dans votre espace.</p><Link to="/devis/nouveau" search={{}}>Créer un devis vide</Link></div> : <>
      {source && <section className="mb-4 rounded-xl border bg-card p-4 text-sm"><h1 className="font-semibold">Nouveau devis à partir de {source.numero}</h1><p className="mt-2">Les lignes et conditions sont reprises. Choisissez le client, vérifiez les prix et renseignez la validité. Aucun numéro définitif, accord ou règlement n’est copié. Le document d’origine reste inchangé.</p></section>}
      {!modele && !reprise && <ImporterReprise onCharger={setReprise} />}
      {!modele && !reprise && <p className="mb-4 text-sm"><Link to="/devis/assistant" className="font-medium underline">Préparer le devis avec l’assistant IA</Link> — décrivez le chantier, relisez et corrigez la proposition. Ou partez d’un <Link to="/connaissances" className="font-medium underline">modèle de devis par type de travaux</Link>.</p>}
      {reprise && <p className="mb-4 rounded-xl border p-4">Devis source {reprise.referenceSource} repris : {reprise.devis.lignes.length} lignes. Sélectionnez le client puis enregistrez le brouillon. La copie PDF source conserve les lots, les unités et la mise en page d’origine.</p>}
      <DevisForm key={reprise?.sha256Original || modele || "nouveau"} {...(reprise ? {initial:{...reprise.devis,clientId:'',client:{nom:'',telephone:'',email:'',adresse:[]}},avantEnregistrer:(id:string)=>conserverReprise(id,reprise)} : initial ? { initial } : {})} />
    </>}
  </AppLayout>;
}
