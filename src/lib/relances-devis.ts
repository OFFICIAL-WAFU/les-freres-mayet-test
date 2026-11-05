// Relances des devis — règles pures (date du jour Europe/Paris passée en paramètre, aucun accès réseau).
// Décision de Baptiste du 05/11/2026 : 1re relance 3 jours après l'envoi, 2e relance 10 jours après la 1re, puis plus rien.
// Seuls les devis finalisés, en attente de réponse, non signés, non facturés et encore valables sont concernés.
// Rien n'est envoyé ici : ces règles ne font que dire QUOI relancer ; l'utilisateur valide chaque envoi.
import { joursEcoules } from "@/lib/suivi-devis";

export type NatureEnvoi = "envoi" | "relance1" | "relance2";
export type CanalEnvoi = "gmail" | "messagerie" | "aucun";
export interface EnvoiDevis { id: string; devis_id: string; nature: NatureEnvoi; canal: CanalEnvoi; destinataire: string; sujet: string; avec_pdf: boolean; avec_lien: boolean; le: string }

export const DELAIS_RELANCE = { premiere: 3, seconde: 10 } as const;

/** Ce que les règles ont besoin de savoir d'un devis. */
export interface DevisSuivi {
  id: string; finalise: boolean; reponse: "attente" | "accepte" | "refuse"; signe: boolean; facture: boolean;
  dateDevis: string; validite: string; montantHTCentimes: bigint;
}
export interface RelanceAFaire { devisId: string; rang: 1 | 2; depuis: string; jours: number; montantHTCentimes: bigint }

const jour = (iso: string) => iso.slice(0, 10);
/** Date du jour à Paris d'un horodatage ISO (les envois sont enregistrés en UTC). */
export function jourParis(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return jour(iso);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Relance due pour un devis, ou null. Repère : dernier envoi noté, sinon date du devis. */
export function relanceDue(d: DevisSuivi, envois: EnvoiDevis[], aujourdHui: string, delais = DELAIS_RELANCE): RelanceAFaire | null {
  if (!d.finalise || d.reponse !== "attente" || d.signe || d.facture) return null;
  if (d.validite && d.validite < aujourdHui) return null;
  const miens = envois.filter(e => e.devis_id === d.id);
  if (miens.some(e => e.nature === "relance2")) return null;
  const r1 = miens.find(e => e.nature === "relance1");
  if (r1) {
    const depuis = jourParis(r1.le), jours = joursEcoules(depuis, aujourdHui);
    return jours >= delais.seconde ? { devisId: d.id, rang: 2, depuis, jours, montantHTCentimes: d.montantHTCentimes } : null;
  }
  const dernierEnvoi = miens.filter(e => e.nature === "envoi" && e.canal !== "aucun").map(e => jourParis(e.le)).sort().pop();
  const depuis = dernierEnvoi ?? d.dateDevis, jours = joursEcoules(depuis, aujourdHui);
  return jours >= delais.premiere ? { devisId: d.id, rang: 1, depuis, jours, montantHTCentimes: d.montantHTCentimes } : null;
}

/** Relances du jour, les plus gros devis d'abord (taux de signature plus faible au-delà de 2 000 € HT), puis les plus anciennes. */
export function relancesDuJour(devis: DevisSuivi[], envois: EnvoiDevis[], aujourdHui: string, delais = DELAIS_RELANCE): RelanceAFaire[] {
  return devis.map(d => relanceDue(d, envois, aujourdHui, delais)).filter((r): r is RelanceAFaire => r !== null)
    .sort((a, b) => (b.montantHTCentimes > a.montantHTCentimes ? 1 : b.montantHTCentimes < a.montantHTCentimes ? -1 : 0) || b.jours - a.jours);
}

export const SEUIL_PRIORITAIRE_CENTIMES = 200000n;

/** Adresse e-mail simple (un seul destinataire). */
export const emailValide = (s: string) => /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(s.trim());

/** Texte affiché « Envoyé il y a 5 jours » / « 1re relance il y a 12 jours ». */
export function libelleDepuis(r: RelanceAFaire, aEnvoi: boolean): string {
  const base = r.rang === 2 ? "1re relance" : aEnvoi ? "Envoyé" : "Devis daté";
  return `${base} il y a ${r.jours} jour${r.jours > 1 ? "s" : ""}`;
}

/** Prochaine étape d'un devis d'après son journal : envoi, puis 1re relance, puis 2e relance, puis simple renvoi. */
export function prochaineNature(envois: EnvoiDevis[]): NatureEnvoi {
  if (!envois.some(e => e.nature === "envoi" && e.canal !== "aucun") && !envois.some(e => e.nature === "relance1")) return "envoi";
  if (!envois.some(e => e.nature === "relance1")) return "relance1";
  if (!envois.some(e => e.nature === "relance2")) return "relance2";
  return "envoi";
}
