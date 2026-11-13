// Remise sur facture (13/11/2026) : calcul pur, sans dépendance à l'écran.
// La remise devient une ou plusieurs lignes « REMISE » à prix négatif (une par taux de TVA présent),
// pour que la TVA reste juste taux par taux. Montants en centimes (bigint), comme le reste du logiciel.
import { estLigneRemise, labelTaux, validerLigne, type LigneSaisie, type TauxTVA } from "@/data/devis";

export type ModeRemise = "pourcent" | "ht" | "ttc";

export interface PartRemise { taux: TauxTVA; base: bigint; remiseHt: bigint; remiseTva: bigint }
export interface CalculRemise { parts: PartRemise[]; baseHt: bigint; baseTtc: bigint; remiseHt: bigint; remiseTtc: bigint; netHt: bigint; netTtc: bigint }

/** Arrondi au plus proche, demi éloigné de zéro (même règle que la base pour les remises). */
const arrondi = (n: bigint, d: bigint) => (n >= 0n ? (n * 2n + d) / (2n * d) : -((-n * 2n + d) / (2n * d)));

/** Analyse « 10 », « 10,5 » (pourcentage, en centièmes de %) ou « 50,00 » (euros, en centimes). Deux décimales au plus. */
export function analyserValeurRemise(s: string): bigint | null {
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(s.trim().replace(/\s|€|%/g, ""));
  if (!m) return null;
  return BigInt(m[1]! + (m[2] ?? "").padEnd(2, "0"));
}

/** Répartit un montant entre des poids, proportionnellement ; l'écart d'arrondi va à la part la plus grosse. */
function repartir(montant: bigint, poids: bigint[]): bigint[] {
  const total = poids.reduce((s, x) => s + x, 0n);
  if (total <= 0n) return poids.map(() => 0n);
  const parts = poids.map((p) => arrondi(montant * p, total));
  const ecart = montant - parts.reduce((s, x) => s + x, 0n);
  let iMax = 0;
  poids.forEach((p, i) => { if (p > poids[iMax]!) iMax = i; });
  parts[iMax] = parts[iMax]! + ecart;
  return parts;
}

/**
 * Calcule la remise sur les lignes de la facture (les lignes de remise déjà présentes sont ignorées : elles seront remplacées).
 * valeur : centièmes de % (mode pourcent, 1000 = 10 %) ou centimes (modes ht et ttc). Renvoie un message si impossible.
 */
export function calculerRemise(lignes: LigneSaisie[], mode: ModeRemise, valeur: bigint): CalculRemise | string {
  const autres = lignes.filter((l) => !estLigneRemise(l));
  if (!autres.length) return "Ajoutez d’abord les lignes de la facture.";
  const bases = new Map<TauxTVA, { ht: bigint; tva: bigint }>();
  for (const l of autres) {
    const c = validerLigne(l).calcul;
    if (!c || l.taux === null) return "Complétez toutes les lignes (prix, quantité, TVA) avant d’ajouter la remise.";
    const b = bases.get(l.taux) ?? { ht: 0n, tva: 0n };
    bases.set(l.taux, { ht: b.ht + c.ht, tva: b.tva + c.tva });
  }
  const taux = [...bases.keys()].filter((t) => bases.get(t)!.ht > 0n).sort((a, b) => a - b);
  const baseHt = taux.reduce((s, t) => s + bases.get(t)!.ht, 0n);
  const baseTtc = taux.reduce((s, t) => s + bases.get(t)!.ht + bases.get(t)!.tva, 0n);
  if (baseHt <= 0n) return "Le montant de la facture est nul.";
  if (valeur <= 0n) return "Indiquez une remise supérieure à zéro.";

  let remisesHt: bigint[];
  if (mode === "pourcent") {
    if (valeur >= 10000n) return "La remise doit être inférieure à 100 %.";
    remisesHt = taux.map((t) => arrondi(bases.get(t)!.ht * valeur, 10000n));
  } else if (mode === "ht") {
    if (valeur >= baseHt) return "La remise doit être inférieure au total HT de la facture.";
    remisesHt = repartir(valeur, taux.map((t) => bases.get(t)!.ht));
  } else {
    if (valeur >= baseTtc) return "La remise doit être inférieure au total TTC de la facture.";
    const ttcParTaux = repartir(valeur, taux.map((t) => bases.get(t)!.ht + bases.get(t)!.tva));
    remisesHt = taux.map((t, i) => arrondi(ttcParTaux[i]! * 1000n, 1000n + BigInt(t)));
  }
  const parts: PartRemise[] = taux.map((t, i) => ({ taux: t, base: bases.get(t)!.ht, remiseHt: remisesHt[i]!, remiseTva: arrondi(remisesHt[i]! * BigInt(t), 1000n) }))
    .filter((p) => p.remiseHt > 0n);
  if (!parts.length) return "La remise est trop faible (moins d’un centime).";
  const remiseHt = parts.reduce((s, p) => s + p.remiseHt, 0n), remiseTtc = parts.reduce((s, p) => s + p.remiseHt + p.remiseTva, 0n);
  return { parts, baseHt, baseTtc, remiseHt, remiseTtc, netHt: baseHt - remiseHt, netTtc: baseTtc - remiseTtc };
}

const euros = (c: bigint) => {
  const neg = c < 0n, a = neg ? -c : c;
  return `${neg ? "-" : ""}${(a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${(a % 100n).toString().padStart(2, "0")}`;
};
const pourcent = (v: bigint) => `${v / 100n}${v % 100n ? `,${(v % 100n).toString().padStart(2, "0").replace(/0$/, "")}` : ""} %`;

/**
 * Lignes « REMISE » prêtes à insérer : toutes les anciennes lignes de remise sont retirées, les nouvelles ajoutées à la fin.
 * motif : texte libre facultatif (« Geste commercial »), repris dans la description.
 */
export function appliquerRemise(lignes: LigneSaisie[], calcul: CalculRemise, mode: ModeRemise, valeur: bigint, motif: string, cle: () => string): LigneSaisie[] {
  const plusieurs = calcul.parts.length > 1;
  const nouvelles: LigneSaisie[] = calcul.parts.map((p) => ({
    cle: cle(), articleId: null, type: "prestation", reference: "",
    designation: mode === "pourcent" ? `REMISE ${pourcent(valeur)}` : "REMISE",
    description: [motif.trim(), mode === "pourcent" ? `Remise de ${pourcent(valeur)} sur ${euros(p.base)} € HT` : "", plusieurs ? `Part à TVA ${labelTaux(p.taux)}` : ""]
      .filter(Boolean).join(" — ").slice(0, 500),
    unite: "forfait", quantite: "1", prix: euros(-p.remiseHt), taux: p.taux,
  }));
  return [...lignes.filter((l) => !estLigneRemise(l)), ...nouvelles];
}

export const retirerRemise = (lignes: LigneSaisie[]) => lignes.filter((l) => !estLigneRemise(l));

/** Contrôle avant enregistrement : la remise ne dépasse jamais le montant des lignes à son taux de TVA. */
export function erreurRemise(lignes: LigneSaisie[], estFacture: boolean): string | null {
  const remises = lignes.filter((l) => estLigneRemise(l) && validerLigne(l).calcul && validerLigne(l).calcul!.ht < 0n);
  if (!remises.length) return null;
  if (!estFacture) return "Une remise ne peut être ajoutée que sur une facture.";
  const parTaux = new Map<TauxTVA, bigint>();
  for (const l of lignes) {
    const c = validerLigne(l).calcul;
    if (c && l.taux !== null) parTaux.set(l.taux, (parTaux.get(l.taux) ?? 0n) + c.ht);
  }
  for (const [t, ht] of parTaux) if (ht < 0n) return `La remise dépasse le montant des lignes à TVA ${labelTaux(t)}.`;
  return null;
}
