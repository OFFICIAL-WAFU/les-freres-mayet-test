import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
import { formaterCentimes, labelTaux, recapituler, validerLigne } from "@/data/devis";
import { preparerAvoir, type DocumentAvecDevis } from "@/data/documents";

const fr = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

/** Totaux d'un avoir : montants positifs à créditer. */
export function TotauxAvoir({ doc }: { doc: DocumentAvecDevis }) {
  const r = recapituler(doc.devis!.lignes);
  return (
    <dl className="mt-3 flex flex-col gap-2 text-sm">
      <div className="flex justify-between gap-2"><dt>Total HT à créditer</dt><dd className="font-medium">{formaterCentimes(r.ht)}</dd></div>
      {r.parTaux.map((t) => (
        <div key={t.taux} className="flex justify-between gap-2 text-muted-foreground">
          <dt>TVA {labelTaux(t.taux)} sur {formaterCentimes(t.base)}</dt><dd>{formaterCentimes(t.tva)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-2"><dt>Total TVA à créditer</dt><dd className="font-medium">{formaterCentimes(r.tva)}</dd></div>
      <div className="flex justify-between gap-2 border-t border-border pt-2 text-base">
        <dt className="font-semibold">Total de l'avoir TTC</dt><dd className="font-semibold">{formaterCentimes(r.ttc)}</dd>
      </div>
    </dl>
  );
}

/** Consultation d'un avoir brouillon. */
export function AvoirDetail({ doc, onNavigate }: { doc: DocumentAvecDevis; onNavigate?: () => void }) {
  const d = doc.devis!;
  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatutBadge statut="Brouillon" />
        <span className="text-muted-foreground">Avoir total · référence provisoire {doc.numero} — non émis · sur la facture {doc.factureSource?.reference}</span>
      </div>
      <p className="rounded-xl border border-border bg-secondary/50 p-3">
        Brouillon uniquement : aucun remboursement n'est effectué et le reste à régler de la facture n'est pas modifié.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild variant="action"><Link to="/avoirs/$id/modifier" params={{ id: doc.id }} onClick={onNavigate}>Modifier l'avoir brouillon</Link></Button>
        <Button asChild variant="outline"><Link to="/avoirs/$id/apercu" params={{ id: doc.id }} onClick={onNavigate}>Aperçu de l'avoir</Link></Button>
        {doc.factureSource && (
          <Button asChild variant="ghost"><Link to="/factures/$id" params={{ id: doc.factureSource.id }} onClick={onNavigate}>Voir la facture {doc.factureSource.reference}</Link></Button>
        )}
      </div>
      <section>
        <h3 className="font-semibold">Informations de l'avoir</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Objet</dt><dd className="font-medium break-words">{d.objet}</dd></div>
          <div><dt className="text-muted-foreground">Date</dt><dd className="font-medium">{fr(d.date)}</dd></div>
          <div><dt className="text-muted-foreground">Facture d'origine</dt><dd className="font-medium">{doc.factureSource?.reference}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Motif</dt><dd className="font-medium whitespace-pre-wrap break-words">{doc.motif}</dd></div>
        </dl>
      </section>
      <section>
        <h3 className="font-semibold">Client (coordonnées reprises de la facture)</h3>
        <div className="mt-2">
          <p className="font-medium">{d.client.nom}</p>
          {d.client.adresse.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </section>
      <section>
        <h3 className="font-semibold">Lignes (reprises de la facture, non modifiables)</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {d.lignes.map((l, i) => {
            const c = validerLigne(l).calcul;
            return (
              <li key={l.cle} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium break-words">{i + 1}. {l.designation}</p>
                  <p className="font-semibold">{c ? formaterCentimes(c.ht) : "—"} HT</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {TYPE_ARTICLE_LABELS[l.type]} · {l.quantite} {l.unite ? UNITE_LABELS[l.unite] : ""} × {l.prix} € HT · TVA {l.taux !== null ? labelTaux(l.taux) : "—"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="rounded-xl border border-border p-3">
        <h3 className="font-semibold">Total de l'avoir</h3>
        <TotauxAvoir doc={doc} />
        <p className="mt-2 text-xs text-muted-foreground">Montants à créditer, non comptés dans les ventes ni dans les sommes dues.</p>
      </section>
      <section>
        <h3 className="font-semibold">Remarques destinées au client</h3>
        <p className="mt-1 whitespace-pre-wrap">{d.remarques.trim() || "—"}</p>
      </section>
    </div>
  );
}

/** Dialogue de préparation d'un avoir total brouillon depuis une facture finalisée. */
export function AvoirDialogue({ facture, onFermer, onNavigate }: { facture: DocumentAvecDevis; onFermer: () => void; onNavigate?: (() => void) | undefined }) {
  const navigate = useNavigate();
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function preparer() {
    if (enCours || !motif.trim()) return;
    setEnCours(true); setErreur(null);
    try {
      const a = await preparerAvoir(facture.id, motif);
      onFermer(); onNavigate?.();
      navigate({ to: "/avoirs/$id", params: { id: a.id } });
    } catch (e) { setErreur((e as Error).message); } finally { setEnCours(false); }
  }
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Préparer un avoir total ?</AlertDialogTitle>
          <AlertDialogDescription>
            Seul un avoir brouillon sera créé pour la facture {facture.numero}, avec les mêmes lignes et montants. Aucun remboursement n'est effectué et le reste à régler n'est pas modifié.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex flex-col gap-1 text-sm">Motif (obligatoire)
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={1000} />
        </label>
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours} onClick={onFermer}>Annuler</AlertDialogCancel>
          <Button variant="action" disabled={enCours || !motif.trim()} onClick={() => void preparer()}>
            {enCours && <Loader2 className="animate-spin" />}{enCours ? "Préparation…" : "Préparer l'avoir brouillon"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
