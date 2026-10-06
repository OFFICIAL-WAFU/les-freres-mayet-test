import { formaterCentimes, labelTaux, type Recapitulatif } from "@/data/devis";
import { MSG_REGLEMENT, solde, type Deduction } from "@/data/deduction";

/** Prestations, acompte déjà facturé à déduire, puis solde de cette facture. */
export function DeductionBloc({ recap, deduction: d }: { recap: Recapitulatif; deduction: Deduction }) {
  const s = solde(recap, d);
  const row = "flex justify-between gap-2";
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 text-sm" data-testid="deduction">
      <div>
        <p className="font-semibold">Acompte déjà facturé à déduire — {d.reference}{d.statut !== "finalise" && " (brouillon)"}</p>
        {d.statut !== "finalise" ? (
          <p className="mt-1 text-muted-foreground">L'acompte est encore en brouillon : il doit être finalisé avant de finaliser cette facture.</p>
        ) : (
          <dl className="mt-1 flex flex-col gap-1">
            {d.parTaux.map((p) => (
              <div key={p.taux} className={row}><dt className="text-muted-foreground">Part à TVA {labelTaux(p.taux)} : HT / TVA</dt><dd>-{formaterCentimes(p.ht)} / -{formaterCentimes(p.tva)}</dd></div>
            ))}
            <div className={row}><dt>Acompte déjà facturé TTC</dt><dd className="font-medium">-{formaterCentimes(d.ttc)}</dd></div>
          </dl>
        )}
      </div>
      {d.statut === "finalise" && (
        <div>
          <p className="font-semibold">Solde de cette facture</p>
          <dl className="mt-1 flex flex-col gap-1">
            <div className={row}><dt>Solde HT</dt><dd className="font-medium">{formaterCentimes(s.ht)}</dd></div>
            {s.parTaux.map((p) => (
              <div key={p.taux} className={row}><dt className="text-muted-foreground">TVA {labelTaux(p.taux)} (base {formaterCentimes(p.ht)})</dt><dd>{formaterCentimes(p.tva)}</dd></div>
            ))}
            <div className={row}><dt>Solde TVA</dt><dd className="font-medium">{formaterCentimes(s.tva)}</dd></div>
            <div className={`${row} border-t border-border pt-2 text-base`}><dt className="font-semibold">Solde TTC de cette facture</dt><dd className="font-semibold">{formaterCentimes(s.ttc)}</dd></div>
          </dl>
          {(d.depasse || s.parTaux.some((p) => p.ht < 0n || p.tva < 0n)) && <p role="alert" className="mt-2 text-destructive">La déduction dépasse les prestations pour au moins un taux. Corrigez les lignes : la finalisation sera refusée.</p>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{MSG_REGLEMENT}</p>
    </div>
  );
}
