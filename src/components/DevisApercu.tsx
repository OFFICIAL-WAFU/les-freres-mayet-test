import { TYPE_ARTICLE_LABELS, UNITE_LABELS } from "@/data/catalogue";
import {
  formaterCentimes,
  formaterPrixSaisi,
  formaterQuantite,
  labelTaux,
  recapituler,
  validerLigne,
  type DevisBrouillon,
} from "@/data/devis";
import { formaterCapital, type Entreprise } from "@/data/entreprise";

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

export function DevisApercu({ devis: d, numero, entreprise: ent, finalise = false, facture }: { devis: DevisPublic; numero: string; entreprise: Entreprise; finalise?: boolean; facture?: { sourceRef: string } }) {
  const nomDoc = facture ? "Facture" : "Devis";
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
  const recap = recapituler(d.lignes);
  const c = d.client;
  return (
    <article className="devis-doc mx-auto w-full max-w-[794px] bg-doc-paper px-5 py-6 text-[15px] leading-relaxed text-doc-ink shadow-sm sm:px-12 sm:py-12">
      {/* En-tête entreprise */}
      <header className="flex flex-col gap-4 border-b border-doc-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-doc-gold text-base font-semibold tracking-wide text-doc-gold">
            FM
          </span>
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold" data-testid="apercu-nom">{ent.nomCommercial || ent.raisonSociale}</p>
            {ent.activite && <p className="text-sm text-doc-muted">{ent.activite}</p>}
            {coordonnees.map((l, i) => <p key={i} className="break-words text-xs text-doc-muted">{l}</p>)}
            {contacts.map((l, i) => <p key={i} className="break-all text-xs text-doc-muted">{l}</p>)}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xl font-semibold tracking-wide">{facture ? "FACTURE — BROUILLON — NON ÉMISE" : finalise ? "DEVIS" : "DEVIS — BROUILLON"}</p>
          <p className="text-sm text-doc-muted">{finalise ? `Réf. ${numero}` : `Réf. provisoire ${numero}`}</p>
          {!finalise && !facture && (
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
            {facture && <div className="flex gap-2"><dt className="text-doc-muted">Devis d'origine :</dt><dd>{facture.sourceRef}</dd></div>}
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
          {d.lignes.map((l) => {
            const calc = validerLigne(l).calcul;
            return (
              <tr key={l.cle} className="border-b border-doc-line align-top">
                <td className="py-3 pr-2">
                  <p className="break-words font-medium">{l.designation}</p>
                  {l.description.trim() && <p className="mt-0.5 whitespace-pre-wrap break-words text-doc-muted">{l.description}</p>}
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-doc-faint">{TYPE_ARTICLE_LABELS[l.type]}</p>
                </td>
                <td className="py-3 pr-2 text-right">{formaterQuantite(l.quantite)}</td>
                <td className="py-3 pr-2">{l.unite ? UNITE_LABELS[l.unite] : ""}</td>
                <td className="py-3 pr-2 text-right whitespace-nowrap">{formaterPrixSaisi(l.prix)}</td>
                <td className="py-3 pr-2 text-right whitespace-nowrap">{l.taux !== null ? labelTaux(l.taux) : ""}</td>
                <td className="py-3 text-right whitespace-nowrap font-medium">{calc ? formaterCentimes(calc.ht) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Lignes : blocs (téléphone) */}
      <div className="mt-6 flex flex-col sm:hidden">
        <h2 className="border-b-2 border-doc-gold pb-1 text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Détail</h2>
        {d.lignes.map((l) => {
          const calc = validerLigne(l).calcul;
          return (
            <div key={l.cle} className="border-b border-doc-line py-3 text-sm">
              <p className="break-words font-medium">{l.designation}</p>
              {l.description.trim() && <p className="mt-0.5 whitespace-pre-wrap break-words text-doc-muted">{l.description}</p>}
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-doc-faint">{TYPE_ARTICLE_LABELS[l.type]}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-doc-muted">Quantité</dt><dd className="text-right">{formaterQuantite(l.quantite)} {l.unite ? UNITE_LABELS[l.unite] : ""}</dd>
                <dt className="text-doc-muted">Prix unitaire HT</dt><dd className="text-right">{formaterPrixSaisi(l.prix)}</dd>
                <dt className="text-doc-muted">TVA</dt><dd className="text-right">{l.taux !== null ? labelTaux(l.taux) : ""}</dd>
                <dt className="font-medium">Total HT</dt><dd className="text-right font-medium">{calc ? formaterCentimes(calc.ht) : ""}</dd>
              </dl>
            </div>
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
          <dt className="mt-2 border-t-2 border-doc-gold pt-2 text-base font-semibold">Total TTC</dt>
          <dd className="mt-2 border-t-2 border-doc-gold pt-2 text-right text-base font-semibold" data-testid="apercu-ttc">
            {recap.complet ? formaterCentimes(recap.ttc) : "Calcul incomplet"}
          </dd>
        </dl>
      </section>

      {d.remarques.trim() && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-doc-gold-ink">Remarques</h2>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{d.remarques}</p>
        </section>
      )}

      <p className="mt-10 border-t border-doc-line pt-3 text-center text-xs text-doc-faint">
        {facture ? "Facture brouillon — non émise" : finalise ? `Devis ${numero}` : "Brouillon — non émis · Document de démonstration"}
      </p>
      {legal.length > 0 && (
        <footer className="mt-2 text-center text-[11px] leading-snug text-doc-faint" data-testid="apercu-pied">
          {legal.map((l, i) => <p key={i} className="whitespace-pre-wrap break-words">{l}</p>)}
        </footer>
      )}
    </article>
  );
}
