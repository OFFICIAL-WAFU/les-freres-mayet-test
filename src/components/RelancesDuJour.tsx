// Accueil : devis à relancer aujourd'hui (1re relance à 3 jours, 2e à 10 jours), les plus gros d'abord.
// Chaque relance se prépare et s'envoie sur clic (RelanceDevis) ; rien n'est envoyé automatiquement.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes, recapituler } from "@/data/devis";
import { lireDevisSignes } from "@/data/signature-distante";
import { lireEnvoisDevis } from "@/data/envois-devis";
import { statutGmail } from "@/lib/gmail-serveur";
import { dateParis } from "@/lib/echeances";
import { libelleDepuis, relancesDuJour, SEUIL_PRIORITAIRE_CENTIMES, type DevisSuivi, type EnvoiDevis } from "@/lib/relances-devis";
import { RelanceDevis } from "@/components/RelanceDevis";
import { Button } from "@/components/ui/button";

export function RelancesDuJour({ documents }: { documents: DocumentAvecDevis[] }) {
  const [envois, setEnvois] = useState<EnvoiDevis[] | null | undefined>(undefined);
  const [signes, setSignes] = useState<Record<string, unknown>>({});
  const [gmail, setGmail] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState("");
  const recharger = useCallback(() => {
    lireEnvoisDevis().then(e => { setEnvois(e); setErreur(""); }).catch(e => setErreur(e instanceof Error ? e.message : "Suivi indisponible."));
    lireDevisSignes().then(setSignes).catch(() => setSignes({}));
  }, []);
  useEffect(() => { recharger(); statutGmail().then(s => setGmail(s.connecte)).catch(() => setGmail(false)); }, [recharger]);

  const aujourdHui = dateParis();
  const { aFaire, parId } = useMemo(() => {
    const factures = new Set(documents.filter(d => d.type === "facture" || d.type === "acompte").map(d => d.devisSource?.id));
    const devis = documents.filter(d => !d.fictif && d.type === "devis" && d.statut === "Finalisé" && d.devis);
    const suivis: DevisSuivi[] = devis.map(d => ({
      id: d.id, finalise: true, reponse: d.reponse?.etat ?? "attente", signe: !!signes[d.id], facture: factures.has(d.id),
      dateDevis: d.devis!.date, validite: d.devis!.validite, montantHTCentimes: d.montantHTCentimes ?? recapituler(d.devis!.lignes).ht,
    }));
    return { aFaire: relancesDuJour(suivis, envois ?? [], aujourdHui), parId: new Map(devis.map(d => [d.id, d])) };
  }, [documents, envois, signes, aujourdHui]);

  if (envois === null) return null; // fonctionnalité pas encore installée dans la base
  return <section className="mt-6 rounded-2xl border bg-card p-5" aria-labelledby="relances-titre">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="relances-titre" className="text-lg font-semibold">Relances du jour{aFaire.length ? ` (${aFaire.length})` : ""}</h2>
      <span className="text-xs text-muted-foreground">{gmail === null ? "" : gmail ? "Envoi par Gmail (contact@lesfreresmayet.fr)" : "Gmail non connecté : les relances s’ouvrent dans votre messagerie"}</span>
    </div>
    <p className="mt-1 text-sm text-muted-foreground">Devis sans réponse : 1re relance 3 jours après l’envoi, 2e relance 10 jours plus tard. Chaque relance part avec le PDF et un lien de signature, après votre relecture.</p>
    {erreur && <p role="alert" className="mt-3 text-sm text-destructive">{erreur}</p>}
    {envois === undefined ? <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
      : !aFaire.length ? <p className="mt-3 text-sm text-muted-foreground">Aucune relance à faire aujourd’hui.</p>
      : <ul className="mt-3 divide-y">{aFaire.map(r => {
        const d = parId.get(r.devisId)!;
        const aEnvoi = (envois ?? []).some(e => e.devis_id === d.id && e.nature === "envoi" && e.canal !== "aucun");
        const prioritaire = r.montantHTCentimes >= SEUIL_PRIORITAIRE_CENTIMES;
        return <li key={r.devisId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="break-words font-medium">{d.client} · {d.numero}{prioritaire && <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold">Prioritaire</span>}</p>
            <p className="break-words text-sm text-muted-foreground">{d.devis!.objet}</p>
            <p className="text-sm text-muted-foreground">{r.rang === 1 ? "1re relance" : "2e relance"} · {libelleDepuis(r, aEnvoi)}{d.devis!.validite ? ` · valable jusqu’au ${d.devis!.validite.split("-").reverse().join("/")}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{formaterCentimes(r.montantHTCentimes)} HT</span>
            <RelanceDevis doc={d} nature={r.rang === 1 ? "relance1" : "relance2"} libelle="Préparer la relance" compact onFait={recharger} />
            <Button asChild size="sm" variant="ghost"><Link to="/devis/$id" params={{ id: d.id }}>Ouvrir</Link></Button>
          </div>
        </li>;
      })}</ul>}
  </section>;
}
