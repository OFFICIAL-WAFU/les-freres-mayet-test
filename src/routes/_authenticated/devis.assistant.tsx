import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { DevisForm } from "@/components/DevisForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEtatCatalogue } from "@/data/catalogue";
import type { DevisBrouillon } from "@/data/devis";
import { catalogueCompact, extraireJson, LIMITES, validerProposition, type PropositionControlee } from "@/lib/devis-ia";
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

function Page() {
  const catalogue = useEtatCatalogue();
  const [cle, setCle] = useState<"chargement" | "oui" | "non" | "erreur">("chargement");
  const [demande, setDemande] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [prop, setProp] = useState<{ p: PropositionControlee; n: number } | null>(null);
  useEffect(() => {
    let actif = true;
    statutDevisIA().then((r) => { if (actif) setCle(r.cleDetectee ? "oui" : "non"); }).catch(() => { if (actif) setCle("erreur"); });
    return () => { actif = false; };
  }, []);
  async function proposer() {
    if (enCours || demande.trim().length < 10) return;
    setEnCours(true); setErreur(null); setProp(null);
    try {
      const r = await proposerDevisIA({ data: { demande, catalogue: catalogueCompact(catalogue.articles) } });
      if (!r.ok) { setErreur(MSG[r.raison] ?? MSG["service"]!); return; }
      const p = validerProposition(extraireJson(r.texte), catalogue.articles);
      if (!p) { setErreur("La proposition reçue est inexploitable. Reformulez ou précisez votre description."); return; }
      setProp((x) => ({ p, n: (x?.n ?? 0) + 1 }));
    } catch { setErreur("La proposition n'a pas pu être obtenue (connexion ou session). Votre texte est conservé."); } finally { setEnCours(false); }
  }
  const initial: DevisBrouillon | null = prop ? {
    clientId: "", client: { nom: "", telephone: "", email: "", adresse: [] }, objet: prop.p.objet, date: dateParis(), validite: "",
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
          <p className="mt-2 text-xs text-muted-foreground">Le texte saisi est envoyé au service d'IA pour analyse. Évitez d'y mettre des données inutiles (coordonnées bancaires, mots de passe).</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="action" disabled={enCours || cle !== "oui" || demande.trim().length < 10 || catalogue.statut === "chargement"} onClick={() => void proposer()}>
              {enCours && <Loader2 className="animate-spin" />}{enCours ? "Analyse en cours…" : prop ? "Proposer à nouveau" : "Préparer une proposition"}
            </Button>
            {catalogue.statut === "pret" && catalogue.articles.length === 0 && <span className="text-xs text-muted-foreground">Votre catalogue est vide : toutes les lignes seront « à chiffrer ».</span>}
          </div>
          {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}
        </section>
        {prop && initial && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Proposition à relire</h2>
            <p className="mt-1 text-sm">{prop.p.lignes.length} ligne(s){prop.p.aChiffrer ? ` dont ${prop.p.aChiffrer} à chiffrer (prix vide)` : ""}. Choisissez le client, la TVA de chaque ligne, vérifiez tout, puis enregistrez le brouillon.</p>
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
