/**
 * Suivi manuel des devis : date d'envoi, relance faite, réponse notée à la main.
 * Aucune signature, aucun accord et aucun envoi n'est enregistré ici : ce sont des repères de suivi.
 * Toutes les fonctions reçoivent la date du jour (Europe/Paris) pour rester testables.
 */
export type ReponseDevis = "attente" | "accepte" | "refuse";
export type SuiviDevis = { reponse: ReponseDevis; envoyeLe?: string; relanceLe?: string };
export type BibliothequeSuivis = { version: number; suivis: Record<string, SuiviDevis> };
export type EtatSuiviDevis = "non-envoye" | "en-attente" | "a-relancer" | "accepte" | "refuse";

export const DELAI_RELANCE_PAR_DEFAUT = 3;
const REPONSES: readonly ReponseDevis[] = ["attente", "accepte", "refuse"];

function dateReelle(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
}
function controlerDate(d: unknown, aujourdHui: string, nom: string): string {
  if (!dateReelle(d)) throw new Error(`${nom} : date invalide.`);
  if (d > aujourdHui) throw new Error(`${nom} : la date ne peut pas être dans le futur.`);
  return d;
}

export function joursEcoules(depuis: string, aujourdHui: string): number {
  return Math.round((Date.parse(`${aujourdHui}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / 86400000);
}

export function validerSuivi(valeur: unknown, aujourdHui: string): SuiviDevis {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) throw new Error("Suivi de devis invalide.");
  const v = valeur as Record<string, unknown>;
  for (const cle of Object.keys(v)) if (!["reponse", "envoyeLe", "relanceLe"].includes(cle)) throw new Error("Suivi de devis invalide : champ inconnu.");
  if (!REPONSES.includes(v["reponse"] as ReponseDevis)) throw new Error("Réponse du client invalide.");
  const suivi: SuiviDevis = { reponse: v["reponse"] as ReponseDevis };
  if (v["envoyeLe"] !== undefined) suivi.envoyeLe = controlerDate(v["envoyeLe"], aujourdHui, "Date d’envoi");
  if (v["relanceLe"] !== undefined) {
    if (!suivi.envoyeLe) throw new Error("Une relance suppose une date d’envoi.");
    const r = controlerDate(v["relanceLe"], aujourdHui, "Date de relance");
    if (r < suivi.envoyeLe) throw new Error("La relance ne peut pas précéder l’envoi.");
    suivi.relanceLe = r;
  }
  return suivi;
}

export function validerSuivis(valeur: unknown, aujourdHui: string): BibliothequeSuivis {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) throw new Error("Suivis de devis invalides.");
  const v = valeur as { version?: unknown; suivis?: unknown };
  if (!Number.isInteger(v.version) || (v.version as number) < 0) throw new Error("Version des suivis invalide.");
  if (v.suivis === null || typeof v.suivis !== "object" || Array.isArray(v.suivis)) throw new Error("Suivis de devis invalides.");
  const suivis: Record<string, SuiviDevis> = {};
  const entrees = Object.entries(v.suivis as Record<string, unknown>);
  if (entrees.length > 10000) throw new Error("Trop de suivis de devis.");
  for (const [id, s] of entrees) {
    if (!id || id.length > 64 || id === "__proto__") throw new Error("Identifiant de devis invalide.");
    Object.defineProperty(suivis, id, { value: validerSuivi(s, aujourdHui), enumerable: true, writable: true, configurable: true });
  }
  return { version: v.version as number, suivis };
}

/** Actions : chacune renvoie un nouveau suivi, validé, sans modifier l'ancien. */
export function marquerEnvoye(ancien: SuiviDevis | undefined, date: string, aujourdHui: string): SuiviDevis {
  // Une nouvelle date d'envoi remet la relance à zéro ; la réponse déjà notée est conservée.
  return validerSuivi({ reponse: ancien?.reponse ?? "attente", envoyeLe: date }, aujourdHui);
}
export function marquerRelance(ancien: SuiviDevis | undefined, date: string, aujourdHui: string): SuiviDevis {
  if (!ancien?.envoyeLe) throw new Error("Notez d’abord la date d’envoi du devis.");
  return validerSuivi({ ...ancien, relanceLe: date }, aujourdHui);
}
export function noterReponse(ancien: SuiviDevis | undefined, reponse: ReponseDevis, aujourdHui: string): SuiviDevis {
  return validerSuivi({ ...(ancien ?? {}), reponse }, aujourdHui);
}

function pluriel(n: number): string { return `${n} jour${n > 1 ? "s" : ""}`; }

export function etatSuiviDevis(suivi: SuiviDevis | undefined, aujourdHui: string, delai = DELAI_RELANCE_PAR_DEFAUT): { etat: EtatSuiviDevis; jours: number; libelle: string } {
  if (!suivi?.envoyeLe) return { etat: "non-envoye", jours: 0, libelle: "Envoi non noté" };
  if (suivi.reponse === "accepte") return { etat: "accepte", jours: 0, libelle: "Accepté (noté à la main)" };
  if (suivi.reponse === "refuse") return { etat: "refuse", jours: 0, libelle: "Refusé (noté à la main)" };
  const repere = suivi.relanceLe ?? suivi.envoyeLe;
  const jours = Math.max(0, joursEcoules(repere, aujourdHui));
  const base = suivi.relanceLe ? "Relancé" : "Envoyé";
  const quand = jours === 0 ? "aujourd’hui" : `il y a ${pluriel(jours)}`;
  return jours >= delai
    ? { etat: "a-relancer", jours, libelle: `${base} ${quand} · sans réponse` }
    : { etat: "en-attente", jours, libelle: `${base} ${quand}` };
}
