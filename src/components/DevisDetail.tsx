import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Recap } from "@/components/DevisForm";
import { DeductionBloc } from "@/components/DeductionBloc";
import { MSG_REGLEMENT, solde } from "@/data/deduction";
import { AcompteDialogue } from "@/components/AcompteDialogue";
import { FacturePdfBouton } from "@/components/FacturePdfBouton";
import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
import { formaterCentimes, labelTaux, recapituler, validerLigne } from "@/data/devis";
import {
  ConflitDevis, DeductionAcompteRequise, FinalisationRefusee, DevisIncomplet, acompteDuDevis, EtatIncertain, chargerDocuments, factureDuDevis, finaliserDevis, finaliserFacture, preparerFacture, relireDevis, relireFacture,
  useEtatDocuments, type DocumentAvecDevis,
} from "@/data/documents";

const MANQUES: Record<string, string> = {
  fiche_entreprise: "La fiche entreprise n'est pas encore enregistrée (rubrique Entreprise).",
  raison_sociale_entreprise: "La raison sociale de l'entreprise est absente.",
  adresse_entreprise: "L'adresse postale de l'entreprise (adresse, code postal et ville) est incomplète.",
  client: "Le client du devis est introuvable.",
  nom_client: "Le nom ou la raison sociale du client est absent.",
  adresse_client: "L'adresse postale du client est absente des coordonnées copiées dans le brouillon. Complétez la fiche client puis choisissez à nouveau le client dans le brouillon.",
  objet: "L'objet du document est absent.",
  lignes: "Le document ne contient aucune ligne.",
};
const MSG_ACOMPTE = "L'acompte de ce devis est encore en brouillon. Finalisez d'abord l'acompte : sa déduction pourra ensuite être appliquée à cette facture.";
const frDateHeure = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

const fr = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

/** Détail d'un brouillon de devis créé avec le formulaire. */
export function DevisDetail({ doc, onNavigate }: { doc: DocumentAvecDevis; onNavigate?: () => void }) {
  const d = doc.devis!;
  const recap = recapituler(d.lignes);
  const finalise = doc.statut === "Finalisé";
  const estAcompte = doc.type === "acompte";
  const estFacture = doc.type === "facture" || estAcompte;
  const navigate = useNavigate();
  const etatDocs = useEtatDocuments();
  const factureLiee = finalise && !estFacture ? factureDuDevis(etatDocs.brouillons, doc.id) : undefined;
  const acompteLie = finalise && !estFacture ? acompteDuDevis(etatDocs.brouillons, doc.id) : undefined;
  const acompteBloquant = doc.type === "facture" && doc.deduction?.statut === "brouillon" ? doc.deduction : undefined;
  const [dlgAcompte, setDlgAcompte] = useState(false);
  const [confFacture, setConfFacture] = useState(false);
  const [prepEnCours, setPrepEnCours] = useState(false);
  const [prepEchec, setPrepEchec] = useState<string | null>(null);

  async function preparer() {
    if (prepEnCours) return;
    setPrepEnCours(true);
    setPrepEchec(null);
    try {
      const f = await preparerFacture(doc.id);
      setConfFacture(false);
      onNavigate?.();
      navigate({ to: "/factures/$id", params: { id: f.id } });
    } catch {
      setPrepEchec("La facture brouillon n'a pas pu être préparée. Le devis est inchangé ; vous pouvez réessayer sans risque de doublon.");
    } finally {
      setPrepEnCours(false);
    }
  }
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<null | { type: "manques"; liste: string[] } | { type: "conflit" | "incertain" | "refus" | "acompte" } | { type: "texte"; texte: string }>(null);

  async function finaliser() {
    if (enCours || doc.version === undefined) return;
    setEnCours(true);
    setEchec(null);
    try {
      const f = estFacture ? await finaliserFacture(doc.id, doc.version) : await finaliserDevis(doc.id, doc.version);
      setConfirmer(false);
      toast.success(`${estAcompte ? "Acompte finalisé" : estFacture ? "Facture finalisée" : "Devis finalisé"} : ${f.numero}`);
    } catch (e) {
      setConfirmer(false);
      if (e instanceof DevisIncomplet) setEchec({ type: "manques", liste: e.manques });
      else if (e instanceof ConflitDevis) setEchec({ type: "conflit" });
      else if (e instanceof DeductionAcompteRequise) setEchec({ type: "acompte" });
      else if (e instanceof EtatIncertain) setEchec({ type: "incertain" });
      else if (e instanceof FinalisationRefusee && e.explication) setEchec({ type: "texte", texte: e.explication });
      else setEchec({ type: "refus" });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatutBadge statut={finalise ? "Finalisé" : "Brouillon"} libelle={estFacture && finalise ? "Finalisée" : undefined} />
        {estAcompte && finalise ? (
          <span className="text-muted-foreground">Facture d'acompte · Finalisée · référence {doc.numero} · {String(doc.pourcentage ?? "").replace(".", ",")} % · finalisée le {doc.finaliseLe ? frDateHeure(doc.finaliseLe) : "—"} · issue du devis {doc.devisSource?.reference}</span>
          ) : estAcompte ? (
          <span className="text-muted-foreground">Facture d'acompte de {String(doc.pourcentage ?? "").replace(".", ",")} % · référence provisoire {doc.numero} — non émise · issue du devis {doc.devisSource?.reference}</span>
        ) : estFacture && finalise ? (
          <span className="text-muted-foreground">Facture · Finalisée · référence {doc.numero} · finalisée le {doc.finaliseLe ? frDateHeure(doc.finaliseLe) : "—"} · issue du devis {doc.devisSource?.reference}</span>
        ) : estFacture ? (
          <span className="text-muted-foreground">Facture · référence provisoire {doc.numero} — non émise · issue du devis {doc.devisSource?.reference}</span>
        ) : finalise ? (
          <span className="text-muted-foreground">Référence {doc.numero} · finalisé le {doc.finaliseLe ? frDateHeure(doc.finaliseLe) : "—"} · réf. provisoire {doc.referenceProvisoire}</span>
        ) : (
          <span className="text-muted-foreground">Référence provisoire {doc.numero} — brouillon non émis</span>
        )}
      </div>
      {finalise && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 p-3 font-medium">
          <Lock className="size-4" /> Document finalisé — contenu verrouillé
        </p>
      )}
      {echec && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-3">
          {echec.type === "manques" ? (
            <>
              <p className="font-medium">Finalisation refusée : des informations requises par cette version de l'application manquent.</p>
              <ul className="mt-1 list-disc pl-5">{echec.liste.map((m) => <li key={m}>{MANQUES[m] ?? m}</li>)}</ul>
              <p className="mt-1 text-xs text-muted-foreground">Ces contrôles ne constituent pas une vérification juridique complète.</p>
            </>
          ) : echec.type === "conflit" ? (
            <>
              <p>Ce brouillon a été modifié depuis son ouverture. Rechargez la dernière version avant de finaliser.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void chargerDocuments()}>Recharger la dernière version</Button>
            </>
          ) : echec.type === "texte" ? (
            <p>{echec.texte}</p>
          ) : echec.type === "acompte" ? (
            <p>{MSG_ACOMPTE}</p>
          ) : echec.type === "incertain" ? (
            <>
              <p>Impossible de vérifier pour l'instant si la finalisation a abouti. Aucun nouveau numéro ne sera attribué en vérifiant à nouveau.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={async () => {
                try { const r = estFacture ? await relireFacture(doc.id) : await relireDevis(doc.id); setEchec(r?.statut === "Finalisé" ? null : { type: "refus" }); } catch { /* toujours incertain */ }
              }}>Vérifier à nouveau</Button>
            </>
          ) : (
            <p>La finalisation n'a pas été effectuée. Le brouillon est inchangé ; vous pouvez réessayer.</p>
          )}
        </div>
      )}
      {prepEchec && <p role="alert" className="rounded-xl border border-destructive/40 bg-card p-3">{prepEchec}</p>}
      {estFacture ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!finalise && (
        <Button asChild variant="action">
          <Link to="/factures/$id/modifier" params={{ id: doc.id }} onClick={onNavigate}>{estAcompte ? "Modifier l'acompte brouillon" : "Modifier la facture brouillon"}</Link>
        </Button>
        )}
        {!finalise && estAcompte && (
          <Button variant="outline" onClick={() => setConfirmer(true)}>Finaliser l'acompte</Button>
        )}
        {!finalise && !estAcompte && !acompteBloquant && (
          <Button variant="outline" onClick={() => setConfirmer(true)}>Finaliser la facture</Button>
        )}
        {!finalise && !estAcompte && acompteBloquant && (
          <p className="text-sm text-muted-foreground sm:basis-full">{MSG_ACOMPTE}</p>
        )}
        <Button asChild variant="outline">
          <Link to="/factures/$id/apercu" params={{ id: doc.id }} onClick={onNavigate}>{estAcompte ? "Aperçu de l'acompte" : "Aperçu de la facture"}</Link>
        </Button>
        <FacturePdfBouton doc={doc} />
        {doc.devisSource && (
          <Button asChild variant="ghost">
            <Link to="/devis/$id" params={{ id: doc.devisSource.id }} onClick={onNavigate}>Voir le devis {doc.devisSource.reference}</Link>
          </Button>
        )}
      </div>
      ) : (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {finalise && (factureLiee ? (
          <Button asChild variant="action">
            <Link to="/factures/$id" params={{ id: factureLiee.id }} onClick={onNavigate}>{factureLiee.statut === "Finalisé" ? "Ouvrir la facture" : "Ouvrir la facture brouillon"}</Link>
          </Button>
        ) : (
          <Button variant="action" onClick={() => setConfFacture(true)}>Préparer une facture</Button>
        ))}
        {finalise && (acompteLie ? (
          <Button asChild variant="outline">
            <Link to="/factures/$id" params={{ id: acompteLie.id }} onClick={onNavigate}>Ouvrir l'acompte</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setDlgAcompte(true)}>Préparer un acompte</Button>
        ))}
        {!finalise && (
        <Button asChild variant="action">
          <Link to="/devis/$id/modifier" params={{ id: doc.id }} onClick={onNavigate}>
            Modifier le brouillon
          </Link>
        </Button>
        )}
        {!finalise && (
          <Button variant="outline" onClick={() => setConfirmer(true)}>Finaliser le devis</Button>
        )}
        <Button asChild variant="outline">
          <Link to="/devis/$id/apercu" params={{ id: doc.id }} onClick={onNavigate}>
            Aperçu du devis
          </Link>
        </Button>
      </div>
      )}

      {dlgAcompte && (
        <AcompteDialogue devisId={doc.id} devisRef={doc.numero}
          onFermer={() => setDlgAcompte(false)}
          onCree={(id) => { setDlgAcompte(false); onNavigate?.(); navigate({ to: "/factures/$id", params: { id } }); }} />
      )}
      {confFacture && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Préparer une facture</AlertDialogTitle>
              <AlertDialogDescription>
                Préparer une facture brouillon à partir de ce devis ? Aucun document ne sera émis ni envoyé.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={prepEnCours} onClick={() => setConfFacture(false)}>Annuler</AlertDialogCancel>
              <Button variant="action" disabled={prepEnCours} aria-busy={prepEnCours} onClick={() => void preparer()}>
                {prepEnCours && <Loader2 className="animate-spin" />}{prepEnCours ? "Préparation…" : "Préparer la facture brouillon"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {confirmer && (
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{estAcompte ? "Finaliser l'acompte ?" : estFacture ? "Finaliser la facture ?" : "Finaliser le devis ?"}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="flex flex-col gap-2 text-sm">
                  <p><span className="text-muted-foreground">Client :</span> {d.client.nom}</p>
                  <p><span className="text-muted-foreground">Objet :</span> {d.objet}</p>                  {estFacture && <p><span className="text-muted-foreground">Devis source :</span> {doc.devisSource?.reference}</p>}
                  <p><span className="text-muted-foreground">{doc.deduction ? "Total des prestations TTC :" : "Total TTC :"}</span> {formaterCentimes(recap.ttc)}</p>
                  {doc.deduction && <p><span className="text-muted-foreground">Acompte déjà facturé ({doc.deduction.reference}) :</span> -{formaterCentimes(doc.deduction.ttc)}</p>}
                  {doc.deduction && <p className="font-medium text-foreground">Solde TTC de cette facture : {formaterCentimes(solde(recap, doc.deduction).ttc)}</p>}
                  {doc.deduction && <p className="text-xs">{MSG_REGLEMENT}</p>}
                  <p className="mt-2 text-foreground">{estFacture
                    ? estAcompte ? "Un numéro définitif sera attribué (série commune aux factures). Le contenu de cet acompte ne pourra plus être modifié. Aucun paiement n'est enregistré et aucun email ne sera envoyé." : "Un numéro définitif sera attribué. Le contenu de cette facture ne pourra plus être modifié. Aucun email ne sera envoyé."
                    : "La finalisation attribue un numéro définitif et fige le contenu du devis. Aucun message ne sera envoyé au client."}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enCours} onClick={() => setConfirmer(false)}>Revenir au brouillon</AlertDialogCancel>
              <Button variant="action" disabled={enCours} aria-busy={enCours} onClick={() => void finaliser()}>
                {enCours && <Loader2 className="animate-spin" />}{enCours ? "Finalisation…" : "Confirmer la finalisation"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <section>
        <h3 className="font-semibold">{estAcompte ? "Informations de l'acompte" : estFacture ? "Informations de la facture" : "Informations du devis"}</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3"><dt className="text-muted-foreground">Objet</dt><dd className="font-medium break-words">{d.objet}</dd></div>
          <div><dt className="text-muted-foreground">Date</dt><dd className="font-medium">{fr(d.date)}</dd></div>
          {estAcompte && <div><dt className="text-muted-foreground">Pourcentage</dt><dd className="font-medium">{String(doc.pourcentage ?? "").replace(".", ",")} %</dd></div>}
          <div><dt className="text-muted-foreground">{estFacture ? "Échéance" : "Validité"}</dt><dd className="font-medium">{fr(d.validite)}</dd></div>
        </dl>
      </section>

      <section>
        <h3 className="font-semibold">{estFacture ? "Client (coordonnées reprises du devis)" : finalise ? "Client (coordonnées figées à la finalisation)" : "Client (coordonnées enregistrées avec le brouillon)"}</h3>
        <div className="mt-2">
          <p className="font-medium">{d.client.nom}</p>
          {d.client.contact && <p>Contact : {d.client.contact}</p>}
          {d.client.telephone && <p>{d.client.telephone}</p>}
          {d.client.email && <p className="break-all">{d.client.email}</p>}
          {d.client.adresse.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </section>

      <section>
        <h3 className="font-semibold">Lignes</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {d.lignes.map((l, i) => {
            const c = validerLigne(l).calcul;
            return (
              <li key={l.cle} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium break-words">{i + 1}. {l.designation}</p>
                  <p className="font-semibold">{c ? formaterCentimes(c.ht) : "—"} HT</p>
                </div>
                {l.description && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{l.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {TYPE_ARTICLE_LABELS[l.type]} · {l.quantite} {l.unite ? UNITE_LABELS[l.unite] : ""} × {l.prix} € HT · TVA {l.taux !== null ? labelTaux(l.taux) : "—"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-border p-3">
        <h3 className="font-semibold">{doc.deduction ? "Total des prestations" : "Totaux"}</h3>
        <Recap recap={recap} vide={d.lignes.length === 0} />
        {doc.type === "facture" && doc.deduction && <DeductionBloc recap={recap} deduction={doc.deduction} />}
      </section>

      <section>
        <h3 className="font-semibold">Remarques destinées au client</h3>
        <p className="mt-1 whitespace-pre-wrap">{d.remarques.trim() || "—"}</p>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted p-3">
        <h3 className="font-semibold">Notes internes</h3>
        <p className="text-xs text-muted-foreground">Ces notes ne sont pas destinées aux documents clients.</p>
        <p className="mt-1 whitespace-pre-wrap">{d.notes.trim() || "—"}</p>
      </section>
    </div>
  );
}
