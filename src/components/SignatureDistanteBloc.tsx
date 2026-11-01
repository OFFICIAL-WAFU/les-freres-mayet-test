import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { creerLienSignature, lireLiensDevis, revoquerLienSignature, type LienSignature } from "@/data/signature-distante";
import { etatLienProprietaire } from "@/lib/signature-distante";

const fr = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
const ETAT = { actif: "Actif", expire: "Expiré", revoque: "Désactivé", signe: "Signé" } as const;

/** Bloc d'un devis FINALISÉ : crée un lien de signature à envoyer au client, liste les liens et la signature reçue. */
export function SignatureDistanteBloc({ devisId, reference, clientNom, clientEmail }: { devisId: string; reference: string; clientNom: string; clientEmail: string }) {
  const [liens, setLiens] = useState<LienSignature[] | null | undefined>(undefined);
  const [nouveau, setNouveau] = useState<{ lien: string; expireLe: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const recharger = useCallback(() => { lireLiensDevis(devisId).then(l => { setLiens(l); setErreur(""); }).catch(e => setErreur(e instanceof Error ? e.message : "Lecture impossible.")); }, [devisId]);
  useEffect(() => { recharger(); }, [recharger]);

  if (liens === null) return null; // fonctionnalité non installée dans la base : rien n'est proposé
  const signe = liens?.find(l => l.signe_le);
  const creer = async () => {
    setOccupe(true);
    try { const r = await creerLienSignature(devisId); setNouveau({ lien: r.lien, expireLe: r.expireLe }); recharger(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Lien non créé."); } finally { setOccupe(false); }
  };
  const copier = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("Lien copié"); } catch { toast.error("Copie indisponible : sélectionnez le lien et copiez-le à la main."); } };
  const message = (lien: string) => `Bonjour ${clientNom},\n\nVoici votre devis ${reference}. Vous pouvez le consulter et le signer en ligne depuis ce lien :\n${lien}\n\nCe lien est personnel : merci de ne pas le partager.\n\nCordialement,\nLes Frères Mayet`;
  const mail = (lien: string) => {
    const dest = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(clientEmail.trim()) ? clientEmail.trim() : "";
    const url = `mailto:${dest}?subject=${encodeURIComponent(`Devis ${reference} à signer`)}&body=${encodeURIComponent(message(lien).replace(/\n/g, "\r\n"))}`;
    if (url.length > 1900) { toast.error("Message trop long pour votre messagerie : copiez le lien."); return; }
    window.location.href = url;
  };

  return <section className="rounded-xl border border-border p-3" aria-label="Signature à distance">
    <h3 className="font-semibold">Signature à distance</h3>
    {signe ? <div className="mt-2 text-sm">
      <p className="font-medium">Signé par {signe.signataire_nom} le {fr(signe.signe_le!)}</p>
      {signe.signature_image && <img src={signe.signature_image} alt={`Signature de ${signe.signataire_nom}`} className="mt-2 h-24 rounded-md border bg-white p-1" />}
      <p className="mt-2 break-all text-xs text-muted-foreground">Empreinte du devis signé (SHA-256) : {signe.empreinte_document}</p>
      <p className="mt-2 text-xs text-muted-foreground">Signature électronique simple : nom, tracé et « bon pour accord » horodatés. Elle n’est ni avancée ni qualifiée.</p>
    </div> : <>
      <p className="mt-1 text-sm text-muted-foreground">Créez un lien personnel que le client ouvre sur son téléphone pour lire et signer ce devis. Le lien est valable 30 jours ; en créer un nouveau désactive le précédent. Le devis lui-même n’est jamais modifié.</p>
      <div className="mt-3"><Button variant="outline" disabled={occupe || liens === undefined} onClick={() => void creer()}>{occupe ? "Création…" : "Créer un lien de signature"}</Button></div>
      {nouveau && <div className="mt-3 rounded-lg border bg-secondary/40 p-3 text-sm" role="status">
        <p className="font-medium">Lien créé, valable jusqu’au {fr(nouveau.expireLe)}. Copiez-le maintenant : il ne pourra plus être affiché.</p>
        <p className="mt-2 break-all rounded bg-background p-2 font-mono text-xs">{nouveau.lien}</p>
        <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => void copier(nouveau.lien)}>Copier le lien</Button><Button size="sm" variant="outline" onClick={() => void copier(message(nouveau.lien))}>Copier le message</Button><Button size="sm" variant="outline" onClick={() => mail(nouveau.lien)}>Ouvrir dans ma messagerie</Button></div>
      </div>}
    </>}
    {erreur && <p role="alert" className="mt-2 text-sm text-destructive">{erreur}</p>}
    {!!liens?.length && <div className="mt-3"><p className="text-sm font-medium">Liens créés</p><ul className="mt-1 divide-y text-sm">{liens.map(l => {
      const e = etatLienProprietaire(l, Date.now());
      return <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{fr(l.cree_le)} · {ETAT[e]}{e === "actif" ? ` jusqu’au ${fr(l.expire_le)}` : ""}</span>
        {e === "actif" && <Button size="sm" variant="ghost" disabled={occupe} onClick={() => { setOccupe(true); revoquerLienSignature(l.id).then(() => { toast.success("Lien désactivé"); setNouveau(null); recharger(); }).catch(er => toast.error(er instanceof Error ? er.message : "Échec")).finally(() => setOccupe(false)); }}>Désactiver</Button>}</li>; })}</ul></div>}
  </section>;
}
