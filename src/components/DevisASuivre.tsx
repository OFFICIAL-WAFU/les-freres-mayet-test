import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { chargerDocuments, noterReponseDevis, type DocumentAvecDevis, type ReponseClient } from "@/data/documents";
import { lireDevisSignes } from "@/data/signature-distante";
import { lireSuivisDevis, modifierSuiviDevis } from "@/data/suivi-devis";
import { dateParis } from "@/lib/echeances";
import { DELAI_RELANCE_PAR_DEFAUT, etatSuiviDevis, marquerEnvoye, marquerRelance, type BibliothequeSuivis, type EtatSuiviDevis, type SuiviDevis } from "@/lib/suivi-devis";
import { Button } from "@/components/ui/button";
import { RelanceDialogue } from "@/components/RelanceDialogue";

const VIDE: BibliothequeSuivis = { version: 0, suivis: {} };

export function DevisASuivre({ documents }: { documents: DocumentAvecDevis[] }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [filtreSuivi, setFiltreSuivi] = useState<"tous" | EtatSuiviDevis>("tous");
  const [delai, setDelai] = useState(DELAI_RELANCE_PAR_DEFAUT);
  const [bib, setBib] = useState<BibliothequeSuivis>(VIDE);
  const [erreurSuivi, setErreurSuivi] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [signes, setSignes] = useState<Record<string, { signeLe: string; nom: string }>>({});
  useEffect(() => { lireDevisSignes().then(setSignes).catch(() => setSignes({})); }, []);
  const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const aujourdHui = dateParis();

  const recharger = useCallback(() => {
    lireSuivisDevis().then(b => { setBib(b); setErreurSuivi(""); }).catch(e => setErreurSuivi(e instanceof Error ? e.message : "Suivi indisponible."));
  }, []);
  useEffect(() => { recharger(); }, [recharger]);

  const agir = async (id: string, appliquer: (a: SuiviDevis | undefined, j: string) => SuiviDevis, message: string) => {
    setOccupe(true);
    try { setBib(await modifierSuiviDevis(id, bib.version, appliquer)); toast.success(message); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); recharger(); }
    finally { setOccupe(false); }
  };

  const lies = new Set(documents.filter(d => d.type === "facture" || d.type === "acompte").map(d => d.devisSource?.id));
  // Devis finalisés sans facture ni acompte, et non refusés : en attente de signature, ou signés mais pas encore facturés.
  const candidats = documents.filter(d => !d.fictif && d.type === "devis" && d.statut === "Finalisé" && d.devis && !lies.has(d.id) && (filtreSuivi === "refuse" || d.reponse?.etat !== "refuse"));
  const etat = (d: DocumentAvecDevis) => !d.devis!.validite ? "sans-date" : d.devis!.validite < aujourdHui ? "expire" : "valide";
  const dateFr = (iso: string | null | undefined) => iso ? iso.slice(0, 10).split("-").reverse().join("/") : "";
  const suiviDe = (d: DocumentAvecDevis): { etat: EtatSuiviDevis; libelle: string } => {
    if (signes[d.id]) return { etat: "accepte", libelle: `Signé à distance par ${signes[d.id]!.nom} le ${new Date(signes[d.id]!.signeLe).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} · à facturer` };
    if (d.reponse?.etat === "accepte") return { etat: "accepte", libelle: `Signé${d.reponse.le ? ` le ${dateFr(d.reponse.le)}` : ""} · à facturer` };
    if (d.reponse?.etat === "refuse") return { etat: "refuse", libelle: `Refusé${d.reponse.le ? ` le ${dateFr(d.reponse.le)}` : ""}` };
    const local = bib.suivis[d.id];
    return etatSuiviDevis(local ? { ...local, reponse: "attente" } : undefined, aujourdHui, delai);
  };
  const repondre = async (d: DocumentAvecDevis, r: ReponseClient) => {
    setOccupe(true);
    try { await noterReponseDevis(d.id, r); toast.success(r === "accepte" ? "Devis noté comme signé" : r === "refuse" ? "Devis noté comme refusé" : "Devis remis en attente"); void chargerDocuments(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setOccupe(false); }
  };
  const visibles = candidats
    .filter(d => (filtre === "tous" || etat(d) === filtre) && (filtreSuivi === "tous" || suiviDe(d).etat === filtreSuivi) && normaliser(`${d.client} ${d.numero} ${d.devis!.objet}`).includes(normaliser(recherche.trim())))
    .sort((a, b) => (suiviDe(b).etat === "a-relancer" ? 1 : 0) - (suiviDe(a).etat === "a-relancer" ? 1 : 0) || (a.devis!.validite || "9999").localeCompare(b.devis!.validite || "9999"));
  const aRelancer = candidats.filter(d => suiviDe(d).etat === "a-relancer").length;

  return <section className="mt-6 rounded-2xl border bg-card p-5">
    <h2 className="text-lg font-semibold">Devis à suivre et à facturer</h2>
    <p className="mt-2 text-sm text-muted-foreground">Devis finalisés sans facture ni acompte : en attente de signature, ou signés et à facturer. La réponse du client (signé, refusé) est enregistrée avec le devis ; les dates d’envoi et de relance sont notées sur cet appareil. L’application n’envoie rien d’elle-même.</p>
    {erreurSuivi && <p role="alert" className="mt-3 text-sm text-destructive">{erreurSuivi}</p>}
    <p className={`mt-3 text-sm font-medium ${aRelancer ? "text-destructive" : ""}`} aria-live="polite">{aRelancer ? `${aRelancer} devis sans réponse depuis ${delai} jour${delai > 1 ? "s" : ""} ou plus : à relancer` : "Aucun devis à relancer pour le moment."}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <label className="grid min-w-0 flex-1 gap-1 text-sm">Rechercher un devis<input className="w-full rounded-md border bg-background p-2" placeholder="Client, numéro ou objet…" value={recherche} onChange={e => setRecherche(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Suivi<select className="rounded-md border bg-background p-2" value={filtreSuivi} onChange={e => setFiltreSuivi(e.target.value as "tous" | EtatSuiviDevis)}><option value="tous">Tous les suivis</option><option value="a-relancer">À relancer</option><option value="en-attente">En attente de réponse</option><option value="non-envoye">Envoi non noté</option><option value="accepte">Signés, à facturer</option><option value="refuse">Refusés</option></select></label>
      <label className="grid gap-1 text-sm">Validité<select className="rounded-md border bg-background p-2" value={filtre} onChange={e => setFiltre(e.target.value)}><option value="tous">Toutes les validités</option><option value="valide">Validité en cours</option><option value="expire">Validité dépassée</option><option value="sans-date">Sans date de validité</option></select></label>
      <label className="grid gap-1 text-sm">Relancer après<select className="rounded-md border bg-background p-2" value={delai} onChange={e => setDelai(Number(e.target.value))}>{[2, 3, 5, 7, 14].map(j => <option key={j} value={j}>{j} jours</option>)}</select></label>
      {(recherche || filtre !== "tous" || filtreSuivi !== "tous") && <Button variant="ghost" onClick={() => { setRecherche(""); setFiltre("tous"); setFiltreSuivi("tous"); }}>Réinitialiser les devis</Button>}
    </div>
    <p className="mt-3 text-sm" aria-live="polite">{visibles.length} devis affiché(s) sur {candidats.length} à suivre</p>
    {!visibles.length && <p className="mt-3 text-sm text-muted-foreground">Aucun devis ne correspond à cette sélection.</p>}
    <div className="mt-3 divide-y">{visibles.map(doc => <LigneDevis key={doc.id} doc={doc} suivi={bib.suivis[doc.id]} etat={suiviDe(doc)} validite={etat(doc)} aujourdHui={aujourdHui} occupe={occupe} agir={agir} repondre={repondre} signeDistance={!!signes[doc.id] || doc.reponse?.mode === "signature_distante" || doc.reponse?.mode === "signature_khosmos"} />)}</div>
  </section>;
}

function LigneDevis({ doc, suivi, etat, validite, aujourdHui, occupe, agir, repondre, signeDistance }: {
  doc: DocumentAvecDevis; suivi: SuiviDevis | undefined; etat: { etat: EtatSuiviDevis; libelle: string }; validite: string; aujourdHui: string; occupe: boolean;
  agir: (id: string, appliquer: (a: SuiviDevis | undefined, j: string) => SuiviDevis, message: string) => Promise<void>;
  repondre: (d: DocumentAvecDevis, r: ReponseClient) => Promise<void>; signeDistance: boolean;
}) {
  const [dateEnvoi, setDateEnvoi] = useState(aujourdHui);
  const relancer = etat.etat === "a-relancer";
  return <div className="flex flex-wrap items-start justify-between gap-3 py-3">
    <div className="min-w-0">
      <p className="break-words font-medium">{doc.client} · {doc.numero}</p>
      <p className="break-words text-sm text-muted-foreground">{doc.devis!.objet}</p>
      <p className="text-sm text-muted-foreground">{validite === "sans-date" ? "Date de validité non renseignée" : `${validite === "expire" ? "Validité dépassée le" : "Valable jusqu’au"} ${doc.devis!.validite.split("-").reverse().join("/")}`}</p>
      <p className={`text-sm font-medium ${relancer ? "text-destructive" : ""}`}>{etat.libelle}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {!suivi?.envoyeLe && <>
          <label className="flex items-center gap-2 text-sm">Envoyé le<input type="date" className="rounded-md border bg-background p-1.5" value={dateEnvoi} max={aujourdHui} onChange={e => setDateEnvoi(e.target.value)} /></label>
          <Button size="sm" variant="outline" disabled={occupe || !dateEnvoi} onClick={() => void agir(doc.id, (a, j) => marquerEnvoye(a, dateEnvoi, j), "Envoi noté")}>Noter l’envoi</Button>
        </>}
        {suivi?.envoyeLe && (doc.reponse?.etat ?? "attente") === "attente" && <Button size="sm" variant="outline" disabled={occupe} onClick={() => void agir(doc.id, (a, j) => marquerRelance(a, j, j), "Relance notée")}>Relance faite aujourd’hui</Button>}
        <label className="flex items-center gap-2 text-sm">Réponse du client<select className="rounded-md border bg-background p-1.5" disabled={occupe || signeDistance} value={doc.reponse?.etat ?? "attente"} onChange={e => void repondre(doc, e.target.value as ReponseClient)}><option value="attente">En attente</option><option value="accepte">Signé</option><option value="refuse">Refusé</option></select></label>
      </div>
      <div className="flex flex-wrap gap-2"><RelanceDialogue doc={doc} compact /><Button asChild size="sm" variant="outline"><Link to="/devis/$id" params={{ id: doc.id }}>Ouvrir le devis</Link></Button></div>
    </div>
  </div>;
}
