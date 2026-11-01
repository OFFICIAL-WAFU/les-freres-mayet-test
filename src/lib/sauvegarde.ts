/**
 * Sauvegarde des données conservées sur l'appareil (rapports, planning, suivi des devis, trésorerie).
 * La restauration FUSIONNE : elle n'écrase et ne supprime jamais rien d'existant ; ce qui a le même identifiant est ignoré.
 * La validation détaillée est faite par chaque bibliothèque au moment de l'écriture.
 */
import type { Intervention } from "@/lib/planning";
import type { Rapport } from "@/lib/rapports";
import type { SuiviDevis } from "@/lib/suivi-devis";
import type { Charge, SoldeDepart } from "@/lib/tresorerie";

export const FORMAT_SAUVEGARDE = "mayet-sauvegarde-locale";
export const TAILLE_MAX_SAUVEGARDE = 150_000_000;
export type Sauvegarde = {
  format: typeof FORMAT_SAUVEGARDE; version: 1; creeLe: string;
  rapports: Rapport[]; prochainRapport: number; interventions: Intervention[];
  charges: Charge[]; solde?: SoldeDepart; suivis: Record<string, SuiviDevis>;
};

export function creerSauvegarde(d: { rapports: Rapport[]; prochainRapport: number; interventions: Intervention[]; charges: Charge[]; solde?: SoldeDepart | undefined; suivis: Record<string, SuiviDevis> }, maintenant: string): Sauvegarde {
  return { format: FORMAT_SAUVEGARDE, version: 1, creeLe: maintenant, rapports: d.rapports, prochainRapport: d.prochainRapport, interventions: d.interventions, charges: d.charges, ...(d.solde ? { solde: d.solde } : {}), suivis: d.suivis };
}

export function lireSauvegarde(texte: string): Sauvegarde {
  if (texte.length > TAILLE_MAX_SAUVEGARDE) throw new Error("Fichier trop volumineux pour être une sauvegarde.");
  let v: unknown;
  try { v = JSON.parse(texte); } catch { throw new Error("Ce fichier n’est pas une sauvegarde lisible."); }
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || Array.isArray(o) || o["format"] !== FORMAT_SAUVEGARDE) throw new Error("Ce fichier n’est pas une sauvegarde de cette application.");
  if (o["version"] !== 1) throw new Error("Version de sauvegarde non prise en charge.");
  const liste = (k: string) => { const x = o[k]; if (!Array.isArray(x)) throw new Error(`Sauvegarde incomplète : « ${k} » manquant.`); return x; };
  const suivis = o["suivis"];
  if (!suivis || typeof suivis !== "object" || Array.isArray(suivis)) throw new Error("Sauvegarde incomplète : « suivis » manquant.");
  const prochain = o["prochainRapport"];
  if (!Number.isInteger(prochain) || (prochain as number) < 1) throw new Error("Sauvegarde invalide : compteur de rapports.");
  return { format: FORMAT_SAUVEGARDE, version: 1, creeLe: String(o["creeLe"] ?? ""), rapports: liste("rapports") as Rapport[], prochainRapport: prochain as number, interventions: liste("interventions") as Intervention[], charges: liste("charges") as Charge[], ...(o["solde"] ? { solde: o["solde"] as SoldeDepart } : {}), suivis: suivis as Record<string, SuiviDevis> };
}

/** Ajoute les éléments importés absents ; ignore ceux dont l'identifiant (ou, au choix, une autre clé) existe déjà. */
export function fusionner<T extends { id: string }>(actuel: T[], importes: T[], conflit: (a: T, b: T) => boolean = () => false): { resultat: T[]; ajoutes: number; ignores: number } {
  const resultat = [...actuel]; let ajoutes = 0, ignores = 0;
  for (const i of importes) {
    if (resultat.some(a => a.id === i.id || conflit(a, i))) { ignores++; continue; }
    resultat.push(i); ajoutes++;
  }
  return { resultat, ajoutes, ignores };
}
export function fusionnerSuivis(actuels: Record<string, SuiviDevis>, importes: Record<string, SuiviDevis>): { resultat: Record<string, SuiviDevis>; ajoutes: number; ignores: number } {
  const resultat = { ...actuels }; let ajoutes = 0, ignores = 0;
  for (const [id, s] of Object.entries(importes)) {
    if (id === "__proto__" || Object.prototype.hasOwnProperty.call(resultat, id)) { ignores++; continue; }
    resultat[id] = s; ajoutes++;
  }
  return { resultat, ajoutes, ignores };
}
export function nomFichierSauvegarde(date: string) { return `Sauvegarde_Les_Freres_Mayet_${date}.json`; }
