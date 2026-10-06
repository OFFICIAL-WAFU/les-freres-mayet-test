import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formaterCentimes } from "@/data/devis";
import { chargerDocuments, type DocumentAvecDevis } from "@/data/documents";
import {
  MODES_REGLEMENT, analyserMontant, annulerReglement, enregistrerReglement, suivre,
  type ModeReglement, type Reglement,
} from "@/data/reglements";

const fr = (iso: string) => iso.split("-").reverse().join("/");
const frDH = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));
const auj = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
const euros = (c: bigint) => `${c / 100n},${String(c % 100n).padStart(2, "0")}`;

/** Suivi des règlements d'une facture finalisée (ordinaire ou d'acompte). */
export function ReglementsBloc({ doc }: { doc: DocumentAvecDevis }) {
  const reglements = doc.reglements ?? [];
  const s = suivre(doc.aRegler ?? 0n, reglements);
  const [form, setForm] = useState(false);
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(auj());
  const [mode, setMode] = useState<ModeReglement>("virement");
  const [commentaire, setCommentaire] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const tentative = useRef<string | null>(null);
  const [aAnnuler, setAAnnuler] = useState<Reglement | null>(null);
  const [motif, setMotif] = useState("");

  const centimes = analyserMontant(montant);
  const valide = centimes !== null && centimes <= s.reste && !!date;

  function ouvrir() {
    setMontant(euros(s.reste)); setDate(auj()); setMode("virement"); setCommentaire(""); setErreur(null);
    tentative.current = null; setForm(true);
  }
  async function enregistrer() {
    if (enCours || centimes === null) return;
    setEnCours(true); setErreur(null);
    tentative.current ??= crypto.randomUUID();
    try {
      await enregistrerReglement({ id: tentative.current, factureId: doc.id, montant: centimes, date, mode, commentaire });
      await chargerDocuments();
      setConfirmer(false); setForm(false); tentative.current = null;
      toast.success(`Règlement de ${formaterCentimes(centimes)} enregistré`);
    } catch (e) {
      setConfirmer(false); setErreur((e as Error).message);
    } finally { setEnCours(false); }
  }
  async function annuler() {
    if (enCours || !aAnnuler || !motif.trim()) return;
    setEnCours(true); setErreur(null);
    try {
      await annulerReglement(aAnnuler.id, motif);
      await chargerDocuments();
      setAAnnuler(null); setMotif("");
      toast.success("Règlement annulé");
    } catch (e) {
      setAAnnuler(null); setErreur((e as Error).message);
    } finally { setEnCours(false); }
  }

  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="font-semibold">Règlements</h3>
      <p className="mt-1 font-medium">État du paiement : {s.etat}</p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Montant facturé{doc.deduction ? " (solde)" : ""}</dt><dd className="font-medium">{formaterCentimes(s.aRegler)}</dd></div>
        <div><dt className="text-muted-foreground">Montant réglé</dt><dd className="font-medium">{formaterCentimes(s.regle)}</dd></div>
        <div><dt className="text-muted-foreground">Reste à régler</dt><dd className="font-semibold">{formaterCentimes(s.reste)}</dd></div>
      </dl>
      {doc.type === "acompte" && <p className="mt-2 text-xs text-muted-foreground">Les règlements de l'acompte sont affectés uniquement à cette facture d'acompte.</p>}
      {erreur && <p role="alert" className="mt-2 rounded-xl border border-destructive/40 bg-card p-2">{erreur}</p>}

      {s.reste > 0n && !form && <Button className="mt-3" variant="outline" onClick={ouvrir}>Enregistrer un règlement</Button>}
      {form && (
        <div className="mt-3 grid gap-3 rounded-xl border border-border bg-secondary/40 p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">Montant (€)
            <Input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} aria-invalid={!valide} />
            {montant && centimes === null && <span className="text-xs text-destructive">Montant positif, deux décimales au plus.</span>}
            {centimes !== null && centimes > s.reste && <span className="text-xs text-destructive">Supérieur au reste à régler ({formaterCentimes(s.reste)}).</span>}
          </label>
          <label className="flex flex-col gap-1">Date du règlement
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">Mode
            <select className="h-10 rounded-md border border-input bg-background px-3" value={mode} onChange={(e) => setMode(e.target.value as ModeReglement)}>
              {Object.entries(MODES_REGLEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Référence ou commentaire interne (facultatif)
            <Input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={500} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="action" disabled={!valide} onClick={() => setConfirmer(true)}>Enregistrer le règlement</Button>
            <Button variant="ghost" onClick={() => setForm(false)}>Annuler</Button>
          </div>
        </div>
      )}

      <h4 className="mt-4 font-medium">Historique</h4>
      {reglements.length === 0 ? <p className="text-muted-foreground">Aucun règlement enregistré.</p> : (
        <ul className="mt-2 flex flex-col gap-2">
          {reglements.map((r) => (
            <li key={r.id} className={`rounded-xl border border-border p-3 ${r.annuleLe ? "bg-muted text-muted-foreground" : ""}`}>
              <div className="flex flex-wrap justify-between gap-2">
                <p className={`font-medium ${r.annuleLe ? "line-through" : ""}`}>{formaterCentimes(r.montant)} · {MODES_REGLEMENT[r.mode]} · {fr(r.date)}</p>
                {!r.annuleLe && <Button size="sm" variant="ghost" onClick={() => { setMotif(""); setAAnnuler(r); }}>Annuler ce règlement</Button>}
              </div>
              {r.commentaire && <p className="text-xs">{r.commentaire}</p>}
              <p className="text-xs">Saisi le {frDH(r.creeLe)}</p>
              {r.annuleLe && <p className="text-xs">Annulé le {frDH(r.annuleLe)} — motif : {r.motifAnnulation}</p>}
            </li>
          ))}
        </ul>
      )}

      {confirmer && centimes !== null && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Enregistrer ce règlement ?</AlertDialogTitle>
              <AlertDialogDescription>
                {formaterCentimes(centimes)} par {MODES_REGLEMENT[mode].toLowerCase()} le {fr(date)} sur {doc.numero}. Reste après enregistrement : {formaterCentimes(s.reste - centimes)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enCours} onClick={() => setConfirmer(false)}>Revenir</AlertDialogCancel>
              <Button variant="action" disabled={enCours} onClick={() => void enregistrer()}>
                {enCours && <Loader2 className="animate-spin" />}{enCours ? "Enregistrement…" : "Confirmer"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {aAnnuler && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler ce règlement de {formaterCentimes(aAnnuler.montant)} ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette annulation corrige une saisie et ne réalise aucun remboursement bancaire. Le règlement reste visible dans l'historique.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="flex flex-col gap-1 text-sm">Motif (obligatoire)
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} />
            </label>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enCours} onClick={() => setAAnnuler(null)}>Revenir</AlertDialogCancel>
              <Button variant="action" disabled={enCours || !motif.trim()} onClick={() => void annuler()}>
                {enCours && <Loader2 className="animate-spin" />}Confirmer l'annulation
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
