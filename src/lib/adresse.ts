// Recherche d'adresse (14/11/2026) : Base Adresse Nationale, service public gratuit de l'IGN (Géoplateforme), sans clé.
// Seul le texte tapé dans le champ « Adresse » est envoyé (jamais le nom du client). Les résultats proches de
// Jard-sur-Mer sont placés en premier ; le choix remplit adresse, code postal et ville, toujours modifiables.

export const URL_ADRESSE = "https://data.geopf.fr/geocodage/search";
/** Jard-sur-Mer : les adresses de Vendée remontent en premier. */
const PRES_DE = { lat: 46.414, lon: -1.578 };

export interface SuggestionAdresse { libelle: string; adresse: string; codePostal: string; ville: string; contexte: string }

/** Texte recherchable : 3 caractères utiles au moins, 120 au plus, sans caractères de contrôle. */
export function texteRecherche(t: string): string | null {
  const x = t.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return x.replace(/[^\p{L}\p{N}]/gu, "").length >= 3 ? x : null;
}

export function urlRechercheAdresse(t: string): string | null {
  const q = texteRecherche(t);
  if (!q) return null;
  const p = new URLSearchParams({ q, autocomplete: "1", limit: "6", index: "address", lat: String(PRES_DE.lat), lon: String(PRES_DE.lon) });
  return `${URL_ADRESSE}?${p.toString()}`;
}

const txt = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Réponse du service → suggestions ; seuls les numéros, rues et lieux-dits (pas une commune seule), doublons retirés. */
export function lireSuggestions(json: unknown): SuggestionAdresse[] {
  const f = (json && typeof json === "object" ? (json as { features?: unknown }).features : null);
  if (!Array.isArray(f)) return [];
  const vus = new Set<string>(), sortie: SuggestionAdresse[] = [];
  for (const x of f) {
    const p = (x && typeof x === "object" ? (x as { properties?: Record<string, unknown> }).properties : null) ?? {};
    const type = txt(p["type"], 20);
    if (!["housenumber", "street", "locality"].includes(type)) continue;
    const codePostal = txt(p["postcode"], 5), ville = txt(p["city"], 80);
    const adresse = txt(p["name"]);
    if (!/^\d{5}$/.test(codePostal) || !ville || !adresse) continue;
    const libelle = txt(p["label"]) || `${adresse} ${codePostal} ${ville}`;
    if (vus.has(libelle)) continue;
    vus.add(libelle);
    sortie.push({ libelle, adresse, codePostal, ville, contexte: txt(p["context"], 80) });
  }
  return sortie;
}

/** Interroge le service ; en cas de panne ou de réseau absent : liste vide (la saisie manuelle reste possible). */
export async function chercherAdresses(t: string, signal?: AbortSignal): Promise<SuggestionAdresse[]> {
  const url = urlRechercheAdresse(t);
  if (!url) return [];
  try {
    const r = await fetch(url, { signal: signal ?? null, headers: { accept: "application/json" } });
    return r.ok ? lireSuggestions(await r.json()) : [];
  } catch { return []; }
}
