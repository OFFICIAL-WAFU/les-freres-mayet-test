// Chiffrage interne des lignes de devis : coût, temps de pose, marge. Rien ici n'apparaît sur l'aperçu, le PDF ou la signature.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formaterCentimes, type LigneSaisie } from "@/data/devis";
import {
  analyserCout, analyserLigne, coutVide, modifierCout, pourcentage, prixCalcule, rentabilite,
  type ChampCout, type CoutSaisie, type ReglagesChiffrage,
} from "@/lib/rentabilite";

const heures = (minutes: bigint) => {
  const m = Number(minutes);
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
};

export function PastilleMarge({ ligne, reglages }: { ligne: LigneSaisie; reglages: ReglagesChiffrage }) {
  const a = analyserLigne(ligne, reglages);
  if (!a) return <span className="text-xs text-muted-foreground">—</span>;
  if (!a.connu) return <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-foreground">Coût à renseigner</span>;
  const negatif = a.marge < 0n;
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${negatif ? "bg-destructive/15 text-destructive" : "bg-success-soft text-[oklch(0.42_0.12_150)]"}`}>
      {formaterCentimes(a.marge)} · {pourcentage(a.marge, a.ht)}
    </span>
  );
}

/** Encadré « Coût et temps de pose » d'une ligne dépliée. */
export function CoutBloc({ ligne: l, reglages, err, onChange }: {
  ligne: LigneSaisie; reglages: ReglagesChiffrage; err: (k: string) => string | undefined; onChange: (l: LigneSaisie) => void;
}) {
  const id = (k: string) => `l-${l.cle}-${k}`;
  if (!l.cout) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-3">
        <p className="text-sm text-muted-foreground">Coût et temps de pose non renseignés : cette ligne n’est pas comptée dans la marge.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...l, cout: { ...coutVide(reglages), auto: false } })}>Renseigner le coût</Button>
      </div>
    );
  }
  const c = l.cout;
  const maj = (p: Partial<CoutSaisie>) => onChange(modifierCout(l, p, reglages));
  const { valeur: v } = analyserCout(c);
  const calc = prixCalcule(c);
  const champ = (k: ChampCout, label: string, aide?: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id(k)}>{label}</Label>
      <Input id={id(k)} inputMode="decimal" className="bg-card" value={c[k]} placeholder={aide} aria-invalid={!!err(k)} onChange={(e) => maj({ [k]: e.target.value })} />
      {err(k) && <p className="text-sm font-medium text-destructive">{err(k)}</p>}
    </div>
  );
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">Coût et temps de pose — jamais visibles par le client</p>
        <p className="text-xs text-muted-foreground">{c.auto ? "Prix de vente calculé automatiquement" : "Prix de vente saisi à la main"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {champ("achat", "Prix d’achat unitaire HT (€)", "Inconnu")}
        {champ("coef", "Coefficient matériel")}
        {champ("temps", "Temps de pose par unité (h)", "0")}
        {champ("taux", "Taux horaire vendu (€)")}
      </div>
      {v && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg border border-border bg-card px-3 py-1.5">Matériel {v.achat === null ? "—" : `${formaterCentimes(v.achat)} × ${c.coef}`}</span>
          <span className="text-muted-foreground">+</span>
          <span className="rounded-lg border border-border bg-card px-3 py-1.5">Pose {heures(v.minutes)} × {formaterCentimes(v.tauxCentimes)}</span>
          <span className="text-muted-foreground">=</span>
          <span className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">{calc === null ? "Indiquez un prix d’achat ou un temps" : `${formaterCentimes(calc)} HT`}</span>
          <div className="ml-auto flex gap-2">
            {c.auto
              ? <Button type="button" size="sm" variant="outline" onClick={() => maj({ auto: false })}>Saisir le prix à la main</Button>
              : <Button type="button" size="sm" variant="outline" disabled={calc === null} onClick={() => maj({ auto: true })}>Appliquer le prix calculé</Button>}
            <Button type="button" size="sm" variant="ghost" onClick={() => { const { cout: _retire, ...reste } = l; void _retire; onChange(reste); }}>Retirer le coût</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cadre « Rentabilité » du récapitulatif. */
export function RentabiliteBloc({ lignes, reglages }: { lignes: LigneSaisie[]; reglages: ReglagesChiffrage }) {
  const r = rentabilite(lignes, reglages);
  if (r.lignesConnues === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Rentabilité</h2><span className="text-xs text-muted-foreground">Visible par vous seul</span></div>
        <p className="mt-2 text-sm text-muted-foreground">Renseignez le prix d’achat ou le temps de pose d’une ligne pour voir la marge du devis.</p>
      </div>
    );
  }
  const negatif = r.marge < 0n;
  const part = (x: bigint) => (r.vente > 0n ? Math.max(0, Number((x * 1000n) / r.vente) / 10) : 0);
  const parHeure = r.minutes > 0n ? formaterCentimes((r.marge * 60n * 2n + r.minutes) / (2n * r.minutes)) : "—";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">Rentabilité</h2><span className="text-xs text-muted-foreground">Visible par vous seul</span></div>
      <p className={`flex flex-wrap items-baseline gap-x-3 ${negatif ? "text-destructive" : "text-[oklch(0.42_0.12_150)]"}`}>
        <span className="text-3xl font-bold">{formaterCentimes(r.marge)}</span>
        <span className="font-semibold">{pourcentage(r.marge, r.vente)} de marge</span>
      </p>
      {!negatif && (
        <>
          <div role="img" aria-label={`Répartition : matériel ${formaterCentimes(r.coutMateriel)}, main-d’œuvre ${formaterCentimes(r.coutMainOeuvre)}, marge ${formaterCentimes(r.marge)}`} className="flex h-3 overflow-hidden rounded-full bg-secondary">
            <span style={{ width: `${part(r.coutMateriel)}%` }} className="bg-primary/60" />
            <span style={{ width: `${part(r.coutMainOeuvre)}%` }} className="bg-accent" />
            <span style={{ width: `${part(r.marge)}%` }} className="bg-success" />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/60" />Matériel</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent" />Main-d’œuvre</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" />Marge</span>
          </div>
        </>
      )}
      <table className="w-full text-sm">
        <thead><tr className="text-right text-muted-foreground"><th className="py-1 text-left font-medium"><span className="sr-only">Poste</span></th><th className="font-medium">Coût</th><th className="font-medium">Vente</th><th className="font-medium">Marge</th></tr></thead>
        <tbody>
          <tr className="border-t border-border text-right"><td className="py-1.5 text-left">Matériel</td><td>{formaterCentimes(r.coutMateriel)}</td><td>{formaterCentimes(r.venteMateriel)}</td><td className="font-semibold">{pourcentage(r.venteMateriel - r.coutMateriel, r.venteMateriel)}</td></tr>
          <tr className="border-t border-border text-right"><td className="py-1.5 text-left">Main-d’œuvre</td><td>{formaterCentimes(r.coutMainOeuvre)}</td><td>{formaterCentimes(r.venteMainOeuvre)}</td><td className="font-semibold">{pourcentage(r.venteMainOeuvre - r.coutMainOeuvre, r.venteMainOeuvre)}</td></tr>
          <tr className="border-t border-border text-right font-semibold"><td className="py-1.5 text-left">Total</td><td>{formaterCentimes(r.cout)}</td><td>{formaterCentimes(r.vente)}</td><td>{pourcentage(r.marge, r.vente)}</td></tr>
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/50 p-2.5"><p className="text-xs text-muted-foreground">Temps total</p><p className="text-lg font-semibold">{heures(r.minutes)}</p></div>
        <div className="rounded-xl bg-secondary/50 p-2.5"><p className="text-xs text-muted-foreground">Marge par heure</p><p className="text-lg font-semibold">{parHeure}</p></div>
      </div>
      {r.lignesSansCout > 0 && (
        <p className="rounded-lg bg-warning-soft p-2 text-xs">
          {r.lignesSansCout === 1 ? "1 ligne sans coût" : `${r.lignesSansCout} lignes sans coût`} ({formaterCentimes(r.htSansCout)}) {r.lignesSansCout === 1 ? "n’est pas comptée" : "ne sont pas comptées"} dans la marge.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Coût horaire réel : {formaterCentimes(BigInt(reglages.coutHoraireCentimes))} (Réglages › Chiffrage et marge).</p>
    </div>
  );
}

/** Mode détaillé : toutes les colonnes de chiffrage, modifiables directement, une ligne par ligne de devis. */
export function TableauDetaille({ lignes, reglages, err, onChange, onOuvrir }: {
  lignes: LigneSaisie[]; reglages: ReglagesChiffrage; err: (cle: string, k: string) => string | undefined;
  onChange: (l: LigneSaisie) => void; onOuvrir: (cle: string) => void;
}) {
  const cellule = "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-right text-sm";
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2 text-left font-semibold">Désignation</th>
            <th className="w-20 p-2 text-right font-semibold">Qté</th>
            <th className="w-24 p-2 text-right font-semibold">Achat HT</th>
            <th className="w-20 p-2 text-right font-semibold">Coef.</th>
            <th className="w-20 p-2 text-right font-semibold">Pose (h)</th>
            <th className="w-24 p-2 text-right font-semibold">Taux h.</th>
            <th className="w-28 p-2 text-right font-semibold">Prix unit. HT</th>
            <th className="w-28 p-2 text-right font-semibold">Total HT</th>
            <th className="w-40 p-2 text-right font-semibold">Marge</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const a = analyserLigne(l, reglages);
            const c = l.cout ?? { ...coutVide(reglages), auto: false };
            const majCout = (k: ChampCout, val: string) => onChange(modifierCout({ ...l, cout: c }, { [k]: val }, reglages));
            const champCout = (k: ChampCout, nom: string) => (
              <input aria-label={`${nom} — ${l.designation || "ligne"}`} inputMode="decimal" className={`${cellule} ${err(l.cle, k) ? "border-destructive" : ""}`} value={l.cout ? c[k] : ""}
                placeholder={l.cout ? "" : k === "coef" ? c.coef : k === "taux" ? c.taux : "—"} onChange={(e) => majCout(k, e.target.value)} />
            );
            return (
              <tr key={l.cle} className="border-t border-border align-middle">
                <td className="p-2">
                  <button type="button" className="text-left font-medium underline-offset-2 hover:underline" onClick={() => onOuvrir(l.cle)}>{l.designation || "Ligne sans désignation"}</button>
                </td>
                <td className="p-1.5"><input aria-label={`Quantité — ${l.designation || "ligne"}`} inputMode="decimal" className={`${cellule} ${err(l.cle, "quantite") ? "border-destructive" : ""}`} value={l.quantite} onChange={(e) => onChange({ ...l, quantite: e.target.value })} /></td>
                <td className="p-1.5">{champCout("achat", "Prix d’achat")}</td>
                <td className="p-1.5">{champCout("coef", "Coefficient")}</td>
                <td className="p-1.5">{champCout("temps", "Temps de pose")}</td>
                <td className="p-1.5">{champCout("taux", "Taux horaire")}</td>
                <td className="p-1.5"><input aria-label={`Prix unitaire HT — ${l.designation || "ligne"}`} inputMode="decimal" className={`${cellule} ${err(l.cle, "prix") ? "border-destructive" : ""} ${l.cout?.auto ? "bg-secondary/40" : ""}`} value={l.prix}
                  onChange={(e) => onChange({ ...l, prix: e.target.value, ...(l.cout?.auto ? { cout: { ...l.cout, auto: false } } : {}) })} /></td>
                <td className="p-2 text-right font-semibold">{a ? formaterCentimes(a.ht) : "—"}</td>
                <td className="p-2 text-right"><PastilleMarge ligne={l} reglages={reglages} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
