/**
 * Rapports d'intervention : compte rendu d'un passage sur chantier (travaux faits, matériel posé, heures, signature du client sur place).
 * Un rapport n'est ni un devis, ni une facture : il ne crée aucun montant, aucun règlement et aucun numéro de facturation.
 * La numérotation RI-AAAA-NNN est locale à cet appareil. Dates AAAA-MM-JJ (Europe/Paris), jour courant toujours passé en paramètre.
 */
export type LigneMateriel = { designation: string; quantite: number; unite: string }; // quantité en centièmes
export type Photo = { image: string; legende: string }; // JPEG en data URL, compressée par l'application
export type Signature = { image: string; nom: string; signeLe: string };
export type Rapport = {
  id: string; numero: string; creeLe: string; date: string;
  client: { nom: string; telephone: string; adresse: string };
  chantier: string; objet: string; travaux: string; observations: string;
  materiel: LigneMateriel[]; minutes: number; intervenant: string; photos: Photo[];
  signature?: Signature;
};
export type SaisieRapport = Omit<Rapport, "id" | "numero" | "creeLe" | "signature">;
export type BibliothequeRapports = { version: number; prochain: number; rapports: Rapport[] };

const MAX_RAPPORTS = 500;
const MAX_IMAGE = 250_000;
export const MAX_PHOTOS = 6;
export const MAX_PHOTO = 150_000; // caractères de la data URL (~110 Ko)
const MAX_MINUTES = 60_000;
const MAX_QUANTITE = 100_000_000; // 1 000 000,00

export function dateReelle(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
}
function ligne(t: unknown, nom: string, max: number, obligatoire: boolean): string {
  if (typeof t !== "string") throw new Error(`${nom} : texte invalide.`);
  const v = t.trim();
  if (obligatoire && !v) throw new Error(`${nom} est obligatoire.`);
  if (v.length > max || /[\r\n\u0000-\u001f]/.test(v)) throw new Error(`${nom} : ${max} caractères au plus, sur une seule ligne.`);
  return v;
}
function bloc(t: unknown, nom: string, max: number, obligatoire: boolean): string {
  if (typeof t !== "string") throw new Error(`${nom} : texte invalide.`);
  const v = t.replace(/\r\n/g, "\n").trim();
  if (obligatoire && !v) throw new Error(`${nom} est obligatoire.`);
  if (v.length > max || /[\u0000-\u0009\u000b-\u001f]/.test(v)) throw new Error(`${nom} : ${max} caractères au plus.`);
  return v;
}

/** « 2,5 » ou « 2.50 » → 250 centièmes ; null si invalide, nul ou plus de deux décimales. */
export function analyserQuantite(saisie: string): number | null {
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(saisie.trim());
  if (!m) return null;
  const n = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return n > 0 && n <= MAX_QUANTITE ? n : null;
}
export function formaterQuantiteRapport(centiemes: number): string {
  const e = Math.floor(centiemes / 100), d = centiemes % 100;
  return d === 0 ? String(e) : `${e},${String(d).padStart(2, "0").replace(/0$/, "")}`;
}
/** « 1,5 » heures → 90 minutes ; null si invalide ou hors bornes. */
export function analyserHeures(saisie: string): number | null {
  const s = saisie.trim();
  if (!s) return 0;
  const m = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const minutes = Math.round((Number(m[1]) + Number((m[2] ?? "0").padEnd(2, "0")) / 100) * 60);
  return minutes <= MAX_MINUTES ? minutes : null;
}
export function formaterDuree(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export function validerPhotos(v: unknown): Photo[] {
  if (!Array.isArray(v) || v.length > MAX_PHOTOS) throw new Error(`Photos invalides (${MAX_PHOTOS} au plus).`);
  return v.map((p: unknown, i: number): Photo => {
    const x = (p ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(x)) if (!["image", "legende"].includes(k)) throw new Error(`Photo ${i + 1} : champ inconnu.`);
    if (typeof x["image"] !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(x["image"]) || x["image"].length > MAX_PHOTO) throw new Error(`Photo ${i + 1} : image invalide ou trop volumineuse.`);
    return { image: x["image"], legende: ligne(x["legende"] ?? "", `Photo ${i + 1} : légende`, 100, false) };
  });
}

export function validerSaisie(v: unknown, aujourdHui: string): SaisieRapport {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("Rapport invalide.");
  const r = v as Record<string, unknown>;
  const c = (r["client"] ?? {}) as Record<string, unknown>;
  if (typeof c !== "object" || Array.isArray(c)) throw new Error("Client invalide.");
  if (!dateReelle(r["date"])) throw new Error("La date d’intervention est invalide.");
  if (r["date"] > aujourdHui) throw new Error("La date d’intervention ne peut pas être dans le futur.");
  if (!Array.isArray(r["materiel"]) || r["materiel"].length > 100) throw new Error("Liste de matériel invalide (100 lignes au plus).");
  const materiel = r["materiel"].map((l: unknown, i: number): LigneMateriel => {
    const x = (l ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(x["quantite"]) || (x["quantite"] as number) <= 0 || (x["quantite"] as number) > MAX_QUANTITE) throw new Error(`Matériel, ligne ${i + 1} : quantité invalide.`);
    return { designation: ligne(x["designation"], `Matériel, ligne ${i + 1} : désignation`, 120, true), quantite: x["quantite"] as number, unite: ligne(x["unite"] ?? "", `Matériel, ligne ${i + 1} : unité`, 12, false) };
  });
  if (!Number.isInteger(r["minutes"]) || (r["minutes"] as number) < 0 || (r["minutes"] as number) > MAX_MINUTES) throw new Error("Durée invalide.");
  return {
    date: r["date"],
    client: { nom: ligne(c["nom"], "Le nom du client", 120, true), telephone: ligne(c["telephone"] ?? "", "Le téléphone", 30, false), adresse: ligne(c["adresse"] ?? "", "L’adresse du client", 200, false) },
    chantier: ligne(r["chantier"] ?? "", "L’adresse du chantier", 200, false),
    objet: ligne(r["objet"], "L’objet de l’intervention", 150, true),
    travaux: bloc(r["travaux"], "Les travaux réalisés", 4000, true),
    observations: bloc(r["observations"] ?? "", "Les observations", 2000, false),
    materiel, minutes: r["minutes"] as number,
    intervenant: ligne(r["intervenant"] ?? "", "L’intervenant", 80, false),
    photos: validerPhotos(r["photos"] ?? []),
  };
}

export function validerSignature(v: unknown, aujourdHui: string): Signature {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("Signature invalide.");
  const s = v as Record<string, unknown>;
  for (const k of Object.keys(s)) if (!["image", "nom", "signeLe"].includes(k)) throw new Error("Signature invalide : champ inconnu.");
  if (typeof s["image"] !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(s["image"]) || s["image"].length > MAX_IMAGE) throw new Error("L’image de la signature est invalide ou trop volumineuse.");
  if (!dateReelle(s["signeLe"]) || s["signeLe"] > aujourdHui) throw new Error("La date de signature est invalide.");
  return { image: s["image"], nom: ligne(s["nom"], "Le nom du signataire", 80, true), signeLe: s["signeLe"] };
}

export function validerRapport(v: unknown, aujourdHui: string): Rapport {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("Rapport invalide.");
  const r = v as Record<string, unknown>;
  const { signature, ...reste } = r;
  const base = validerSaisie(reste, aujourdHui);
  if (typeof r["id"] !== "string" || !r["id"] || r["id"].length > 64 || r["id"] === "__proto__") throw new Error("Identifiant de rapport invalide.");
  if (typeof r["numero"] !== "string" || !/^RI-\d{4}-\d{3,6}$/.test(r["numero"])) throw new Error("Numéro de rapport invalide.");
  if (!dateReelle(r["creeLe"]) || r["creeLe"] > aujourdHui) throw new Error("Date de création invalide.");
  const rapport: Rapport = { ...base, id: r["id"], numero: r["numero"], creeLe: r["creeLe"] };
  if (signature !== undefined) rapport.signature = validerSignature(signature, aujourdHui);
  return rapport;
}

export function validerRapports(v: unknown, aujourdHui: string): BibliothequeRapports {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("Rapports invalides.");
  const b = v as { version?: unknown; prochain?: unknown; rapports?: unknown };
  if (!Number.isInteger(b.version) || (b.version as number) < 0) throw new Error("Version des rapports invalide.");
  if (!Number.isInteger(b.prochain) || (b.prochain as number) < 1 || (b.prochain as number) > 999_999) throw new Error("Compteur de rapports invalide.");
  if (!Array.isArray(b.rapports) || b.rapports.length > MAX_RAPPORTS) throw new Error("Liste de rapports invalide.");
  const rapports = b.rapports.map(r => validerRapport(r, aujourdHui));
  if (new Set(rapports.map(r => r.id)).size !== rapports.length || new Set(rapports.map(r => r.numero)).size !== rapports.length) throw new Error("Rapports en double.");
  return { version: b.version as number, prochain: b.prochain as number, rapports };
}

export function creerRapport(b: BibliothequeRapports, saisie: unknown, id: string, aujourdHui: string): { bibliotheque: BibliothequeRapports; rapport: Rapport } {
  if (b.rapports.length >= MAX_RAPPORTS) throw new Error(`Limite de ${MAX_RAPPORTS} rapports atteinte : supprimez d’anciens rapports de test.`);
  const base = validerSaisie(saisie, aujourdHui);
  const rapport = validerRapport({ ...base, id, numero: `RI-${aujourdHui.slice(0, 4)}-${String(b.prochain).padStart(3, "0")}`, creeLe: aujourdHui }, aujourdHui);
  return { bibliotheque: { ...b, prochain: b.prochain + 1, rapports: [...b.rapports, rapport] }, rapport };
}

/** Un rapport signé est figé : on ne modifie plus ses contenus. */
export function modifierRapport(b: BibliothequeRapports, id: string, saisie: unknown, aujourdHui: string): BibliothequeRapports {
  const ancien = b.rapports.find(r => r.id === id);
  if (!ancien) throw new Error("Rapport introuvable.");
  if (ancien.signature) throw new Error("Ce rapport est signé : il ne peut plus être modifié.");
  const nouveau = validerRapport({ ...validerSaisie(saisie, aujourdHui), id: ancien.id, numero: ancien.numero, creeLe: ancien.creeLe }, aujourdHui);
  return { ...b, rapports: b.rapports.map(r => r.id === id ? nouveau : r) };
}

export function signerRapport(b: BibliothequeRapports, id: string, signature: unknown, aujourdHui: string): BibliothequeRapports {
  const ancien = b.rapports.find(r => r.id === id);
  if (!ancien) throw new Error("Rapport introuvable.");
  if (ancien.signature) throw new Error("Ce rapport est déjà signé.");
  const s = validerSignature(signature, aujourdHui);
  if (s.signeLe < ancien.date) throw new Error("La signature ne peut pas précéder la date d’intervention.");
  return { ...b, rapports: b.rapports.map(r => r.id === id ? { ...r, signature: s } : r) };
}

export function supprimerRapport(b: BibliothequeRapports, id: string): BibliothequeRapports {
  if (!b.rapports.some(r => r.id === id)) throw new Error("Rapport introuvable.");
  return { ...b, rapports: b.rapports.filter(r => r.id !== id) };
}
