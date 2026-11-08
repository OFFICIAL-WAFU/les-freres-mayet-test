import { deductionExcessive, MSG_DEDUCTION_EXCESSIVE, solde, type Deduction } from "@/data/deduction";
import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
import { Fragment } from 'react';
import { presentationLigne, debutLot } from '@/lib/lots';
import {
  formaterCentimes,
  formaterPrixSaisi,
  formaterQuantite,
  labelTaux,
  recapituler,
  validerLigne,
  type DevisBrouillon,
} from "@/data/devis";
import { formaterCapital, formaterIban, type Entreprise } from "@/data/entreprise";
import { mentionRetard } from "@/lib/mentions-obligatoires";

const fr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Document destiné au client. Ne reçoit volontairement AUCUNE note interne :
 * seules les données visibles par le client sont transmises.
 */
export type DevisPublic = Omit<DevisBrouillon, "notes">;

export function versPublic(d: DevisBrouillon): DevisPublic {
  const { notes: _notes, ...reste } = d;
  return reste;
}

export function DevisApercu({ devis: d, numero, entreprise: ent, finalise = false, facture, avoir }: { devis: DevisPublic; numero: string; entreprise: Entreprise; finalise?: boolean; facture?: { sourceRef: string; finalisee?: boolean; acompte?: number; deduction?: Deduction }; avoir?: { sourceRef: string; motif: string } }) {
  if (facture) finalise = !!facture.finalisee;
  const factB = !!facture && !finalise;
  const acp = facture?.acompte !== undefined;
  const nomDoc = avoir ? "Avoir" : facture ? (facture.acompte !== undefined ? "Facture d'acompte" : "Facture") : "Devis";
  const villeLigne = [ent.codePostal, ent.ville].filter(Boolean).join(" ");
  const coordonnees = [ent.adresse, ent.complement, villeLigne, ent.pays].filter(Boolean);
  const contacts = [ent.telephone && `Tél. ${ent.telephone}`, ent.email, ent.site.replace(/^https?:\/\//, "").replace(/\/$/, "")].filter(Boolean) as string[];
  const legal = [
    [ent.raisonSociale, ent.formeJuridique].filter(Boolean).join(" — "),
    ent.capital && `Capital social : ${formaterCapital(ent.capital)}`,
    ent.siret && `SIRET : ${ent.siret}`,
    ent.tva && `TVA intracommunautaire : ${ent.tva}`,
    ent.immatriculation,
  ].filter(Boolean) as string[];
  const retard = mentionRetard({ facture: !!facture, avoir: !!avoir, finalise, date: d.date, remarques: d.remarques });
  const recap = recapituler(d.lignes);
  const c = d.client;
  return (
    <article className="devis-doc mx-auto w-full max-w-[794px] bg-doc-paper px-5 py-6 text-[15px] leading-relaxed text-doc-ink shadow-sm sm:px-12 sm:py-12">
      {ent.bandeau.trim() && <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-doc-gold-ink">{ent.bandeau.trim()}</p>}
      {/* En-tête entreprise */}
      <header className="flex flex-col gap-4 border-b border-doc-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {ent.logo
            ? <img src={ent.logo} alt="Logo" className="max-h-14 w-auto max-w-[140px] shrink-0 object-contain" />
            : <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-doc-gold text-base font-semibold tracking-wide text-doc-gold">
            FM
          </span>}
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold" data-testid="apercu-nom">{ent.nomCommercial || ent.raisonSociale}</p>
            {ent.activite && <p className="text-sm text-doc-muted">{ent.activite}</p>}
            {coordonnees.map((l, i) => <p key={i} className="break-words text-xs text-doc-muted">{l}</p>)}
            {contacts.map((l, i) => <p key={i} className="break-all text-xs text-doc-muted">{l}</p>)}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-semibold tracking-wide">{avoir ? "AVOIR — BROUILLON — NON ÉMIS" : factB ? (acp ? "FACTURE D'ACOMPTE — BROUILLON — NON ÉMISE" : "FACTURE — BROUILLON — NON ÉMISE") : facture ? "FACTURE" : finalise ? "DEVIS" : "DEVIS — BROUILLON"}</p>
          <p className="text-sm text-doc-muted">{finalise ? `Réf. ${numero}` : `Réf. provisoire ${numero}`}</p>
          {!finalise && !facture && !avoir && (
          <p className="mt-1 inline-block rounded border border-doc-gold px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-doc-gold-ink">
            Brouillon — non émis
          </p>
          )}
        </div>
      </header>

      {/* Infos + destinataire */}
      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">{nomDoc}</h2>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex gap-2"><dt className="text-doc-muted">Objet :</dt><dd className="min-w-0 break-words font-medium">{d.objet}</dd></div>
            <div className="flex gap-2"><dt className="text-doc-muted">Date :</dt><dd>{fr(d.date)}</dd></div>
            {d.validite && <div className="flex gap-2"><dt className="text-doc-muted">{facture ? "Échéance :" : "Valable jusqu'au :"}</dt><dd>{fr(d.validite)}</dd></div>}
            {facture && !acp && d.prestationDebut && <div className="flex gap-2"><dt className="text-doc-muted">{d.prestationFin ? "Période de réalisation :" : "Date de réalisation :"}</dt><dd>{d.prestationFin ? `du ${fr(d.prestationDebut)} au ${fr(d.prestationFin)}` : fr(d.prestationDebut)}</dd></div>}
            {facture?.sourceRef && <div className="flex gap-2"><dt className="text-doc-muted">Devis d'origine :</dt><dd>{facture.sourceRef}</dd></div>}
            {avoir && <div className="flex gap-2"><dt className="text-doc-muted">Facture d'origine :</dt><dd>{avoir.sourceRef}</dd></div>}
            {avoir && <div className="flex gap-2"><dt className="text-doc-muted">Motif :</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{avoir.motif}</dd></div>}
            {acp && <div className="flex gap-2"><dt className="text-doc-muted">Acompte :</dt><dd>{String(facture!.acompte).replace(".", ",")} % du devis</dd></div>}
          </dl>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Destinataire</h2>
          <div className="mt-2 text-sm">
            <p className="break-words font-medium">{c.nom}</p>
            {c.contact && <p>À l'attention de {c.contact}</p>}
            {c.adresse.filter(Boolean).map((l, i) => <p key={i} className="break-words">{l}</p>)}
            {c.telephone && <p>Tél. {c.telephone}</p>}
            {c.email && <p className="break-all">{c.email}</p>}
          </div>
        </div>
      </section>

      {/* Lignes : tableau (ordinateur) */}
      <table className="mt-8 hidden w-full table-fixed border-collapse text-sm sm:table">
        <colgroup>
          <col /><col className="w-[64px]" /><col className="w-[72px]" /><col className="w-[100px]" /><col className="w-[56px]" /><col className="w-[104px]" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-doc-gold text-left text-xs uppercase tracking-wider text-doc-gold-ink">
            <th className="py-2 pr-2 font-semibold">Désignation</th>
            <th className="py-2 pr-2 text-right font-semibold">Qté</th>
            <th className="py-2 pr-2 font-semibold">Unité</th>
            <th className="py-2 pr-2 text-right font-semibold">P.U. HT</th>
            <th className="py-2 pr-2 text-right font-semibold">TVA</th>
            <th className="py-2 text-right font-semibold">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {d.lignes.map((l,i) => {
            const calc = validerLigne(l).calcul;
            const p=presentationLigne(l),titre=debutLot(d.lignes,i);
            return (
              <Fragment key={l.cle}>{titre&&<tr><th colSpan={6} className="bg-secondary px-2 py-2 text-left font-semibold uppercase">{titre}</th></tr>}<tr className="border-b border-doc-line align-top">
                <td className="py-3 pr-2">
                  <p className="break-words font-medium">{l.designation}</p>
                  {p.description.trim() && <p className="mt-0.5 whitespace-pre-wrap break-words text-doc-muted">{p.description}</p>}
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-doc-faint">{TYPE_ARTICLE_LABELS[l.type]}</p>
                </td>
                <td className="py-3 pr-2 text-right">{formaterQuantite(l.quantite)}</td>
                <td className="py-3 pr-2">{p.uniteSource ?? (l.unite ? UNITE_LABELS[l.unite] : "")}</td>
                <td className="py-3 pr-2 text-right whitespace-nowrap">{formaterPrixSaisi(l.prix)}</td>
                <td className="py-3 pr-2 text-right whitespace-nowrap">{l.taux !== null ? labelTaux(l.taux) : ""}</td>
                <td className="py-3 text-right whitespace-nowrap font-medium">{calc ? formaterCentimes(calc.ht) : ""}</td>
              </tr></Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Lignes : blocs (téléphone) */}
      <div className="mt-6 flex flex-col sm:hidden">
        <h2 className="border-b-2 border-doc-gold pb-1 text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Détail</h2>
        {d.lignes.map((l,i) => {
          const calc = validerLigne(l).calcul;
          const p=presentationLigne(l),titre=debutLot(d.lignes,i);
          return (
            <Fragment key={l.cle}>{titre&&<h3 className="mt-3 bg-secondary p-2 font-semibold uppercase">{titre}</h3>}<div className="border-b border-doc-line py-3 text-sm">
              <p className="break-words font-medium">{l.designation}</p>
              {p.description.trim() && <p className="mt-0.5 whitespace-pre-wrap break-words text-doc-muted">{p.description}</p>}
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-doc-faint">{TYPE_ARTICLE_LABELS[l.type]}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-doc-muted">Quantité</dt><dd className="text-right">{formaterQuantite(l.quantite)} {p.uniteSource ?? (l.unite ? UNITE_LABELS[l.unite] : "")}</dd>
                <dt className="text-doc-muted">Prix unitaire HT</dt><dd className="text-right">{formaterPrixSaisi(l.prix)}</dd>
                <dt className="text-doc-muted">TVA</dt><dd className="text-right">{l.taux !== null ? labelTaux(l.taux) : ""}</dd>
                <dt className="font-medium">Total HT</dt><dd className="text-right font-medium">{calc ? formaterCentimes(calc.ht) : ""}</dd>
              </dl>
            </div></Fragment>
          );
        })}
      </div>

      {/* Totaux (moteur de calcul partagé) */}
      <section className="mt-6 flex sm:justify-end">
        <dl className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 [&_dd]:pl-4 text-sm sm:w-80">
          <dt>Total HT</dt><dd className="text-right font-medium">{formaterCentimes(recap.ht)}</dd>
          {recap.parTaux.map((t) => (
            <div key={t.taux} className="contents text-doc-muted">
              <dt>TVA {labelTaux(t.taux)} (base {formaterCentimes(t.base)})</dt>
              <dd className="text-right">{formaterCentimes(t.tva)}</dd>
            </div>
          ))}
          <dt>Total TVA</dt><dd className="text-right font-medium">{formaterCentimes(recap.tva)}</dd>
          <dt className="mt-2 border-t-2 border-doc-gold pt-2 text-base font-semibold">{avoir ? "Total de l'avoir TTC" : facture?.deduction ? "Total des prestations TTC" : "Total TTC"}</dt>
          <dd className="mt-2 border-t-2 border-doc-gold pt-2 text-right text-base font-semibold" data-testid="apercu-ttc">
            {recap.complet ? formaterCentimes(recap.ttc) : "Calcul incomplet"}
          </dd>
        </dl>
      </section>
      {facture?.deduction && <ApercuDeduction recap={recap} d={facture.deduction} />}

      {!avoir && d.conditions?.trim() && (
        <section className="mt-8" data-testid="apercu-conditions">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Conditions de paiement</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{d.conditions}</p>
        </section>
      )}

      {!avoir && (ent.iban || ent.bic) && (
        <section className="mt-8" data-testid="apercu-virement">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Paiement par virement</h2>
          <p className="mt-2 break-words text-sm">{[ent.iban && `IBAN : ${formaterIban(ent.iban)}`, ent.bic && `BIC : ${ent.bic}`].filter(Boolean).join("   ·   ")}</p>
        </section>
      )}

      {d.remarques.trim() && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Remarques</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{d.remarques}</p>
        </section>
      )}

      {retard && (
        <section className="mt-8" data-testid="apercu-retard">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Retard de paiement</h2>
          <p className="mt-2 break-words text-xs">{retard}</p>
        </section>
      )}

      {retard && (
        <section className="mt-8" data-testid="apercu-retard">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Retard de paiement</h2>
          <p className="mt-2 break-words text-xs">{retard}</p>
        </section>
      )}

      <p className="mt-10 border-t border-doc-line pt-3 text-center text-xs text-doc-faint">
        {avoir ? "Avoir brouillon — non émis · montants à créditer" : factB ? (acp ? "Facture d'acompte brouillon — non émise" : "Facture brouillon — non émise") : finalise ? `${nomDoc} ${numero}` : "Brouillon — non émis"}
      </p>
      {(ent.assureur || ent.contratAssurance) && <p className="mt-3 text-center text-[11px] text-doc-faint">Assurance décennale / RC Pro : {[ent.assureur, ent.contratAssurance && `contrat n° ${ent.contratAssurance}`].filter(Boolean).join(" — ")}</p>}
      {ent.cgv.trim() && <p className="mt-2 text-center text-[11px] text-doc-faint">Les conditions générales de vente figurent en pages jointes du PDF.</p>}
      {legal.length > 0 && (
        <footer className="mt-2 text-center text-[11px] leading-snug text-doc-faint" data-testid="apercu-pied">
          {legal.map((l, i) => <p key={i} className="whitespace-pre-wrap break-words">{l}</p>)}
        </footer>
      )}
    </article>
  );
}

function ApercuDeduction({ recap, d }: { recap: ReturnType<typeof recapituler>; d: Deduction }) {
  if (d.statut !== "finalise") return <p className="mt-3 text-right text-sm text-doc-muted">Acompte {d.reference} encore en brouillon — non déduit.</p>;
  const s = solde(recap, d);
  return (
    <section className="mt-4 flex flex-col gap-2 sm:items-end" data-testid="apercu-deduction">
      {deductionExcessive(recap, d) && <p role="alert" className="w-full rounded-lg border border-destructive/50 p-2 text-sm font-semibold text-destructive sm:w-80">{MSG_DEDUCTION_EXCESSIVE}</p>}
      <dl className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-y-1.5 [&_dd]:pl-4 text-sm sm:w-80">
        <dt className="col-span-2 font-semibold">Acompte déjà facturé à déduire — {d.reference}</dt>
        {d.parTaux.map((p) => (
          <div key={p.taux} className="contents text-doc-muted">
            <dt>Part à TVA {labelTaux(p.taux)} : HT -{formaterCentimes(p.ht)} / TVA</dt><dd className="text-right">-{formaterCentimes(p.tva)}</dd>
          </div>
        ))}
        <dt>Acompte déjà facturé TTC</dt><dd className="text-right font-medium">-{formaterCentimes(d.ttc)}</dd>
        <dt className="col-span-2 mt-3 font-semibold">Solde de cette facture</dt>
        <dt>Solde HT</dt><dd className="text-right font-medium">{formaterCentimes(s.ht)}</dd>
        {s.parTaux.map((p) => (
          <div key={p.taux} className="contents text-doc-muted">
            <dt>TVA {labelTaux(p.taux)} (base {formaterCentimes(p.ht)})</dt><dd className="text-right">{formaterCentimes(p.tva)}</dd>
          </div>
        ))}
        <dt>Solde TVA</dt><dd className="text-right font-medium">{formaterCentimes(s.tva)}</dd>
        <dt className="mt-2 border-t-2 border-doc-gold pt-2 text-base font-semibold">Solde TTC de cette facture</dt>
        <dd className="mt-2 border-t-2 border-doc-gold pt-2 text-right text-base font-semibold" data-testid="apercu-solde">{formaterCentimes(s.ttc)}</dd>
      </dl>
    </section>
  );
}
