export const METIERS_ACHATS = { plomberie: "Plomberie", electricite: "Électricité", climatisation: "Climatisation", fournitures: "Fournitures", frais: "Frais", sous_traitance: "Sous-traitance", electromenager: "Électroménager" } as const;
export type PeriodeMarge = "depuis-avril" | "annee" | "mois";
export type MoisMarge = { mois: string; ca: bigint; achats: bigint; marge: bigint };
export type Achat = { id: string; date_achat: string; fournisseur: string; num_facture: string; chantier_texte: string; reference: string; designation: string; metier: string; quantite: number; unite: string; prix_unitaire_ht_centimes: number; total_ht_centimes: number };
export type FiltresAchats = { mois: string; fournisseur: string; metier: string; recherche: string };

export function dateParis() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function debutPeriodeMarge(periode: PeriodeMarge, date: string): string {
  return periode === "depuis-avril" ? "2026-04" : periode === "annee" ? `${date.slice(0, 4)}-01` : date.slice(0, 7);
}
export function selectionMarge(lignes: MoisMarge[], periode: PeriodeMarge, date: string): MoisMarge[] {
  const debut = debutPeriodeMarge(periode, date);
  const fin = date.slice(0, 7);
  return lignes.filter(l => l.mois >= debut && l.mois <= fin).sort((a, b) => a.mois.localeCompare(b.mois));
}
export function totalMarge(lignes: MoisMarge[]) {
  const ca = lignes.reduce((s, l) => s + l.ca, 0n);
  const achats = lignes.reduce((s, l) => s + l.achats, 0n);
  return { ca, achats, marge: ca - achats };
}
export function tauxMarge(marge: bigint, ca: bigint): number | null {
  return ca === 0n ? null : Number(marge) / Number(ca) * 100;
}
export function afficherTaux(marge: bigint, ca: bigint) {
  const taux = tauxMarge(marge, ca);
  return taux === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(taux)} %`;
}
export function libelleMois(mois: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mois}-01T12:00:00Z`));
}
const normaliser = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function filtrerAchats(lignes: Achat[], filtres: FiltresAchats) {
  const q = normaliser(filtres.recherche.trim());
  return lignes.filter(l => (!filtres.mois || l.date_achat.startsWith(filtres.mois)) && (!filtres.fournisseur || l.fournisseur === filtres.fournisseur) && (!filtres.metier || l.metier === filtres.metier) && normaliser([l.fournisseur,l.num_facture,l.chantier_texte,l.reference,l.designation,l.metier,METIERS_ACHATS[l.metier as keyof typeof METIERS_ACHATS] ?? ""].join(" ")).includes(q));
}
export function totalAchats(lignes: Achat[]) {
  return lignes.reduce((s, l) => s + BigInt(l.total_ht_centimes), 0n);
}