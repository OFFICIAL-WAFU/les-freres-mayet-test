import type { DocumentAvecDevis } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { dateParis, suiviEcheance } from "./echeances";

export type PeriodeDocuments = "toutes" | "annee" | "mois" | "30jours";
export const PERIODES_DOCUMENTS: Record<PeriodeDocuments, string> = {
  toutes: "Toutes les périodes", annee: "Année en cours", mois: "Mois en cours", "30jours": "30 derniers jours",
};
export function dateDocumentIso(date: string): string | null {
  const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(date) ? date.split("/").reverse().join("-") : date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const instant = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === iso ? iso : null;
}
/** Période de date d'émission, bornes inclusives ; les jours futurs sont exclus. */
export function dansPeriode(date: string, periode: PeriodeDocuments, aujourdHui = dateParis()): boolean {
  if (periode === "toutes") return true;
  const iso = dateDocumentIso(date);
  if (!iso || iso > aujourdHui) return false;
  const debut = periode === "annee" ? `${aujourdHui.slice(0, 4)}-01-01`
    : periode === "mois" ? `${aujourdHui.slice(0, 7)}-01`
    : new Date(Date.parse(`${aujourdHui}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  return iso >= debut;
}
export type FiltreSuiviClient = "tous" | "attente" | "retard" | "paye";
export function suiviDocumentClient(d: DocumentAvecDevis, aujourdHui = dateParis()) {
  if (d.fictif || d.statut !== "Finalisé" || !["facture", "acompte"].includes(d.type) || d.aRegler === undefined) return null;
  const suivi = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
  return { ...suivi, retard: suiviEcheance(d.devis?.validite, suivi.reste, aujourdHui).etat === "retard" };
}
export function correspondSuiviClient(d: DocumentAvecDevis, filtre: FiltreSuiviClient, aujourdHui = dateParis()): boolean {
  if (filtre === "tous") return true;
  const s = suiviDocumentClient(d, aujourdHui);
  if (!s) return false;
  return filtre === "retard" ? s.retard : filtre === "attente" ? s.reste > 0n && !s.retard : s.regle > 0n;
}
/** TTC émis : acompte + solde uniquement. Les avoirs sont séparés des encaissements. */
export function syntheseClient(documents: DocumentAvecDevis[], clientId: string, periode: PeriodeDocuments, aujourdHui = dateParis()) {
  const total = { facture: 0n, credite: 0n, attente: 0n, retard: 0n, paye: 0n, creditClient: 0n };
  for (const d of documents) {
    if (d.clientId !== clientId || !dansPeriode(d.date, periode, aujourdHui)) continue;
    const s = suiviDocumentClient(d, aujourdHui);
    if (!s) continue;
    total.facture += s.aRegler;
    total.credite += s.credite;
    total.paye += s.regle;
    total.creditClient += s.creditClient;
    if (s.retard) total.retard += s.reste;
    else total.attente += s.reste;
  }
  return total;
}
