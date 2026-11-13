import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm, copierCoordonnees } from "@/components/DevisForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEtatCatalogue } from "@/data/catalogue";
import { labelTaux, type DevisBrouillon } from "@/data/devis";
import { nomClient, useEtatClients } from "@/data/clients";
import { lireReglagesChiffrage } from "@/data/habitudes";
import { REGLAGES_DEFAUT, type ReglagesChiffrage } from "@/lib/rentabilite";
import { catalogueCompact, clientCorrespondant, extraireJson, LIMITES, validerProposition, type Habitude, type PropositionControlee } from "@/lib/devis-ia";
import { lireConnaissances } from "@/data/reprise";
import { connaissancesPourIA } from "@/lib/reprise";
import { proposerDevisIA, statutDevisIA } from "@/lib/devis-ia-serveur";
import { dateParis } from "@/lib/echeances";

export const Route = createFileRoute("/_authenticated/devis/assistant")({
  head: () => ({ meta: [{ title: "Devis assisté par IA — Les Frères Mayet" }, { name: "description", content: "Préparer un brouillon de devis à partir d'une description, avec contrôle et validation par vous." }] }),
  component: Page,
});

const MSG: Record<string, string> = {
  cle_absente: "Le service d'IA n'est pas encore configuré (clé manquante côté serveur).",
  service: "Le service d'IA n'a pas répondu correctement. Réessayez dans un instant.",
  delai: "Le service d'IA a mis trop de temps à répondre. Réessayez.",
  reponse_vide: "Le service d'IA n'a rien renvoyé. Reformulez votre description.",
};

const LIBELLE_TRAVAUX: Record<string, string> = {
  climatisation: "Climatisation", salle_de_bain: "Salle de bain", chauffe_eau: "Chauffe-eau", tableau_electrique: "Tableau électrique",
  electricite: "Électricité", plomberie: "Plomberie", cuisine: "Cuisine", wc: "WC", autre: "Autres travaux",
};

/** Dictée vocale du navigateur (Chrome, Safari) : le texte s'ajoute à la description, rien n'est envoyé tant que vous ne cliquez pas. */
type Reco = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function useDictee(ajouter: (t: string) => void) {
  const [actif, setActif] = useState(false);
  const reco = useRef<Reco | null>(null);
  const [possible, setPossible] = useState(false);
  useEffect(() => { const w = window as unknown as Record<string, unknown>; setPossible(Boolean(w["SpeechRecognition"] ?? w["webkitSpeechRecognition"])); }, []);
  function demarrer() {
    const w = window as unknown as Record<string, new () => Reco>;
    const C = w["SpeechRecognition"] ?? w["webkitSpeechRecognition"];
    if (!C) return;
    const r = new C(); r.lang = "fr-FR"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]!; if (x.isFinal) ajouter(x[0].transcript.trim()); } };
    r.onend = () => setActif(false); r.onerror = () => setActif(false);
    reco.current = r; r.start(); setActif(true);
  }
  const arreter = () => { reco.current?.stop(); setActif(false); };
  useEffect(() => () => reco.current?.stop(), []);
  return { possible, actif, demarrer, arreter };
}

function Page() {
  const catalogue = useEtatCatalogue();
  const etatClients = useEtatClients();
  const [reglages, setReglages] = useState<ReglagesChiffrage>(REGLAGES_DEFAUT);
  useEffect(() => { let actif = true; lireReglagesChiffrage().then((r) => { if (actif) setReglages(r); }).catch(() => {}); return () => { actif = false; }; }, []);
  const [cle, setCle] = useState<"chargement" | "oui" | "non" | "erreur">("chargement");
  const [demande, setDemande] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [prop, setProp] = useState<{ p: PropositionControlee; n: number } | null>(null);
  const [habitudes, setHabitudes] = useState<Habitude[]>([]);
  const dictee = useDictee((t) => setDemande((d) => (d.trim() ? `${d.trimEnd()} ${t}` : t).slice(0, LIMITES.demande)));
  // Savoir-faire validé par l'artisan ; s'il est indisponible, l'assistant fonctionne sans.
  useEffect(() => { let actif = true; lireConnaissances().then(c => { if (actif) setHabitudes(connaissancesPourIA(c)); }).catch(() => {}); return () => { actif = false; }; }, []);
  useEffect(() => {
    let actif = true;
    statutDevisIA().then((r) => { if (actif) setCle(r.cleDetectee ? "oui" : "non"); }).catch(() => { if (actif) setCle("erreur"); });
    return () => { actif = false; };
  }, []);
  async function proposer() {
    if (enCours || demande.trim().length < 10) return;
    setEnCours(true); setErreur(null); setProp(null);
    try {
      const r = await proposerDevisIA({ data: { demande, catalogue: catalogueCompact(catalogue.articles), habitudes } });
      if (!r.ok) { setErreur(MSG[r.raison] ?? MSG["service"]!); return; }
      const p = validerProposition(extraireJson(r.texte), catalogue.articles, undefined, { reglages });
      if (!p) { setErreur("La proposition reçue est inexploitable. Reformulez ou précisez votre description."); return; }
      setProp((x) => ({ p, n: (x?.n ?? 0) + 1 }));
    } catch { setErreur("La proposition n'a pas pu être obtenue (connexion ou session). Votre texte est conservé."); } finally { setEnCours(false); }
  }
  // Client cité dans la demande : repris seulement s'il correspond à UN client existant ; sinon choix ou création manuelle.
  const clientTrouve = prop?.p.clientCite ? clientCorrespondant(prop.p.clientCite, etatClients.clients, nomClient) : null;
  const initial: DevisBrouillon | null = prop ? {
    clientId: clientTrouve?.id ?? "", client: clientTrouve ? copierCoordonnees(clientTrouve) : { nom: "", telephone: "", email: "", adresse: [] }, objet: prop.p.objet, date: dateParis(), validite: "",
    remarques: "", notes: "", lignes: prop.p.lignes,
  } : null;
  return (
    <AppLayout titre="Devis assisté par IA">
      <div className="max-w-3xl">
        <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/devis/nouveau">← Nouveau devis</Link></Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold lg:text-3xl"><Sparkles className="size-6" aria-hidden />Devis assisté par IA</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Décrivez le chantier (ou collez la demande du client). L'IA propose des lignes ; vous gardez la main : les prix viennent de votre catalogue, la TVA est à choisir par vous,
          les lignes non reconnues restent « à chiffrer », et rien n'est finalisé ni envoyé.
        </p>
        {cle === "non" && <p role="status" className="mt-3 rounded-xl border border-border bg-secondary/50 p-3 text-sm">L'assistant n'est pas encore activé : la clé du service d'IA (secret serveur ANTHROPIC_API_KEY) doit être ajoutée dans la configuration.</p>}
        {cle === "erreur" && <p role="alert" className="mt-3 text-sm text-destructive">Impossible de vérifier l'état de l'assistant.</p>}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4 lg:p-6">
          <label className="flex flex-col gap-1 text-sm font-medium">Description du chantier ou demande du client
            <Textarea rows={8} value={demande} maxLength={LIMITES.demande} onChange={(e) => setDemande(e.target.value)}
              placeholder="Ex. : Remplacement du tableau électrique d'une maison de 90 m², 3 rangées, mise aux normes NF C 15-100, 2 prises à ajouter dans la cuisine…" />
          </label>
          {dictee.possible && (
            <Button type="button" variant={dictee.actif ? "destructive" : "outline"} size="sm" className="mt-2" onClick={dictee.actif ? dictee.arreter : dictee.demarrer}>
              {dictee.actif ? <><Square />Arrêter la dictée</> : <><Mic />Dicter</>}
            </Button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Le texte saisi est envoyé au service d'IA pour analyse. Évitez d'y mettre des données inutiles (coordonnées bancaires, mots de passe).</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="action" disabled={enCours || cle !== "oui" || demande.trim().length < 10 || catalogue.statut === "chargement"} onClick={() => void proposer()}>
              {enCours && <Loader2 className="animate-spin" />}{enCours ? "Analyse en cours…" : prop ? "Proposer à nouveau" : "Préparer une proposition"}
            </Button>
            {catalogue.statut === "pret" && catalogue.articles.length === 0 && <span className="text-xs text-muted-foreground">Votre catalogue est vide : toutes les lignes seront « à chiffrer ».</span>}
            <span className="text-xs text-muted-foreground">{habitudes.length > 0 ? `L’assistant suit vos ${habitudes.length} fiches de savoir-faire validées.` : "Validez vos fiches dans « Savoir-faire » pour que l’assistant suive vos habitudes."}</span>
          </div>
          {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}
        </section>
        {prop && initial && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Proposition à relire</h2>
            <p className="mt-1 text-sm">{prop.p.lignes.length} ligne(s){prop.p.aChiffrer ? ` dont ${prop.p.aChiffrer} à chiffrer (prix vide)` : ""}. Vérifiez tout, complétez les prix manquants, puis enregistrez le brouillon.</p>
            <ul className="mt-3 flex flex-col gap-1 rounded-xl border border-border bg-card p-3 text-sm" aria-label="Résumé de la proposition">
              <li><span className="font-medium">Type de travaux :</span> {LIBELLE_TRAVAUX[prop.p.typeTravaux]}</li>
              <li><span className="font-medium">TVA pré-remplie :</span> {labelTaux(prop.p.taux)}{prop.p.taux === 55 ? " (climatisation)" : " (rénovation d’un logement de plus de deux ans)"} — à changer si le client est une entreprise ou un logement neuf.</li>
              <li><span className="font-medium">Client :</span> {clientTrouve ? `${nomClient(clientTrouve)} (reconnu dans votre liste — vérifiez)` : prop.p.clientCite ? `« ${prop.p.clientCite} » introuvable ou ambigu : choisissez-le ou créez-le ci-dessous.` : "à choisir ci-dessous."}</li>
            </ul>
            {prop.p.alertes.length > 0 && (
              <ul className="mt-3 list-disc rounded-xl border border-border bg-secondary/50 p-3 pl-7 text-sm" aria-label="Points à vérifier">
                {prop.p.alertes.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
            <div className="mt-4"><DevisForm key={prop.n} initial={initial} /></div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
