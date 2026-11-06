import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { achatsQueryOptions } from "@/data/achats";
import { filtrerAchats, libelleMois, METIERS_ACHATS, totalAchats } from "@/lib/achats-marge";
import { formaterCentimes } from "@/data/devis";

export const Route = createFileRoute("/_authenticated/achats")({
  validateSearch: (s: Record<string, unknown>) => ({ mois: typeof s.mois === "string" ? s.mois : "", fournisseur: typeof s.fournisseur === "string" ? s.fournisseur : "", metier: typeof s.metier === "string" ? s.metier : "", recherche: typeof s.recherche === "string" ? s.recherche : "" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(achatsQueryOptions(context.user.id)),
  head: () => ({ meta: [{ title: "Achats — Les Frères Mayet" }, { name: "description", content: "Suivi des lignes d’achat, fournisseurs et montants HT." }, { property: "og:title", content: "Achats — Les Frères Mayet" }, { property: "og:description", content: "Suivi des lignes d’achat, fournisseurs et montants HT." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <AppLayout titre="Achats"><p role="status">Chargement des achats…</p></AppLayout>,
  errorComponent: () => <AppLayout titre="Achats"><p role="alert">Les achats n’ont pas pu être chargés.</p><Button variant="outline" onClick={() => window.location.reload()}>Réessayer</Button></AppLayout>,
  notFoundComponent: () => <AppLayout titre="Achats"><p>Page introuvable.</p></AppLayout>,
  component: AchatsPage,
});

function Filtre({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string,string][] }) {
  return <Select value={value || "__tous"} onValueChange={v => onChange(v === "__tous" ? "" : v)}><SelectTrigger className="w-full sm:w-52" aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__tous">{label}</SelectItem>{options.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>;
}
function AchatsPage() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(achatsQueryOptions(user.id));
  const filtres = Route.useSearch();
  const navigate = Route.useNavigate();
  const changer = (key: keyof typeof filtres, value: string) => void navigate({ search: prev => ({ ...prev, [key]: value }), replace: true });
  const lignes = filtrerAchats(data, filtres);
  const mois = [...new Set(data.map(l => l.date_achat.slice(0,7)))].sort().reverse();
  const fournisseurs = [...new Set(data.map(l => l.fournisseur).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  return <AppLayout titre="Achats"><h1 className="text-3xl font-semibold">Achats</h1>
    <div className="mt-5 flex flex-wrap gap-3">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Rechercher un achat" placeholder="Fournisseur, chantier, référence…" className="pl-9" value={filtres.recherche} onChange={e => changer("recherche",e.target.value)} /></div>
      <Filtre label="Tous les mois" value={filtres.mois} onChange={v => changer("mois",v)} options={mois.map(m => [m,libelleMois(m)])} />
      <Filtre label="Tous les fournisseurs" value={filtres.fournisseur} onChange={v => changer("fournisseur",v)} options={fournisseurs.map(f => [f,f])} />
      <Filtre label="Tous les métiers" value={filtres.metier} onChange={v => changer("metier",v)} options={Object.entries(METIERS_ACHATS)} />
      <Button variant="outline" onClick={() => void navigate({ search: { mois: "", fournisseur: "", metier: "", recherche: "" } })}>Réinitialiser</Button>
    </div>
    <p className="mt-4 text-sm text-muted-foreground">{lignes.length} ligne{lignes.length > 1 ? "s" : ""} d’achat</p>
    {lignes.length === 0 ? <p className="py-10 text-sm text-muted-foreground">{data.length === 0 ? "Aucune ligne d’achat enregistrée." : "Aucun achat ne correspond aux filtres."}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b border-border text-left">{["Date","Fournisseur","N° facture","Chantier","Référence","Désignation","Métier","Qté","PU HT","Total HT"].map((h,i) => <th key={h} className={`px-3 py-3 ${i >= 7 ? "text-right" : ""}`}>{h}</th>)}</tr></thead><tbody>{lignes.map(l => <tr key={l.id} className="border-b border-border"><td className="whitespace-nowrap px-3 py-3">{l.date_achat.split("-").reverse().join("/")}</td>{[l.fournisseur,l.num_facture,l.chantier_texte,l.reference,l.designation,METIERS_ACHATS[l.metier as keyof typeof METIERS_ACHATS] ?? l.metier].map((s,i) => <td key={i} className="max-w-64 break-words px-3 py-3">{s || "—"}</td>)}<td className="whitespace-nowrap px-3 py-3 text-right">{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(l.quantite)} {l.unite}</td><td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formaterCentimes(BigInt(l.prix_unitaire_ht_centimes))}</td><td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{formaterCentimes(BigInt(l.total_ht_centimes))}</td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-border py-4 font-semibold"><span>Total HT filtré</span><span className="tabular-nums">{formaterCentimes(totalAchats(lignes))}</span></div>
  </AppLayout>;
}