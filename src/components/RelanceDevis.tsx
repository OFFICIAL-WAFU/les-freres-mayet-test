// Envoi ou relance d'un devis finalisé : message à relire, PDF joint, lien de signature en ligne.
// Rien ne part sans clic. Avec Gmail connecté, le mail part de la boîte de l'entreprise ; sinon la messagerie de l'appareil
// s'ouvre (le PDF est alors téléchargé pour être joint à la main). Chaque envoi est noté dans envois_devis (idempotent).
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { DocumentAvecDevis } from "@/data/documents";
import { versPublic } from "@/components/DevisApercu";
import { contexteMessageDocument } from "@/components/MessageDocument";
import { lireMessages } from "@/data/messages";
import { MODELES_MESSAGES, rendreMessage, type TypeMessage } from "@/lib/messages";
import { creerLienSignature } from "@/data/signature-distante";
import { enBase64, genererDevisPdf, nomFichierDevis } from "@/lib/devisPdf";
import { envoyerMailGmail, statutGmail } from "@/lib/gmail-serveur";
import { lireEnvoisDevis, noterEnvoiDevis } from "@/data/envois-devis";
import { emailValide, prochaineNature, type NatureEnvoi } from "@/lib/relances-devis";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Repère remplacé par le vrai lien au moment de l'envoi (le lien n'est créé que si le mail part). */
const REPERE_LIEN = "[lien de signature créé à l’envoi]";
const TITRES: Record<NatureEnvoi, string> = { envoi: "Envoyer le devis", relance1: "1re relance du devis", relance2: "2e relance du devis" };
const MODELE: Record<NatureEnvoi, TypeMessage> = { envoi: "devis", relance1: "rappelDevis", relance2: "rappelDevis2" };

type Phase = "edition" | "envoi" | "a-noter" | "messagerie";

export function RelanceDevis({ doc, nature: natureImposee, libelle, compact = false, onFait }: {
  doc: DocumentAvecDevis; nature?: NatureEnvoi; libelle?: string; compact?: boolean; onFait?: () => void;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [nature, setNature] = useState<NatureEnvoi>(natureImposee ?? "envoi");
  const [dest, setDest] = useState(""); const [sujet, setSujet] = useState(""); const [texte, setTexte] = useState("");
  const [avecPdf, setAvecPdf] = useState(true); const [avecLien, setAvecLien] = useState(true);
  const [gmail, setGmail] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("edition");
  const [chargement, setChargement] = useState(false); const [erreur, setErreur] = useState("");
  const tentative = useRef<{ id: string; lien?: string; canal?: "gmail" | "messagerie" } | null>(null);
  const [deja, setDeja] = useState<NatureEnvoi | null>(null);
  useEffect(() => { if (natureImposee) setNature(natureImposee); }, [natureImposee]);
  if (doc.fictif || doc.statut !== "Finalisé" || !doc.devis || doc.type !== "devis") return null;

  const rendre = async (n: NatureEnvoi, lien: boolean) => {
    const b = await lireMessages(), type = MODELE[n];
    return rendreMessage(b.modeles[type] ?? MODELES_MESSAGES[type], { ...contexteMessageDocument(doc), lien_signature: lien ? REPERE_LIEN : "" });
  };
  const preparer = async () => {
    setChargement(true); setErreur("");
    try {
      const [envois, statut] = await Promise.all([lireEnvoisDevis().catch(() => null), statutGmail().catch(() => ({ connecte: false }))]);
      const n = natureImposee ?? prochaineNature((envois ?? []).filter(e => e.devis_id === doc.id));
      const m = await rendre(n, true);
      setNature(n); setDest(doc.devis!.client.email ?? ""); setSujet(m.sujet); setTexte(m.texte);
      setAvecPdf(true); setAvecLien(true); setGmail(statut.connecte); setPhase("edition"); setDeja(null);
      tentative.current = { id: crypto.randomUUID() };
      setOuvert(true);
    } catch (e) { setErreur(e instanceof Error ? e.message : "Préparation impossible."); } finally { setChargement(false); }
  };
  const basculerLien = async (oui: boolean) => {
    setAvecLien(oui);
    if (!oui) { setTexte(t => t.split("\n").filter(l => !l.includes(REPERE_LIEN)).join("\n")); return; }
    if (!texte.includes(REPERE_LIEN)) { const m = await rendre(nature, true); setTexte(m.texte); toast.info("Message réinitialisé pour y remettre le lien de signature."); }
  };

  /** Crée le lien (une seule fois par tentative) et renvoie le texte final. */
  const texteFinal = async () => {
    const t = tentative.current!;
    if (!avecLien || !texte.includes(REPERE_LIEN)) return { texte, lien: false };
    if (!t.lien) t.lien = (await creerLienSignature(doc.id)).lien;
    return { texte: texte.split(REPERE_LIEN).join(t.lien), lien: true };
  };
  const pdf = async () => {
    const blob = await genererDevisPdf(structuredClone(versPublic(doc.devis!)), doc.numero, { ...doc.entrepriseFigee! }, true);
    return { blob, nom: nomFichierDevis(doc.numero) };
  };
  const noter = async (canal: "gmail" | "messagerie" | "aucun", lien: boolean) => {
    await noterEnvoiDevis({ id: tentative.current!.id, devisId: doc.id, nature, canal, destinataire: dest, sujet, avecPdf: canal !== "aucun" && avecPdf, avecLien: lien });
    toast.success(canal === "aucun" ? "Relance écartée" : nature === "envoi" ? "Envoi du devis noté" : "Relance notée");
    setOuvert(false); onFait?.();
  };

  const envoyerGmail = async () => {
    if (!emailValide(dest)) { setErreur("Indiquez une adresse e-mail valide pour le client."); return; }
    setChargement(true); setErreur(""); setPhase("envoi");
    try {
      const f = await texteFinal();
      const piece = avecPdf ? await pdf() : null;
      const r = await envoyerMailGmail({ data: { a: dest.trim(), sujet, texte: f.texte, ...(piece ? { pdf: { nom: piece.nom, base64: await enBase64(piece.blob) } } : {}) } });
      if (!r.ok) {
        setPhase("edition");
        setErreur(r.raison === "non_connecte" ? "Gmail n’est pas connecté : utilisez « Ouvrir dans ma messagerie »."
          : r.raison === "refuse" ? "Gmail a refusé l’envoi : reconnectez Gmail dans Lovable (Settings › Integrations)."
          : r.raison === "delai" ? "Gmail n’a pas répondu à temps. Vérifiez vos « Envoyés » avant de réessayer, pour ne pas envoyer deux fois."
          : "L’envoi n’a pas abouti. Vérifiez vos « Envoyés » avant de réessayer.");
        return;
      }
      tentative.current!.canal = "gmail"; setPhase("a-noter");
      try { await noter("gmail", f.lien); } catch (e) { setErreur(`Mail envoyé, mais ${e instanceof Error ? e.message.charAt(0).toLowerCase() + e.message.slice(1) : "non noté."}`); }
    } catch (e) { setPhase("edition"); setErreur(e instanceof Error ? e.message : "Envoi impossible."); } finally { setChargement(false); }
  };
  const ouvrirMessagerie = async () => {
    setChargement(true); setErreur("");
    try {
      const f = await texteFinal();
      if (avecPdf) {
        const p = await pdf(); const url = URL.createObjectURL(p.blob); const a = document.createElement("a");
        a.href = url; a.download = p.nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      const mailto = `mailto:${emailValide(dest) ? dest.trim() : ""}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(f.texte.replace(/\r?\n/g, "\r\n"))}`;
      if (mailto.length > 1900) toast.info("Message long : s’il est tronqué dans votre messagerie, copiez-le depuis cette fenêtre.");
      window.location.href = mailto;
      tentative.current!.canal = "messagerie"; setTexte(f.texte); setPhase("messagerie");
    } catch (e) { setErreur(e instanceof Error ? e.message : "Préparation impossible."); } finally { setChargement(false); }
  };
  const confirmer = async (canal: "gmail" | "messagerie" | "aucun") => {
    setChargement(true); setErreur("");
    try { await noter(canal, canal !== "aucun" && !!tentative.current?.lien); }
    catch (e) { if (e instanceof Error && e.message.includes("déjà notée")) { setDeja(nature); } setErreur(e instanceof Error ? e.message : "Non noté."); }
    finally { setChargement(false); }
  };

  const bouton = libelle ?? (compact ? "Envoyer / relancer" : "Envoyer ou relancer le devis");
  return <>
    <Button size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"} disabled={chargement} onClick={() => void preparer()}>{chargement && !ouvert ? "Préparation…" : bouton}</Button>
    {erreur && !ouvert && <p role="alert" className="mt-1 text-sm text-destructive">{erreur}</p>}
    <Dialog open={ouvert} onOpenChange={o => { if (!chargement) setOuvert(o); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITRES[nature]} {doc.numero}</DialogTitle>
          <DialogDescription>{doc.devis.client.nom} · {doc.devis.objet}. Relisez et modifiez librement : rien ne part sans votre clic.</DialogDescription>
        </DialogHeader>
        {phase === "messagerie" ? <div className="flex flex-col gap-3 text-sm">
          <p>Votre messagerie s’est ouverte avec le message{avecPdf ? " ; le PDF du devis vient d’être téléchargé : ajoutez-le en pièce jointe" : ""}. Une fois le mail parti, confirmez ici pour que le devis ne soit pas relancé deux fois.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={chargement} onClick={() => void confirmer("messagerie")}>Le mail est parti</Button>
            <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(texte); toast.success("Message copié"); } catch { toast.error("Copie indisponible."); } }}>Copier le message</Button>
            <Button variant="ghost" disabled={chargement} onClick={() => setPhase("edition")}>Revenir au message</Button>
          </div>
        </div> : <div className="flex flex-col gap-3">
          <div className="grid gap-1 text-sm"><label htmlFor={`${id}-a`} className="font-medium">Destinataire</label>
            <input id={`${id}-a`} type="email" className="rounded-md border bg-background p-2" value={dest} onChange={e => setDest(e.target.value)} aria-invalid={!!dest && !emailValide(dest)} />
            {!dest && <p className="text-xs text-destructive">Aucune adresse e-mail sur la fiche du client : indiquez-la ici.</p>}</div>
          <div className="grid gap-1 text-sm"><label htmlFor={`${id}-s`} className="font-medium">Objet</label>
            <input id={`${id}-s`} className="rounded-md border bg-background p-2" maxLength={200} value={sujet} onChange={e => setSujet(e.target.value.replace(/[\r\n]/g, " "))} /></div>
          <div className="grid gap-1 text-sm"><label htmlFor={`${id}-t`} className="font-medium">Message</label>
            <textarea id={`${id}-t`} className="rounded-md border bg-background p-2" rows={11} maxLength={20000} value={texte} onChange={e => setTexte(e.target.value)} />
            {avecLien && texte.includes(REPERE_LIEN) && <p className="text-xs text-muted-foreground">Le repère « {REPERE_LIEN} » sera remplacé par un lien personnel, valable 30 jours ; le lien envoyé précédemment sera désactivé.</p>}</div>
          <div className="flex flex-col gap-2 rounded-xl border bg-secondary/30 p-3 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={avecPdf} onCheckedChange={c => setAvecPdf(c === true)} />Joindre le devis en PDF ({nomFichierDevis(doc.numero)})</label>
            <label className="flex items-center gap-2"><Checkbox checked={avecLien} onCheckedChange={c => void basculerLien(c === true)} />Inclure un lien pour signer en ligne</label>
          </div>
          {deja && <p className="text-sm text-muted-foreground">Cette étape est déjà notée pour ce devis : fermez la fenêtre.</p>}
          <div className="flex flex-wrap items-center gap-2">
            {gmail
              ? <Button disabled={chargement || !emailValide(dest)} onClick={() => void envoyerGmail()}>{phase === "envoi" ? "Envoi…" : "Envoyer avec Gmail"}</Button>
              : <p className="w-full text-xs text-muted-foreground">Gmail n’est pas encore connecté : le message s’ouvrira dans votre messagerie.</p>}
            {phase === "a-noter"
              ? <Button disabled={chargement} onClick={() => void confirmer("gmail")}>Noter l’envoi</Button>
              : <Button variant={gmail ? "outline" : "default"} disabled={chargement} onClick={() => void ouvrirMessagerie()}>Ouvrir dans ma messagerie</Button>}
            {nature !== "envoi" && phase === "edition" && <Button variant="ghost" disabled={chargement} onClick={() => void confirmer("aucun")}>Ne pas relancer ce devis</Button>}
          </div>
        </div>}
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
