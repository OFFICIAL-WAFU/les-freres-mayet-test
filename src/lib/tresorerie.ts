/**
 * Prévision de trésorerie indicative, calculée sur vos factures à encaisser et vos charges saisies.
 * Ce n'est pas votre solde bancaire : aucun rapprochement bancaire n'est fait ici.
 * Montants en centimes entiers ; dates AAAA-MM-JJ (Europe/Paris), la date du jour est toujours passée en paramètre.
 */
export type Repetition = "aucune" | "mensuelle";
export type Charge = { id: string; libelle: string; date: string; montant: number; repetition: Repetition };
export type SoldeDepart = { date: string; montant: number };
export type BibliothequeTresorerie = { version: number; solde?: SoldeDepart; charges: Charge[] };
export type Entree = { date?: string | undefined; montant: bigint };
export type LigneMois = { mois: string; entrees: bigint; sorties: bigint; net: bigint; cumul: bigint | null };
export type Prevision = { retard: bigint; sansDate: bigint; mois: LigneMois[] };

const MAX_CENTIMES = 1_000_000_000_000; // 10 milliards d'euros : borne de bon sens, sûre en entier JS
const MAX_CHARGES = 2000;

export function dateReelle(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
}
function texteSimple(t: unknown, max: number): t is string {
  return typeof t === "string" && t.trim().length > 0 && t.length <= max && !/[\r\n\u0000-\u001f]/.test(t);
}
function entierCentimes(n: unknown, permettreNegatif: boolean): n is number {
  return typeof n === "number" && Number.isInteger(n) && Math.abs(n) <= MAX_CENTIMES && (permettreNegatif ? true : n > 0);
}

export function validerCharge(v: unknown): Charge {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("Charge invalide.");
  const c = v as Record<string, unknown>;
  for (const k of Object.keys(c)) if (!["id", "libelle", "date", "montant", "repetition"].includes(k)) throw new Error("Charge invalide : champ inconnu.");
  if (typeof c["id"] !== "string" || !c["id"] || c["id"].length > 64 || c["id"] === "__proto__") throw new Error("Identifiant de charge invalide.");
  if (!texteSimple(c["libelle"], 120)) throw new Error("Le libellé est obligatoire (120 caractères au plus, sur une ligne).");
  if (!dateReelle(c["date"])) throw new Error("La date de la charge est invalide.");
  if (!entierCentimes(c["montant"], false)) throw new Error("Le montant de la charge doit être positif.");
  if (c["repetition"] !== "aucune" && c["repetition"] !== "mensuelle") throw new Error("Répétition invalide.");
  return { id: c["id"], libelle: c["libelle"].trim(), date: c["date"], montant: c["montant"], repetition: c["repetition"] };
}

export function validerTresorerie(v: unknown): BibliothequeTresorerie {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("Données de trésorerie invalides.");
  const b = v as { version?: unknown; solde?: unknown; charges?: unknown };
  if (!Number.isInteger(b.version) || (b.version as number) < 0) throw new Error("Version de trésorerie invalide.");
  if (!Array.isArray(b.charges) || b.charges.length > MAX_CHARGES) throw new Error("Liste de charges invalide.");
  const charges = b.charges.map(validerCharge);
  if (new Set(charges.map(c => c.id)).size !== charges.length) throw new Error("Charges en double.");
  const resultat: BibliothequeTresorerie = { version: b.version as number, charges };
  if (b.solde !== undefined) {
    const s = b.solde as Record<string, unknown> | null;
    if (s === null || typeof s !== "object" || Array.isArray(s) || !dateReelle(s["date"]) || !entierCentimes(s["montant"], true)) throw new Error("Solde de départ invalide.");
    resultat.solde = { date: s["date"] as string, montant: s["montant"] as number };
  }
  return resultat;
}

/** Ajoute n mois à un mois AAAA-MM. */
export function ajouterMois(mois: string, n: number): string {
  const [a, m] = mois.split("-").map(Number) as [number, number];
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
function dernierJour(mois: string): number {
  const [a, m] = mois.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Dates d'une charge dans le mois donné (0 ou 1 occurrence). Le jour est ramené à la fin du mois si besoin (31 → 30, 28…). */
export function occurrencesDansMois(charge: Charge, mois: string): string[] {
  const moisCharge = charge.date.slice(0, 7);
  if (charge.repetition === "aucune") return moisCharge === mois ? [charge.date] : [];
  if (mois < moisCharge) return [];
  const jour = Math.min(Number(charge.date.slice(8, 10)), dernierJour(mois));
  return [`${mois}-${String(jour).padStart(2, "0")}`];
}

export function libelleMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number) as [number, number];
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
}

export function preparerPrevision(p: { entrees: Entree[]; charges: Charge[]; solde?: SoldeDepart | undefined; aujourdHui: string; nombreMois?: number }): Prevision {
  const n = p.nombreMois ?? 6;
  if (!Number.isInteger(n) || n < 1 || n > 24) throw new Error("Nombre de mois invalide.");
  if (!dateReelle(p.aujourdHui)) throw new Error("Date du jour invalide.");
  const premier = p.aujourdHui.slice(0, 7);
  const mois = Array.from({ length: n }, (_, i) => ajouterMois(premier, i));
  let retard = 0n, sansDate = 0n;
  const entreesParMois = new Map<string, bigint>(mois.map(m => [m, 0n]));
  for (const e of p.entrees) {
    if (e.montant <= 0n) continue;
    if (!e.date || !dateReelle(e.date)) { sansDate += e.montant; continue; }
    if (e.date < p.aujourdHui) { retard += e.montant; continue; }
    const m = e.date.slice(0, 7);
    if (entreesParMois.has(m)) entreesParMois.set(m, entreesParMois.get(m)! + e.montant);
  }
  const depart = p.solde?.date;
  let cumul: bigint | null = p.solde ? BigInt(p.solde.montant) : null;
  const lignes: LigneMois[] = [];
  for (const m of mois) {
    let sorties = 0n;
    for (const c of p.charges) for (const d of occurrencesDansMois(c, m)) {
      // Une charge antérieure au solde de départ est déjà dans ce solde ; sans solde, seul le mois en cours et les suivants comptent.
      if (depart ? d >= depart : true) sorties += BigInt(c.montant);
    }
    const entrees = entreesParMois.get(m)!;
    const net = entrees - sorties;
    if (cumul !== null) cumul += net;
    lignes.push({ mois: m, entrees, sorties, net, cumul });
  }
  return { retard, sansDate, mois: lignes };
}
