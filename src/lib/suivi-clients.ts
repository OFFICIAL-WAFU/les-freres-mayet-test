import type { DocumentAvecDevis } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { dateParis, suiviEcheance } from "./echeances";
import { enMode, ttcBrut, type ModeMontant } from "./montants";

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
export type FiltreSuiviClient = "tous" | "attente" | "retard" | "paye" | "impaye" | "devis-non-signes";
export function suiviDocumentClient(d: DocumentAvecDevis, aujourdHui = dateParis()) {
  if (d.fictif || d.statut !== "Finalisé" || !["facture", "acompte"].includes(d.type) || d.aRegler === undefined) return null;
  const suivi = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
  return { ...suivi, retard: suiviEcheance(d.devis?.validite, suivi.reste, aujourdHui).etat === "retard" };
}
export function correspondSuiviClient(d: DocumentAvecDevis, filtre: FiltreSuiviClient, aujourdHui = dateParis()): boolean {
  if (filtre === "tous") return true;
  if (filtre === "devis-non-signes") {
    if (d.fictif || d.type !== "devis" || d.statut !== "Finalisé") return false;
    return d.reponse?.etat !== "accepte" && d.reponse?.etat !== "refuse";
  }
  const s = suiviDocumentClient(d, aujourdHui);
  if (!s) return false;
  return filtre === "retard" ? s.retard : filtre === "attente" ? s.reste > 0n && !s.retard : filtre === "impaye" ? s.reste > 0n : s.regle > 0n;
}
/** TTC émis : acompte + solde uniquement. Les avoirs sont séparés des encaissements. */
export function syntheseClient(documents: DocumentAvecDevis[], clientId: string, periode: PeriodeDocuments, aujourdHui = dateParis(), mode: ModeMontant = "ttc") {
  const total = { facture: 0n, credite: 0n, attente: 0n, retard: 0n, paye: 0n, creditClient: 0n };
  for (const d of documents) {
    if (d.clientId !== clientId || !dansPeriode(d.date, periode, aujourdHui)) continue;
    const s = suiviDocumentClient(d, aujourdHui);
    if (!s) continue;
    const m = (x: bigint) => enMode(d, x, mode);
    total.facture += m(s.aRegler);
    total.credite += m(s.credite);
    total.paye += m(s.regle);
    total.creditClient += m(s.creditClient);
    if (s.retard) total.retard += m(s.reste);
    else total.attente += m(s.reste);
  }
  return total;
}

/** Devis du client par réponse : nombre et TTC (en attente = sans réponse, validité en cours ou dépassée). */
export function syntheseDevisClient(documents: DocumentAvecDevis[], clientId: string, periode: PeriodeDocuments, aujourdHui = dateParis(), mode: ModeMontant = "ttc") {
  const t = { signes: 0, signesTTC: 0n, attente: 0, attenteTTC: 0n, expires: 0, expiresTTC: 0n, refuses: 0, refusesTTC: 0n };
  for (const d of documents) {
    if (d.fictif || d.type !== "devis" || d.statut !== "Finalisé" || d.clientId !== clientId || !dansPeriode(d.date, periode, aujourdHui)) continue;
    const ttc = enMode(d, ttcBrut(d), mode);
    const v = d.devis?.validite;
    if (d.reponse?.etat === "accepte") { t.signes++; t.signesTTC += ttc; }
    else if (d.reponse?.etat === "refuse") { t.refuses++; t.refusesTTC += ttc; }
    else if (v && v < aujourdHui) { t.expires++; t.expiresTTC += ttc; }
    else { t.attente++; t.attenteTTC += ttc; }
  }
  return t;
}

/** Acomptes du client : montant, réglé, reste, et facture de solde qui l'a déduit le cas échéant. */
export function acomptesClient(documents: DocumentAvecDevis[], clientId: string) {
  const deduits = new Map(documents.filter(d => d.type === "facture" && d.deduction?.statut === "finalise").map(d => [d.deduction!.acompteId, d.numero]));
  return documents.filter(d => !d.fictif && d.type === "acompte" && d.statut === "Finalisé" && d.clientId === clientId && d.aRegler !== undefined)
    .map(d => { const s = suivre(d.aRegler!, d.reglements ?? [], d.credite ?? 0n); return { doc: d, ...s, deduitSur: deduits.get(d.id) ?? null }; });
}
