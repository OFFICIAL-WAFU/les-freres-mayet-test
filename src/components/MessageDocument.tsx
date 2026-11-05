import { useId, useState } from "react";
import { toast } from "sonner";
import { relireFactureAvecSuivi, type DocumentAvecDevis } from "@/data/documents";
import { formaterCentimes, recapituler } from "@/data/devis";
import { suivre } from "@/data/reglements";
import { lireMessages } from "@/data/messages";
import { MODELES_MESSAGES, rendreMessage, type ContexteMessage, type TypeMessage } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function contexteMessageDocument(doc: DocumentAvecDevis): ContexteMessage {
  const d=doc.devis!;
  const recap=recapituler(d.lignes);
  const facture=doc.type==="facture" || doc.type==="acompte";
  return {client:d.client.nom, numero:doc.numero, objet:d.objet,
    entreprise:doc.entrepriseFigee?.raisonSociale || "Les Frères Mayet",
    montant:formaterCentimes(facture ? doc.aRegler ?? recap.ttc : recap.ttc),
    reste:facture ? formaterCentimes(suivre(doc.aRegler ?? 0n,doc.reglements ?? [],doc.credite ?? 0n).reste) : "Sans objet",
    echeance:d.validite ? d.validite.split("-").reverse().join("/") : "Non renseignée", lien_signature:""};
}
export function MessageDocument({doc}:{doc:DocumentAvecDevis}) {
  const id=useId();
  const [ouvert,setOuvert]=useState(false), [chargement,setChargement]=useState(false);
  const [sujet,setSujet]=useState(""), [texte,setTexte]=useState("");
  const [erreur,setErreur]=useState("");
  if(doc.fictif || doc.statut!=="Finalisé" || !doc.devis || !["devis","facture","acompte","avoir"].includes(doc.type))return null;
  async function preparer(){
    setChargement(true);setErreur("");
    try{const actuel=doc.type==="facture" || doc.type==="acompte" ? await relireFactureAvecSuivi(doc.id) : doc;
      if(!actuel || actuel.statut!=="Finalisé" || !actuel.devis)throw new Error("Le document finalisé n’est pas disponible. Rechargez la page.");
      const b=await lireMessages(), type=actuel.type as TypeMessage;
      const m=rendreMessage(b.modeles[type] ?? MODELES_MESSAGES[type],contexteMessageDocument(actuel));
      setSujet(m.sujet);setTexte(m.texte);setOuvert(true);
    }catch(e){setErreur(e instanceof Error ? e.message : "Préparation impossible.");}finally{setChargement(false);}
  }
  const contenu=()=>`Destinataire : ${doc.devis!.client.email || "À renseigner"}\nObjet : ${sujet}\n\n${texte}`;
  return <section className="rounded-xl border p-3">
    <h3 className="font-semibold">Message d’accompagnement</h3>
    <p className="my-2 text-sm text-muted-foreground">Préparez le message à copier dans votre messagerie. Téléchargez le PDF et ajoutez-le vous-même en pièce jointe. Aucun envoi automatique.</p>
    <Button variant="outline" disabled={chargement} onClick={()=>void preparer()}>{chargement ? "Préparation…" : "Préparer le message client"}</Button>
    {erreur&&<p role="alert" className="mt-2 text-destructive">{erreur}</p>}
    <Dialog open={ouvert} onOpenChange={setOuvert}><DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>Message à relire avant envoi</DialogTitle><DialogDescription>Le document reste inchangé. Rien n’est envoyé et aucune pièce jointe n’est ajoutée ici.</DialogDescription></DialogHeader>
      <p className="break-all text-sm">Destinataire : {doc.devis.client.email || "Adresse e-mail non renseignée"}</p>
      <div className="grid gap-1 text-sm"><label htmlFor={`${id}-objet`}>Objet du message</label><input id={`${id}-objet`} className="min-w-0 rounded-md border p-2" maxLength={1000} value={sujet} onChange={e=>setSujet(e.target.value.replace(/[\r\n]/g," "))}/></div>
      <div className="grid gap-1 text-sm"><label htmlFor={`${id}-texte`}>Texte du message</label><textarea id={`${id}-texte`} className="min-w-0 rounded-md border p-2" rows={12} maxLength={20000} value={texte} onChange={e=>setTexte(e.target.value)}/></div>
      <div className="flex flex-wrap gap-2"><Button onClick={async()=>{try{await navigator.clipboard.writeText(contenu());toast.success("Message copié");}catch{toast.error("Copie indisponible : sélectionnez le texte ou téléchargez-le.");}}}>Copier le message</Button>
      <Button variant="outline" onClick={()=>{const url=URL.createObjectURL(new Blob([contenu()],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`Message_${doc.numero.replace(/[^a-zA-Z0-9_-]/g,"_")}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Télécharger le texte</Button></div>
      <p className="text-xs text-muted-foreground">Les coordonnées sont celles figées sur ce document. Vérifiez le destinataire avant de l’utiliser dans votre messagerie.</p>
    </DialogContent></Dialog>
  </section>;
}
