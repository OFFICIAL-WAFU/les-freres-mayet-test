// Rentabilité des devis — règles pures (aucun accès réseau). Informations INTERNES : jamais affichées au client.
// Prix de vente calculé = prix d'achat × coefficient matériel + temps de pose × taux horaire vendu.
// Coût réel d'une ligne = prix d'achat + temps de pose × coût horaire réel (réglage, figé sur la ligne à la saisie).
// Tous les calculs sont en entiers (centimes, millièmes, minutes), arrondi demi vers le haut, comme le reste du logiciel.
import { analyserPrixCentimes, analyserQuantite, type LigneSaisie } from "@/data/devis";

/** Réglages de chiffrage (habitudes_documents). */
export interface ReglagesChiffrage { coefMilliemes: number; coutHoraireCentimes: number; tauxHoraireCentimes: number }
/** Décision de Baptiste du 05/11/2026 : coefficient matériel 1,6 ; coût réel chargé 25 €/h ; taux vendu 50 €/h. */
export const REGLAGES_DEFAUT: ReglagesChiffrage = { coefMilliemes: 1600, coutHoraireCentimes: 2500, tauxHoraireCentimes: 5000 };

/** Saisie du coût d'une ligne (texte tant que l'utilisateur tape). */
export interface CoutSaisie {
  achat: string; // prix d'achat unitaire HT (€), vide = inconnu
  coef: string; // coefficient matériel, ex. « 1,6 »
  temps: string; // temps de pose par unité, en heures décimales (« 1,5 » = 1 h 30)
  taux: string; // taux horaire vendu (€)
  auto: boolean; // vrai : le prix de vente suit le calcul
  coutHoraire: number | null; // coût horaire réel figé (centimes)
}

const arrondi = (n: bigint, d: bigint) => (n * 2n + d) / (2n * d);

function decimal(s: string, dec: number): bigint | null | "invalide" {
  const t = s.trim().replace(/\s/g, "").replace(/€$/, "");
  if (!t) return null;
  const m = /^(\d+)(?:[.,](\d+))?$/.exec(t);
  if (!m || (m[2] ?? "").length > dec) return "invalide";
  return BigInt(m[1]! + (m[2] ?? "").padEnd(dec, "0"));
}

export const formaterDecimal = (v: bigint | number, dec: number, min = 0): string => {
  const s = BigInt(v).toString().padStart(dec + 1, "0");
  let f = s.slice(-dec);
  while (f.length > min && f.endsWith("0")) f = f.slice(0, -1);
  return f ? `${s.slice(0, -dec)},${f}` : s.slice(0, -dec);
};
/** 90 minutes → « 1,5 » ; 20 minutes → « 0,33 ». */
export const texteTemps = (minutes: number): string => formaterDecimal(BigInt(Math.round((minutes * 100) / 60)), 2);

export type ChampCout = "achat" | "coef" | "temps" | "taux";
export interface CoutAnalyse { achat: bigint | null; coefMilliemes: bigint; minutes: bigint; tauxCentimes: bigint }

/** Valide la saisie ; renvoie les erreurs par champ et, si tout est valide, les valeurs entières. */
export function analyserCout(c: CoutSaisie): { erreurs: Partial<Record<ChampCout, string>>; valeur: CoutAnalyse | null } {
  const e: Partial<Record<ChampCout, string>> = {};
  const achat = decimal(c.achat, 2), coef = decimal(c.coef, 3), centiemesHeure = decimal(c.temps, 2), taux = decimal(c.taux, 2);
  if (achat === "invalide") e.achat = "Prix d'achat : un nombre, 2 décimales au plus.";
  if (coef === "invalide" || coef === null) e.coef = "Coefficient : un nombre, ex. 1,6.";
  else if (coef > 100000n) e.coef = "Coefficient trop élevé.";
  if (centiemesHeure === "invalide") e.temps = "Temps : en heures, ex. 1,5 pour 1 h 30.";
  else if (centiemesHeure !== null && centiemesHeure > 1666600n) e.temps = "Temps trop long.";
  if (taux === "invalide" || taux === null) e.taux = "Taux horaire : un nombre, ex. 50.";
  if (Object.keys(e).length) return { erreurs: e, valeur: null };
  const minutes = centiemesHeure === null ? 0n : arrondi((centiemesHeure as bigint) * 60n, 100n);
  return { erreurs: e, valeur: { achat: achat as bigint | null, coefMilliemes: coef as bigint, minutes, tauxCentimes: taux as bigint } };
}

/** Erreurs de coût d'une ligne, pour la validation du formulaire (clés l-<clé>-achat, -coef, -temps, -taux). */
export function erreursCout(l: LigneSaisie): Partial<Record<ChampCout, string>> {
  return l.cout ? analyserCout(l.cout).erreurs : {};
}

/** Prix de vente unitaire HT calculé (centimes), ou null si la saisie est invalide ou vide (ni achat ni temps). */
export function prixCalcule(c: CoutSaisie): bigint | null {
  const { valeur: v } = analyserCout(c);
  if (!v || (v.achat === null && v.minutes === 0n)) return null;
  return arrondi((v.achat ?? 0n) * v.coefMilliemes, 1000n) + arrondi(v.minutes * v.tauxCentimes, 60n);
}

export const coutVide = (r: ReglagesChiffrage): CoutSaisie => ({
  achat: "", coef: formaterDecimal(r.coefMilliemes, 3, 1), temps: "", taux: formaterDecimal(r.tauxHoraireCentimes, 2, 2), auto: true, coutHoraire: r.coutHoraireCentimes,
});

/**
 * Coût d'une ligne créée depuis un article du catalogue.
 * Prix d'achat connu : il est repris sur la ligne. Le prix de vente suit le calcul (achat × coefficient)
 * seulement si le prix du catalogue est exactement ce calcul ; sinon le prix de vente fixé dans le catalogue
 * est conservé et la marge est calculée sur ce prix. Prix d'achat inconnu : coût vide, prix du catalogue conservé.
 */
export function coutDepuisCatalogue(prixAchatCentimes: number | null, prixVenteCentimes: number, r: ReglagesChiffrage): CoutSaisie {
  const base = coutVide(r);
  if (prixAchatCentimes === null || !Number.isSafeInteger(prixAchatCentimes) || prixAchatCentimes < 0) return base;
  const cout: CoutSaisie = { ...base, achat: formaterDecimal(BigInt(prixAchatCentimes), 2, 2) };
  const calcule = prixCalcule(cout);
  return { ...cout, auto: calcule !== null && calcule === BigInt(prixVenteCentimes) };
}

/** Applique un changement de coût ; si le prix suit le calcul, le prix de vente est mis à jour. */
export function modifierCout(l: LigneSaisie, patch: Partial<CoutSaisie>, r: ReglagesChiffrage): LigneSaisie {
  const cout: CoutSaisie = { ...(l.cout ?? coutVide(r)), ...patch };
  if (cout.coutHoraire === null) cout.coutHoraire = r.coutHoraireCentimes;
  const p = cout.auto ? prixCalcule(cout) : null;
  return { ...l, cout, ...(p !== null ? { prix: formaterDecimal(p, 2, 2) } : {}) };
}

export interface AnalyseLigne {
  connu: boolean; ht: bigint; coutMateriel: bigint; coutMainOeuvre: bigint; venteMateriel: bigint; venteMainOeuvre: bigint; minutes: bigint; marge: bigint;
}

/** Analyse d'une ligne. « connu » = un prix d'achat ou un temps de pose est renseigné et la ligne est valide. */
export function analyserLigne(l: LigneSaisie, r: ReglagesChiffrage): AnalyseLigne | null {
  const q = analyserQuantite(l.quantite), p = analyserPrixCentimes(l.prix);
  if (typeof q === "string" || typeof p === "string") return null;
  const ht = arrondi(q * p, 1000n);
  const vide: AnalyseLigne = { connu: false, ht, coutMateriel: 0n, coutMainOeuvre: 0n, venteMateriel: 0n, venteMainOeuvre: 0n, minutes: 0n, marge: 0n };
  if (!l.cout) return vide;
  const { valeur: v } = analyserCout(l.cout);
  if (!v || (v.achat === null && v.minutes === 0n)) return vide;
  const coutH = BigInt(l.cout.coutHoraire ?? r.coutHoraireCentimes);
  const minutesMilliemes = q * v.minutes; // minutes × 1000
  const coutMateriel = arrondi(q * (v.achat ?? 0n), 1000n);
  const coutMainOeuvre = arrondi(minutesMilliemes * coutH, 60000n);
  let venteMainOeuvre = arrondi(minutesMilliemes * v.tauxCentimes, 60000n);
  if (venteMainOeuvre > ht) venteMainOeuvre = ht;
  return { connu: true, ht, coutMateriel, coutMainOeuvre, venteMateriel: ht - venteMainOeuvre, venteMainOeuvre,
    minutes: arrondi(minutesMilliemes, 1000n), marge: ht - coutMateriel - coutMainOeuvre };
}

export interface Rentabilite {
  lignesConnues: number; lignesSansCout: number; htSansCout: bigint;
  coutMateriel: bigint; venteMateriel: bigint; coutMainOeuvre: bigint; venteMainOeuvre: bigint; minutes: bigint;
  cout: bigint; vente: bigint; marge: bigint;
}

export function rentabilite(lignes: LigneSaisie[], r: ReglagesChiffrage): Rentabilite {
  const t: Rentabilite = { lignesConnues: 0, lignesSansCout: 0, htSansCout: 0n, coutMateriel: 0n, venteMateriel: 0n, coutMainOeuvre: 0n, venteMainOeuvre: 0n, minutes: 0n, cout: 0n, vente: 0n, marge: 0n };
  for (const l of lignes) {
    const a = analyserLigne(l, r);
    if (!a) continue;
    if (!a.connu) { t.lignesSansCout++; t.htSansCout += a.ht; continue; }
    t.lignesConnues++;
    t.coutMateriel += a.coutMateriel; t.venteMateriel += a.venteMateriel;
    t.coutMainOeuvre += a.coutMainOeuvre; t.venteMainOeuvre += a.venteMainOeuvre; t.minutes += a.minutes;
  }
  t.cout = t.coutMateriel + t.coutMainOeuvre; t.vente = t.venteMateriel + t.venteMainOeuvre; t.marge = t.vente - t.cout;
  return t;
}

/** Pourcentage de marge sur le prix de vente, une décimale (« 38,7 % »), ou « — » sans vente. */
export function pourcentage(marge: bigint, vente: bigint): string {
  if (vente <= 0n) return "—";
  const neg = marge < 0n, m = neg ? -marge : marge;
  return `${neg ? "-" : ""}${formaterDecimal(arrondi(m * 1000n, vente), 1, 1)} %`;
}

// --- Conversion avec la base (colonnes de devis_lignes) ----------------------
export interface ColonnesCout {
  prix_achat_centimes?: number | null; coef_materiel_milliemes?: number | null; temps_pose_minutes?: number | null;
  taux_horaire_centimes?: number | null; cout_horaire_centimes?: number | null; prix_calcule?: boolean | null;
}

export function coutDepuisBase(c: ColonnesCout): CoutSaisie | undefined {
  const rien = [c.prix_achat_centimes, c.coef_materiel_milliemes, c.temps_pose_minutes, c.taux_horaire_centimes].every((x) => x === null || x === undefined);
  if (rien && !c.prix_calcule) return undefined;
  const r = REGLAGES_DEFAUT;
  return {
    achat: c.prix_achat_centimes == null ? "" : formaterDecimal(c.prix_achat_centimes, 2, 2),
    coef: formaterDecimal(c.coef_materiel_milliemes ?? r.coefMilliemes, 3, 1),
    temps: c.temps_pose_minutes ? texteTemps(c.temps_pose_minutes) : "",
    taux: formaterDecimal(c.taux_horaire_centimes ?? r.tauxHoraireCentimes, 2, 2),
    auto: !!c.prix_calcule,
    coutHoraire: c.cout_horaire_centimes ?? null,
  };
}

/** Colonnes à envoyer (texte, comme le reste de la charge) ; lève une erreur si la saisie est invalide. */
export function coutVersBase(c: CoutSaisie | undefined, r: ReglagesChiffrage): Record<string, string | boolean> {
  if (!c) return { prix_achat_centimes: "", coef_materiel_milliemes: "", temps_pose_minutes: "", taux_horaire_centimes: "", cout_horaire_centimes: "", prix_calcule: false };
  const { valeur: v } = analyserCout(c);
  if (!v) throw new Error("Coût de ligne invalide");
  return {
    prix_achat_centimes: v.achat === null ? "" : v.achat.toString(), coef_materiel_milliemes: v.coefMilliemes.toString(),
    temps_pose_minutes: v.minutes.toString(), taux_horaire_centimes: v.tauxCentimes.toString(),
    cout_horaire_centimes: String(c.coutHoraire ?? r.coutHoraireCentimes), prix_calcule: c.auto,
  };
}
