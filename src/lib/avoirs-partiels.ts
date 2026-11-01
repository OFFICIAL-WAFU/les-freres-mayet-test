// Avoirs partiels : calcul d'aperçu côté écran, identique à la fonction SQL avoir_calculer_lignes.
// Le serveur recalcule tout à la préparation ET à la finalisation : ce fichier ne sert qu'à montrer le montant avant de valider.
// Aucune dépendance (testable seul). Montants en centimes, quantités en millièmes.

export interface LigneFactureAvoir {
  id: string; designation: string; quantiteMilliemes: number; prixCentimes: number; taux: number; htCentimes: number; tvaCentimes: number;
}
export interface LigneCrediteeAvoir { id: string; quantiteMilliemes: number; htCentimes: number; tvaCentimes: number }
export interface DemandeAvoir { id: string; quantiteMilliemes: number }
export interface LigneAvoirCalculee { id: string; quantiteMilliemes: number; htCentimes: number; tvaCentimes: number; ttcCentimes: number }
export interface ResteLigne { id: string; deja: number; reste: number; resteHt: number; resteTva: number; creditable: boolean }
export type ResultatAvoir =
  | { ok: true; lignes: LigneAvoirCalculee[]; ht: number; tva: number; ttc: number; ventilation: { taux: number; base: number; tva: number }[] }
  | { ok: false; erreur: "aucune_ligne" | "ligne_inconnue" | "ligne_non_creditable" | "quantite_invalide" | "quantite_depassee" | "montant_nul" | "depasse_facture"; ligne?: string };

/** Même arrondi que la base : demi vers le haut, valeurs positives. */
const arrondi = (n: number, d: number) => Math.trunc((n * 2 + d) / (2 * d));

/** Ce qu'il reste à créditer sur chaque ligne, d'après les avoirs FINALISÉS de la facture. */
export function resteParLigne(lignes: LigneFactureAvoir[], creditees: LigneCrediteeAvoir[]): ResteLigne[] {
  return lignes.map((l) => {
    const c = creditees.filter((x) => x.id === l.id);
    const deja = c.reduce((s, x) => s + x.quantiteMilliemes, 0);
    const dejaHt = c.reduce((s, x) => s + x.htCentimes, 0), dejaTva = c.reduce((s, x) => s + x.tvaCentimes, 0);
    const reste = l.quantiteMilliemes - deja;
    return { id: l.id, deja, reste: Math.max(reste, 0), resteHt: l.htCentimes - dejaHt, resteTva: l.tvaCentimes - dejaTva,
      creditable: l.quantiteMilliemes > 0 && l.prixCentimes >= 0 };
  });
}

/** Montant total encore créditable (TTC) = total facture − avoirs finalisés. */
export const resteACrediterTtc = (totalTtc: number, creditee: number) => Math.max(totalTtc - creditee, 0);

export function calculerAvoirPartiel(lignes: LigneFactureAvoir[], creditees: LigneCrediteeAvoir[], demandes: DemandeAvoir[], totalTtcFacture: number, dejaCreditTtc: number): ResultatAvoir {
  if (!demandes.length) return { ok: false, erreur: "aucune_ligne" };
  const restes = resteParLigne(lignes, creditees);
  const vus = new Set<string>();
  const sortie: LigneAvoirCalculee[] = [];
  for (const d of demandes) {
    if (vus.has(d.id)) return { ok: false, erreur: "quantite_invalide", ligne: d.id };
    vus.add(d.id);
    const l = lignes.find((x) => x.id === d.id), r = restes.find((x) => x.id === d.id);
    if (!l || !r) return { ok: false, erreur: "ligne_inconnue", ligne: d.id };
    if (!r.creditable) return { ok: false, erreur: "ligne_non_creditable", ligne: d.id };
    if (!Number.isSafeInteger(d.quantiteMilliemes) || d.quantiteMilliemes <= 0) return { ok: false, erreur: "quantite_invalide", ligne: d.id };
    if (d.quantiteMilliemes > r.reste) return { ok: false, erreur: "quantite_depassee", ligne: d.id };
    let ht: number, tva: number;
    if (d.quantiteMilliemes === r.reste) { ht = r.resteHt; tva = r.resteTva; }
    else { ht = arrondi(d.quantiteMilliemes * l.prixCentimes, 1000); tva = arrondi(ht * l.taux, 1000); }
    sortie.push({ id: l.id, quantiteMilliemes: d.quantiteMilliemes, htCentimes: ht, tvaCentimes: tva, ttcCentimes: ht + tva });
  }
  // Ordre de la facture.
  sortie.sort((a, b) => lignes.findIndex((x) => x.id === a.id) - lignes.findIndex((x) => x.id === b.id));
  const ht = sortie.reduce((s, l) => s + l.htCentimes, 0), tva = sortie.reduce((s, l) => s + l.tvaCentimes, 0);
  if (ht + tva <= 0) return { ok: false, erreur: "montant_nul" };
  if (dejaCreditTtc + ht + tva > totalTtcFacture) return { ok: false, erreur: "depasse_facture" };
  const parTaux = new Map<number, { base: number; tva: number }>();
  for (const s of sortie) {
    const t = lignes.find((x) => x.id === s.id)!.taux;
    const p = parTaux.get(t) ?? { base: 0, tva: 0 };
    p.base += s.htCentimes; p.tva += s.tvaCentimes; parTaux.set(t, p);
  }
  const ventilation = [...parTaux.entries()].sort((a, b) => a[0] - b[0]).map(([taux, v]) => ({ taux, base: v.base, tva: v.tva }));
  return { ok: true, lignes: sortie, ht, tva, ttc: ht + tva, ventilation };
}

/** « 1,5 » ou « 1.5 » → 1500 millièmes ; null si invalide (nul, négatif, plus de 3 décimales). */
export function quantiteEnMilliemes(texte: string): number | null {
  const t = texte.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(t)) return null;
  const [e, d = ""] = t.split(".");
  const v = Number(e) * 1000 + Number(d.padEnd(3, "0"));
  return v > 0 ? v : null;
}

export const milliemesEnTexte = (m: number) => {
  const e = Math.trunc(m / 1000), d = String(m % 1000).padStart(3, "0").replace(/0+$/, "");
  return d ? `${e},${d}` : String(e);
};

export const MESSAGES_AVOIR_PARTIEL: Record<string, string> = {
  avoir_depasse_facture: "Le total des avoirs dépasserait le montant de la facture.",
  quantite_depassee: "Une quantité dépasse ce qu'il reste à créditer sur cette ligne.",
  ligne_inconnue: "Une ligne ne fait pas partie de cette facture.",
  ligne_non_creditable: "Cette ligne ne peut pas être créditée.",
  lignes_invalides: "Choisissez au moins une ligne avec une quantité valide.",
  avoir_montant_nul: "Le montant de l'avoir est nul : choisissez des lignes à créditer.",
  avoir_deja_partiel: "Cette facture a déjà été partiellement créditée : préparez un avoir partiel sur ce qu'il reste.",
  avoir_abandonne: "Cet avoir brouillon a été abandonné.",
};
