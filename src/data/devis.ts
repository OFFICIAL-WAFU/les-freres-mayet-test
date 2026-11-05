import type { ArticleType, Unite } from "@/data/catalogue";
import type { CoutSaisie } from "@/lib/rentabilite";

/** Taux en millièmes : 0, 55 (5,5 %), 100 (10 %), 200 (20 %). */
export type TauxTVA = 0 | 55 | 100 | 200;
export const TAUX_TVA: { value: TauxTVA; label: string }[] = [
  { value: 0, label: "0 %" },
  { value: 55, label: "5,5 %" },
  { value: 100, label: "10 %" },
  { value: 200, label: "20 %" },
];
export const labelTaux = (t: TauxTVA) => TAUX_TVA.find((x) => x.value === t)!.label;

/** Ligne en cours de saisie : les valeurs numériques restent du texte. */
export interface LigneSaisie {
  cle: string;
  articleId: string | null; // traçabilité catalogue
  type: ArticleType;
  reference: string;
  designation: string;
  description: string;
  unite: Unite | "";
  quantite: string;
  prix: string;
  taux: TauxTVA | null;
  /** Coût interne (prix d'achat, coefficient, temps de pose) — jamais visible par le client. */
  cout?: CoutSaisie;
}

export interface CoordonneesClient {
  nom: string;
  contact?: string;
  telephone: string;
  email: string;
  adresse: string[];
}

export interface DevisBrouillon {
  clientId: string;
  client: CoordonneesClient; // copie figée
  objet: string;
  date: string; // AAAA-MM-JJ
  validite: string; // AAAA-MM-JJ ou ""
  remarques: string;
  notes: string;
  /** Conditions de paiement (devis, factures, acomptes) — distinctes des remarques. */
  conditions?: string;
  /** Facture ordinaire : date ou période de réalisation des prestations (AAAA-MM-JJ ou ""). */
  prestationDebut?: string;
  prestationFin?: string;
  lignes: LigneSaisie[];
}

// --- Analyse décimale exacte (entiers) -------------------------------------

/** Convertit un texte en entier à l'échelle 10^dec. Renvoie un message si invalide. */
function analyser(s: string, dec: number, nom: string): bigint | string {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return `Indiquez ${nom}.`;
  const m = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(t);
  if (!m) return `${nom[0]!.toUpperCase()}${nom.slice(1).replace(/^(la|le|un) /, "")} doit être un nombre.`;
  const frac = m[3] ?? "";
  if (frac.length > dec) return `Maximum ${dec} décimales.`;
  const v = BigInt(m[2]! + frac.padEnd(dec, "0"));
  return m[1] ? -v : v;
}

export function analyserQuantite(s: string): bigint | string {
  const v = analyser(s, 3, "la quantité");
  if (typeof v === "string") return v;
  if (v <= 0n) return "La quantité doit être strictement positive.";
  return v; // millièmes
}

export function analyserPrixCentimes(s: string): bigint | string {
  const v = analyser(s, 2, "le prix");
  if (typeof v === "string") return v;
  if (v < 0n) return "Le prix ne peut pas être négatif.";
  return v; // centimes
}

/** Division entière arrondie au plus proche, demi vers le haut (valeurs positives). */
const arrondi = (n: bigint, d: bigint) => (n * 2n + d) / (2n * d);

export interface CalculLigne {
  ht: bigint;
  tva: bigint;
  ttc: bigint;
}

export type ErreursLigne = Partial<Record<"designation" | "unite" | "quantite" | "prix" | "taux", string>>;

export function validerLigne(l: LigneSaisie): { erreurs: ErreursLigne; calcul: CalculLigne | null; ht: bigint | null } {
  const e: ErreursLigne = {};
  if (!l.designation.trim()) e.designation = "Indiquez une désignation.";
  if (!l.unite) e.unite = "Choisissez une unité.";
  const q = analyserQuantite(l.quantite);
  if (typeof q === "string") e.quantite = q;
  const p = analyserPrixCentimes(l.prix);
  if (typeof p === "string") e.prix = p;
  if (l.taux === null) e.taux = "Choisissez un taux de TVA.";
  const ht = typeof q !== "string" && typeof p !== "string" ? arrondi(q * p, 1000n) : null;
  const calcul =
    ht !== null && l.taux !== null
      ? (() => {
          const tva = arrondi(ht * BigInt(l.taux), 1000n);
          return { ht, tva, ttc: ht + tva };
        })()
      : null;
  return { erreurs: e, calcul, ht };
}

export interface Recapitulatif {
  complet: boolean;
  ht: bigint;
  parTaux: { taux: TauxTVA; base: bigint; tva: bigint }[];
  tva: bigint;
  ttc: bigint;
}

export function recapituler(lignes: LigneSaisie[]): Recapitulatif {
  let complet = lignes.length > 0;
  let ht = 0n, tva = 0n;
  const map = new Map<TauxTVA, { base: bigint; tva: bigint }>();
  for (const l of lignes) {
    const r = validerLigne(l);
    if (!r.calcul || Object.keys(r.erreurs).length) {
      complet = false;
      continue;
    }
    ht += r.calcul.ht;
    tva += r.calcul.tva;
    const x = map.get(l.taux!) ?? { base: 0n, tva: 0n };
    map.set(l.taux!, { base: x.base + r.calcul.ht, tva: x.tva + r.calcul.tva });
  }
  const parTaux = TAUX_TVA.filter((t) => map.has(t.value)).map((t) => ({ taux: t.value, ...map.get(t.value)! }));
  return { complet, ht, parTaux, tva, ttc: ht + tva };
}

export function formaterCentimes(c: bigint): string {
  const neg = c < 0n;
  const a = neg ? -c : c;
  const e = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const d = (a % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}${e},${d} €`;
}

/** Identifiant stable de ligne (UUID), conservé en base. */
export const nouvelleCle = () => crypto.randomUUID();

/** Quantité au format français, sans zéros décimaux inutiles. */
export function formaterQuantite(s: string): string {
  const v = analyserQuantite(s);
  if (typeof v === "string") return s;
  const e = (v / 1000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const d = (v % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return d ? `${e},${d}` : e;
}

export function formaterPrixSaisi(s: string): string {
  const v = analyserPrixCentimes(s);
  return typeof v === "string" ? s : formaterCentimes(v);
}
