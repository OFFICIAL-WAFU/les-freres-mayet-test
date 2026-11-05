import { useState } from "react";
import { toast } from "sonner";
import { Check, PackageCheck, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chargerDocuments, noterCommandeDevis, noterReponseDevis, type DocumentAvecDevis, type ReponseClient } from "@/data/documents";
import { dateParis } from "@/lib/echeances";
import { etatDevis } from "@/lib/statuts";
import { cn } from "@/lib/utils";

const dateFr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const MODES: Record<string, string> = { signature_distante: "signé à distance", signature_khosmos: "signé électroniquement dans Khosmos", manuelle: "noté à la main" };

/** Suivi d'un devis finalisé : signature (ou refus) puis commande passée. Les étapes se notent en un clic, date modifiable. */
export function SuiviDevisBloc({ doc }: { doc: DocumentAvecDevis }) {
  const aujourdHui = dateParis();
  const [date, setDate] = useState(aujourdHui);
  const [occupe, setOccupe] = useState(false);
  const etat = etatDevis(doc, aujourdHui);
  const r = doc.reponse;
  const signeElectronique = r?.mode === "signature_distante" || r?.mode === "signature_khosmos";

  async function agir(action: () => Promise<void>, message: string) {
    setOccupe(true);
    try { await action(); toast.success(message); void chargerDocuments(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setOccupe(false); }
  }
  const repondre = (rep: ReponseClient, msg: string) => agir(() => noterReponseDevis(doc.id, rep, rep === "attente" ? undefined : date), msg);
  const commande = (d: string | null, msg: string) => agir(() => noterCommandeDevis(doc.id, d), msg);

  const etapes = [
    { cle: "envoye", titre: etat === "expire" ? "Validité dépassée" : "En attente de signature", fait: true, detail: doc.devis?.validite ? `Valable jusqu’au ${dateFr(doc.devis.validite)}` : "" },
    etat === "refuse"
      ? { cle: "refuse", titre: "Refusé", fait: true, detail: r?.le ? `le ${dateFr(r.le)}` : "", refus: true }
      : { cle: "signe", titre: "Signé", fait: etat === "signe", detail: etat === "signe" ? [r?.le ? `le ${dateFr(r.le)}` : "", r?.mode ? MODES[r.mode] : ""].filter(Boolean).join(" · ") : "" },
    ...(etat === "refuse" ? [] : [{ cle: "commande", titre: "Commande passée", fait: !!r?.commandeLe, detail: r?.commandeLe ? `le ${dateFr(r.commandeLe)}` : "" }]),
  ];

  return (
    <section className="rounded-xl border bg-card p-4" aria-label="Suivi du devis">
      <h3 className="font-semibold">Suivi du devis</h3>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {etapes.map((e) => (
          <li key={e.cle} className={cn("flex gap-2 rounded-lg border p-3", e.fait ? ("refus" in e && e.refus ? "border-destructive/40 bg-destructive/5" : "border-teal-300 bg-teal-50") : "border-dashed text-muted-foreground")}>
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white", e.fait ? ("refus" in e && e.refus ? "bg-destructive" : "bg-teal-600") : "bg-muted")}>
              {e.fait ? ("refus" in e && e.refus ? <X className="size-3" /> : <Check className="size-3" />) : null}
            </span>
            <span><span className="block font-medium text-foreground">{e.titre}</span>{e.detail && <span className="text-xs text-muted-foreground">{e.detail}</span>}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        {(etat !== "signe" || !r?.commandeLe) && (
          <label className="grid gap-1 text-xs text-muted-foreground">Date
            <input type="date" className="rounded-md border bg-background p-1.5 text-sm text-foreground" value={date} max={aujourdHui} onChange={(e) => setDate(e.target.value || aujourdHui)} />
          </label>
        )}
        {(etat === "attente" || etat === "expire" || etat === "refuse") && (
          <Button size="sm" disabled={occupe} onClick={() => void repondre("accepte", "Devis marqué comme signé")}><Check className="size-4" /> Marquer comme signé</Button>
        )}
        {(etat === "attente" || etat === "expire") && (
          <Button size="sm" variant="outline" disabled={occupe} onClick={() => void repondre("refuse", "Devis marqué comme refusé")}><X className="size-4" /> Marquer comme refusé</Button>
        )}
        {etat === "signe" && !r?.commandeLe && (
          <Button size="sm" disabled={occupe} onClick={() => void commande(date, "Commande notée comme passée")}><PackageCheck className="size-4" /> Commande passée</Button>
        )}
        {etat === "signe" && r?.commandeLe && (
          <Button size="sm" variant="ghost" disabled={occupe} onClick={() => void commande(null, "Commande remise à passer")}><Undo2 className="size-4" /> Annuler « commande passée »</Button>
        )}
        {((etat === "signe" && !signeElectronique && !r?.commandeLe) || etat === "refuse") && (
          <Button size="sm" variant="ghost" disabled={occupe} onClick={() => void repondre("attente", "Devis remis en attente")}><Undo2 className="size-4" /> Remettre en attente</Button>
        )}
      </div>
      {signeElectronique && etat === "signe" && <p className="mt-2 text-xs text-muted-foreground">Signature électronique : elle ne peut pas être retirée.</p>}
    </section>
  );
}
