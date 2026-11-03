import { useState } from "react";
import { MessageDocument } from "@/components/MessageDocument";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TYPE_ARTICLE_LABELS, uniteAccordee } from "@/data/catalogue";
import { formaterCentimes, labelTaux, recapituler, validerLigne } from "@/data/devis";
import { toast } from "sonner";
import { AlertTriangle, Download } from "lucide-react";
import { versPublic } from "@/components/DevisApercu";
import { abandonnerAvoir, ConflitDevis, finaliserAvoir, lignesCrediteesDe, preparerAvoir, preparerAvoirPartiel, type DocumentAvecDevis } from "@/data/documents";
import { calculerAvoirPartiel, milliemesEnTexte, quantiteEnMilliemes, resteParLigne } from "@/lib/avoirs-partiels";
import { telechargerDevisPdf } from "@/lib/devisPdf";

const fr = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");
const frDH = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

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

/** Consultation d'un avoir (brouillon ou finalisé). */
export function AvoirDetail({ doc, onNavigate }: { doc: DocumentAvecDevis; onNavigate?: () => void }) {
  const d = doc.devis!;
  const finalise = doc.statut === "Finalisé";
  const [dlg, setDlg] = useState(false);
  const [dlgAbandon, setDlgAbandon] = useState(false);
  const nature = doc.typeAvoir === "partiel" ? "Avoir partiel" : "Avoir total";
  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatutBadge statut={finalise ? "Finalisé" : "Brouillon"} />
        <span className="text-muted-foreground">
          {finalise
            ? <>{nature} {doc.numero} · finalisé le {doc.finaliseLe ? frDH(doc.finaliseLe) : "—"} · sur la facture {doc.factureSource?.reference}</>
            : <>{nature} · référence provisoire {doc.numero} — non émis · sur la facture {doc.factureSource?.reference}</>}
        </span>
      </div>
      <p className="rounded-xl border border-border bg-secondary/50 p-3">
        {finalise
          ? "Avoir finalisé : il réduit le solde de la facture d'origine. Aucun remboursement bancaire n'a été effectué. Il ne peut plus être modifié ni supprimé."
          : "Brouillon uniquement : aucun remboursement n'est effectué et le reste à régler de la facture n'est pas modifié."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!finalise && <Button variant="action" onClick={() => setDlg(true)}>Finaliser l'avoir</Button>}
        {!finalise && <Button asChild variant="outline"><Link to="/avoirs/$id/modifier" params={{ id: doc.id }} onClick={onNavigate}>Modifier l'avoir brouillon</Link></Button>}
        {!finalise && <Button variant="ghost" onClick={() => setDlgAbandon(true)}>Abandonner ce brouillon</Button>}
        {!finalise && <Button asChild variant="outline"><Link to="/avoirs/$id/apercu" params={{ id: doc.id }} onClick={onNavigate}>Aperçu de l'avoir</Link></Button>}
        {finalise && <AvoirPdfBouton doc={doc} />}
        {doc.factureSource && (
          <Button asChild variant="ghost"><Link to="/factures/$id" params={{ id: doc.factureSource.id }} onClick={onNavigate}>Voir la facture {doc.factureSource.reference}</Link></Button>
        )}
      </div>
      <MessageDocument doc={doc} />
      {dlg && <FinaliserAvoirDialogue doc={doc} onFermer={() => setDlg(false)} />}
      {dlgAbandon && <AbandonAvoirDialogue doc={doc} onFermer={() => setDlgAbandon(false)} onNavigate={onNavigate} />}
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
        <h3 className="font-semibold">{doc.typeAvoir === "partiel" ? "Lignes créditées (quantités choisies, non modifiables — abandonnez le brouillon pour en choisir d'autres)" : "Lignes (reprises de la facture, non modifiables)"}</h3>
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
                  {TYPE_ARTICLE_LABELS[l.type]} · {l.quantite} {l.unite ? uniteAccordee(l.unite, l.quantite) : ""} × {l.prix} € HT · TVA {l.taux !== null ? labelTaux(l.taux) : "—"}
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

/** Dialogue de préparation d'un avoir brouillon (total ou partiel) depuis une facture finalisée. */
export function AvoirDialogue({ facture, mode = "total", documents = [], onFermer, onNavigate }: { facture: DocumentAvecDevis; mode?: "total" | "partiel"; documents?: DocumentAvecDevis[]; onFermer: () => void; onNavigate?: (() => void) | undefined }) {
  const navigate = useNavigate();
  const [motif, setMotif] = useState("");
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const partiel = mode === "partiel";
  const lignes = facture.lignesFacture ?? [];
  const creditees = lignesCrediteesDe(documents, facture.id);
  const restes = resteParLigne(lignes, creditees);
  const dejaTtc = documents.filter((d) => d.type === "avoir" && d.factureSource?.id === facture.id && d.statut === "Finalisé").reduce((n, d) => n + Math.round((d.montantTTC ?? 0) * 100), 0);
  const totalTtc = Math.round((facture.montantTTC ?? 0) * 100);
  const demandes = Object.entries(saisies).filter(([, v]) => v.trim() !== "").map(([id, v]) => ({ id, quantiteMilliemes: quantiteEnMilliemes(v) ?? -1 }));
  const calcul = partiel && demandes.length ? calculerAvoirPartiel(lignes, creditees, demandes, totalTtc, dejaTtc) : null;
  const MSG_CALCUL: Record<string, string> = {
    quantite_invalide: "Quantité invalide (nombre positif, 3 décimales au plus).", quantite_depassee: "Une quantité dépasse ce qu'il reste à créditer.",
    montant_nul: "Le montant de l'avoir est nul.", depasse_facture: "Le total des avoirs dépasserait la facture.",
    ligne_non_creditable: "Une ligne ne peut pas être créditée.", ligne_inconnue: "Ligne inconnue.", aucune_ligne: "",
  };
  const pret = !!motif.trim() && (!partiel || calcul?.ok === true);
  async function preparer() {
    if (enCours || !pret) return;
    setEnCours(true); setErreur(null);
    try {
      const a = partiel ? await preparerAvoirPartiel(facture.id, motif, demandes) : await preparerAvoir(facture.id, motif);
      onFermer(); onNavigate?.();
      navigate({ to: "/avoirs/$id", params: { id: a.id } });
    } catch (e) { setErreur((e as Error).message); } finally { setEnCours(false); }
  }
  return (
    <AlertDialog open>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{partiel ? "Préparer un avoir partiel ?" : "Préparer un avoir total ?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {partiel
              ? `Indiquez la quantité à créditer sur chaque ligne de la facture ${facture.numero}. Seul un avoir brouillon sera créé : aucun remboursement n'est effectué et le reste à régler n'est pas modifié. Le total des avoirs ne peut pas dépasser la facture.`
              : `Seul un avoir brouillon sera créé pour la facture ${facture.numero}, avec les mêmes lignes et montants. Aucun remboursement n'est effectué et le reste à régler n'est pas modifié.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {partiel && (
          <ul className="flex flex-col gap-2">
            {lignes.map((l) => {
              const r = restes.find((x) => x.id === l.id)!;
              return (
                <li key={l.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-medium break-words">{l.designation}</p>
                  <p className="text-xs text-muted-foreground">Facturé {milliemesEnTexte(l.quantiteMilliemes)} · déjà crédité {milliemesEnTexte(r.deja)} · reste {milliemesEnTexte(r.reste)}</p>
                  {r.reste > 0 && r.creditable ? (
                    <label className="mt-2 flex items-center gap-2">Quantité à créditer
                      <input inputMode="decimal" className="w-24 rounded-md border p-1.5 text-right" value={saisies[l.id] ?? ""} placeholder="0"
                        onChange={(e) => setSaisies((v) => ({ ...v, [l.id]: e.target.value }))} aria-label={`Quantité à créditer : ${l.designation}`} />
                      <Button type="button" size="sm" variant="ghost" onClick={() => setSaisies((v) => ({ ...v, [l.id]: milliemesEnTexte(r.reste) }))}>Tout</Button>
                    </label>
                  ) : <p className="mt-1 text-xs text-muted-foreground">Rien à créditer sur cette ligne.</p>}
                </li>
              );
            })}
            {calcul?.ok && <li className="rounded-xl border border-border bg-secondary/50 p-3 text-sm font-semibold">Total de l'avoir TTC : {formaterCentimes(BigInt(calcul.ttc))} <span className="font-normal text-muted-foreground">(HT {formaterCentimes(BigInt(calcul.ht))})</span></li>}
            {calcul && !calcul.ok && MSG_CALCUL[calcul.erreur] && <li role="alert" className="text-sm text-destructive">{MSG_CALCUL[calcul.erreur]}</li>}
          </ul>
        )}
        <label className="flex flex-col gap-1 text-sm">Motif (obligatoire)
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={1000} />
        </label>
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours} onClick={onFermer}>Annuler</AlertDialogCancel>
          <Button variant="action" disabled={enCours || !pret} onClick={() => void preparer()}>
            {enCours && <Loader2 className="animate-spin" />}{enCours ? "Préparation…" : "Préparer l'avoir brouillon"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Abandon d'un brouillon d'avoir : la trace est conservée, aucun numéro n'est consommé. */
function AbandonAvoirDialogue({ doc, onFermer, onNavigate }: { doc: DocumentAvecDevis; onFermer: () => void; onNavigate?: (() => void) | undefined }) {
  const navigate = useNavigate();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function abandonner() {
    if (enCours) return;
    setEnCours(true); setErreur(null);
    try {
      await abandonnerAvoir(doc.id, doc.version ?? 0);
      onFermer(); onNavigate?.();
      toast.success("Brouillon d'avoir abandonné");
      if (doc.factureSource) navigate({ to: "/factures/$id", params: { id: doc.factureSource.id } }); else navigate({ to: "/" });
    } catch (e) {
      setErreur(e instanceof ConflitDevis ? "L'avoir a été modifié entre-temps. Fermez et rouvrez-le avant de l'abandonner." : (e as Error).message);
    } finally { setEnCours(false); }
  }
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abandonner ce brouillon d'avoir ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le brouillon {doc.numero} ne sera plus utilisable. Aucun numéro d'avoir n'est consommé et la facture n'est pas modifiée. Vous pourrez préparer un nouvel avoir ensuite.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours} onClick={onFermer}>Garder le brouillon</AlertDialogCancel>
          <Button variant="destructive" disabled={enCours} onClick={() => void abandonner()}>
            {enCours && <Loader2 className="animate-spin" />}{enCours ? "Abandon…" : "Abandonner le brouillon"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Confirmation de finalisation : facture source, motif, montant ; aucun remboursement. */
function FinaliserAvoirDialogue({ doc, onFermer }: { doc: DocumentAvecDevis; onFermer: () => void }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const ttc = recapituler(doc.devis!.lignes).ttc;
  async function finaliser() {
    if (enCours) return;
    setEnCours(true); setErreur(null);
    try {
      const a = await finaliserAvoir(doc.id, doc.version ?? 0);
      onFermer();
      toast.success(`Avoir finalisé : ${a.numero}`);
    } catch (e) {
      setErreur(e instanceof ConflitDevis ? "L'avoir a été modifié entre-temps. Fermez et rouvrez-le avant de finaliser." : (e as Error).message);
    } finally { setEnCours(false); }
  }
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finaliser l'avoir ?</AlertDialogTitle>
          <AlertDialogDescription>
            Un numéro définitif sera attribué et l'avoir ne pourra plus être modifié. Aucun remboursement bancaire ne sera effectué.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid gap-2 text-sm">
          <div><dt className="text-muted-foreground">Facture d'origine</dt><dd className="font-medium">{doc.factureSource?.reference}</dd></div>
          <div><dt className="text-muted-foreground">Motif</dt><dd className="font-medium whitespace-pre-wrap break-words">{doc.motif}</dd></div>
          <div><dt className="text-muted-foreground">Total de l'avoir TTC</dt><dd className="font-semibold">{formaterCentimes(ttc)}</dd></div>
        </dl>
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours} onClick={onFermer}>Annuler</AlertDialogCancel>
          <Button variant="action" disabled={enCours} onClick={() => void finaliser()}>
            {enCours && <Loader2 className="animate-spin" />}{enCours ? "Finalisation…" : "Finaliser l'avoir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** PDF d'un avoir finalisé : uniquement les données figées. Un échec ne relance jamais la finalisation. */
function AvoirPdfBouton({ doc }: { doc: DocumentAvecDevis }) {
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState(false);
  const ent = doc.entrepriseFigee;
  async function telecharger() {
    if (!doc.devis || !ent || enCours) return;
    setEnCours(true); setEchec(false);
    try {
      await telechargerDevisPdf(structuredClone(versPublic(doc.devis)), doc.numero, { ...ent }, true,
        { sourceRef: doc.factureSource?.reference ?? "", finalisee: true, avoir: { motif: doc.motif ?? "" } });
    } catch { setEchec(true); } finally { setEnCours(false); }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={() => void telecharger()} disabled={enCours || !ent} aria-busy={enCours}>
        {enCours ? <Loader2 className="animate-spin" /> : <Download />}{enCours ? "Génération du PDF…" : "Télécharger le PDF"}
      </Button>
      {echec && (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="size-4" />Le PDF n'a pas pu être généré. L'avoir est intact ; vous pouvez réessayer.
        </p>
      )}
    </div>
  );
}
