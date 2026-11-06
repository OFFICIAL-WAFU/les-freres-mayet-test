import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";
import { margeQueryOptions } from "@/data/achats";
import { afficherTaux, dateParis, libelleMois, selectionMarge, totalMarge, type PeriodeMarge } from "@/lib/achats-marge";
import { formaterCentimes } from "@/data/devis";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PERIODES = { "depuis-avril": "Depuis le 1er avril 2026", annee: "Cette année", mois: "Ce mois-ci" } as const;

export function MargeAccueil({ ownerId, periode, onPeriode }: { ownerId: string; periode: PeriodeMarge; onPeriode: (p: PeriodeMarge) => void }) {
  const { data } = useSuspenseQuery(margeQueryOptions(ownerId));
  const lignes = selectionMarge(data, periode, dateParis());
  const total = totalMarge(lignes);
  const graphique = lignes.map(l => ({ mois: libelleMois(l.mois), ca: Number(l.ca) / 100, achats: Number(l.achats) / 100, marge: Number(l.marge) / 100 }));
  return <section aria-labelledby="titre-marge" className="marge-suivi mt-6 border-b border-border pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="titre-marge" className="text-xl font-semibold">Marge</h2>
      <Select value={periode} onValueChange={v => onPeriode(v as PeriodeMarge)}><SelectTrigger aria-label="Période de marge" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PERIODES).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["CA HT", formaterCentimes(total.ca)], ["Achats matériel HT", formaterCentimes(total.achats)], ["Marge HT", formaterCentimes(total.marge)], ["Taux de marge", afficherTaux(total.marge, total.ca)]].map(([titre,montant], i) => <div key={titre} className="min-w-0 rounded-lg border border-border bg-card p-4"><p className="text-sm text-muted-foreground">{titre}</p><p className={`mt-2 break-words text-xl font-semibold tabular-nums ${i >= 2 ? "text-margin" : "text-foreground"}`}>{montant}</p></div>)}
    </div>
    {lignes.length === 0 ? <p className="py-8 text-sm text-muted-foreground">Aucune vente finalisée ni aucun achat sur cette période.</p> : <div className="mt-5 h-72 w-full min-w-0" role="img" aria-label="CA et achats mensuels en barres, marge en courbe">
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={graphique} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="mois" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={v => String(v).replace(/ 20\d\d$/, "")} /><YAxis width={65} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={v => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(Number(v))} />
        <Tooltip formatter={v => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v))} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: 8 }} /><Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="ca" name="CA HT" fill="var(--purchase-sales)" maxBarSize={30} isAnimationActive={false} /><Bar dataKey="achats" name="Achats HT" fill="var(--purchase-cost)" maxBarSize={30} isAnimationActive={false} /><Line dataKey="marge" name="Marge HT" stroke="var(--margin)" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer>
    </div>}
    <details className="mt-3"><summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-medium"><ChevronDown className="size-4" />Tableau mensuel</summary><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-sm"><thead><tr className="border-b border-border text-left">{["Mois","CA HT","Achats HT","Marge HT","Taux"].map((s,i) => <th key={s} className={`py-3 pr-4 ${i ? "text-right" : ""}`}>{s}</th>)}</tr></thead><tbody>{lignes.map(l => <tr key={l.mois} className="border-b border-border"><td className="py-3 pr-4">{libelleMois(l.mois)}</td><td className="pr-4 text-right tabular-nums">{formaterCentimes(l.ca)}</td><td className="pr-4 text-right tabular-nums">{formaterCentimes(l.achats)}</td><td className="pr-4 text-right font-medium text-margin tabular-nums">{formaterCentimes(l.marge)}</td><td className="pr-4 text-right">{afficherTaux(l.marge,l.ca)}</td></tr>)}</tbody></table></div></details>
    <p className="mt-3 text-xs text-muted-foreground">Achats comptés au mois de commande. Rattachement par chantier : en développement.</p>
  </section>;
}