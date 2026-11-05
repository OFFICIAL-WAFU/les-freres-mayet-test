import { useState } from "react";
import { toast } from "sonner";
import { relireFactureAvecSuivi, type DocumentAvecDevis } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { preparerRelance, preparerRelanceDevis } from "@/lib/relance";
import { lireMessages } from "@/data/messages";
import { rendreMessage } from "@/lib/messages";
import { contexteMessageDocument } from "@/components/MessageDocument";
import { Button } from "@/components/ui/button";
import { RelanceDevis } from "@/components/RelanceDevis";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function RelanceDialogue({ doc, compact = false }: { doc: DocumentAvecDevis; compact?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const estDevis = doc.type === "devis";
  const reste = suivre(doc.aRegler ?? 0n, doc.reglements ?? [], doc.credite ?? 0n).reste;
  if (doc.fictif || doc.statut !== "Finalisé" || !doc.devis || (!estDevis && (doc.type !== "facture" && doc.type !== "acompte" || reste <= 0n))) return null;
  // Devis : envoi et relances avec PDF joint et lien de signature (RelanceDevis) ; ce dialogue reste pour les factures.
  if (estDevis) return <RelanceDevis doc={doc} compact={compact} />;
  const preparer = async () => {
    setChargement(true);setErreur("");
    try {
    const actuel = estDevis ? doc : await relireFactureAvecSuivi(doc.id);
    if(!actuel || actuel.statut!=="Finalisé" || !actuel.devis)throw new Error("Le document finalisé n’est pas disponible. Rechargez la page.");
    const resteActuel = estDevis ? 0n : suivre(actuel.aRegler ?? 0n, actuel.reglements ?? [], actuel.credite ?? 0n).reste;
    if(!estDevis && resteActuel<=0n){toast.info("Cette facture n’a plus de reste à régler. Aucun rappel préparé.");return;}
    const b = await lireMessages();
    const commun = { numero: actuel.numero, client: actuel.devis.client.nom, entreprise: actuel.entrepriseFigee?.raisonSociale || "Les Frères Mayet" };
    const texte = estDevis ? preparerRelanceDevis({ ...commun, objet: actuel.devis.objet, validite: actuel.devis.validite }) : preparerRelance({ ...commun, reste:resteActuel, echeance: actuel.devis.validite, acompte: actuel.type === "acompte" });
    const modele = b.modeles[estDevis ? "rappelDevis" : "rappelPaiement"];
    const personnalise = modele ? rendreMessage(modele, contexteMessageDocument(actuel)) : null;
    setSujet(personnalise?.sujet ?? texte.sujet); setMessage(personnalise?.texte ?? texte.message); setOuvert(true);
    } catch(e) {setErreur(e instanceof Error ? e.message : "Préparation impossible.");} finally {setChargement(false);}
  };
  const contenu = () => `Destinataire : ${doc.devis!.client.email || "À renseigner"}\nObjet : ${sujet}\n\n${message}`;
  return <section className={compact ? "" : "rounded-xl border border-border p-3"}>
    {!compact && <><h3 className="font-semibold">Rappel client</h3>
    <p className="my-2 text-sm text-muted-foreground">{estDevis ? "Préparez un message de suivi du devis, sans demander de paiement ni présumer de l’accord du client." : "Préparez un message avec le reste à régler actuel."} Vous pourrez le modifier et le copier. Aucun email n’est envoyé.</p></>}
    <Button size={compact ? "sm" : "default"} variant="outline" disabled={chargement} onClick={()=>void preparer()} aria-label={compact ? `Préparer le rappel ${doc.numero}` : undefined}>{chargement ? "Préparation…" : compact ? "Préparer le rappel" : estDevis ? "Préparer une relance du devis" : "Préparer un rappel de paiement"}</Button>
    {erreur && <p role="alert" className="mt-2 text-sm text-destructive">{erreur}</p>}
    <Dialog open={ouvert} onOpenChange={setOuvert}><DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Message à relire avant envoi</DialogTitle><DialogDescription>{estDevis ? "Message de suivi uniquement : aucun accord ni signature n’est enregistré." : "Le texte est préparé à partir des règlements actuellement enregistrés."} Aucun envoi ni historique de relance automatique.</DialogDescription></DialogHeader>
      <p className="break-all text-sm">Destinataire : {doc.devis.client.email || "Adresse email non renseignée"}</p>
      <label className="grid gap-1 text-sm">Objet<input className="rounded-md border p-2" value={sujet} onChange={e => setSujet(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Message<textarea rows={12} className="min-w-0 rounded-md border p-2" value={message} onChange={e => setMessage(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={async () => { try { await navigator.clipboard.writeText(contenu()); toast.success("Message copié"); } catch { toast.error("Copie indisponible : sélectionnez le texte ou téléchargez-le."); } }}>Copier le message</Button>
        <Button variant="outline" onClick={() => {
          const mail = (doc.devis!.client.email || "").trim();
          if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(mail)) { toast.error("Adresse email du client absente ou invalide : renseignez-la sur la fiche client."); return; }
          const lien = `mailto:${encodeURIComponent(mail).replace(/%40/g, "@")}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(message.replace(/\r?\n/g, "\r\n"))}`;
          if (lien.length > 1900) { toast.error("Message trop long pour votre messagerie : utilisez « Copier le message »."); return; }
          window.location.href = lien;
        }}>Ouvrir dans ma messagerie</Button>
        <Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([contenu()], { type: "text/plain;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `Rappel_${doc.numero.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Télécharger le texte</Button>
      </div>
    </DialogContent></Dialog>
  </section>;
}
