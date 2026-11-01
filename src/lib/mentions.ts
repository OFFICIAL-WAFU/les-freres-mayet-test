export type UsageMention = "devis" | "facture" | "acompte";
export const USAGES_MENTIONS: Record<UsageMention, string> = { devis: "Devis", facture: "Factures", acompte: "Acomptes" };
export interface Mention { id: string; titre: string; texte: string; usages: UsageMention[]; archivee: boolean }
export interface BibliothequeMentions { version: number; mentions: Mention[] }
export const nomMention = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
export function validerMention(v: Mention): Mention {
  if (!v || typeof v.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id)) throw new Error("Identifiant de mention invalide.");
  if (typeof v.titre !== "string" || !v.titre.trim() || v.titre.trim().length > 120) throw new Error("Indiquez un titre de 1 à 120 caractères.");
  if (typeof v.texte !== "string" || !v.texte.trim() || v.texte.length > 2000) throw new Error("Indiquez un texte de 1 à 2 000 caractères.");
  if (typeof v.archivee !== "boolean" || !Array.isArray(v.usages) || v.usages.length > 3 || new Set(v.usages).size !== v.usages.length || v.usages.some(u => !Object.hasOwn(USAGES_MENTIONS, u))) throw new Error("Réglages de mention invalides.");
  return { id: v.id, titre: v.titre.trim(), texte: v.texte.trim(), usages: [...v.usages], archivee: v.archivee };
}
export function validerBibliotheque(v: unknown): BibliothequeMentions {
  if (!v || typeof v !== "object") throw new Error("Bibliothèque de mentions invalide.");
  const b = v as BibliothequeMentions;
  if (!Number.isSafeInteger(b.version) || b.version < 0 || !Array.isArray(b.mentions) || b.mentions.length > 200) throw new Error("Bibliothèque de mentions invalide (200 mentions maximum).");
  const mentions = b.mentions.map(validerMention);
  if (new Set(mentions.map(m => m.id)).size !== mentions.length || new Set(mentions.map(m => nomMention(m.titre))).size !== mentions.length) throw new Error("Des identifiants ou titres de mentions sont en double.");
  return { version: b.version, mentions };
}
export function preparerSauvegarde(b: BibliothequeMentions) {
  return { format: "mayet-mentions", schema: 1, mentions: validerBibliotheque(b).mentions };
}
export function lireSauvegarde(v: unknown): Mention[] {
  if (!v || typeof v !== "object" || (v as {format?: unknown}).format !== "mayet-mentions" || (v as {schema?: unknown}).schema !== 1) throw new Error("Choisissez une sauvegarde de mentions Les Frères Mayet.");
  return validerBibliotheque({ version: 0, mentions: (v as {mentions?: unknown}).mentions }).mentions;
}
export function fusionnerMentions(b: BibliothequeMentions, ajouts: Mention[]): BibliothequeMentions {
  const existantes = validerBibliotheque(b).mentions;
  const nouvelles = validerBibliotheque({version: 0, mentions: ajouts}).mentions;
  const mentions = [...existantes];
  for (const m of nouvelles) {
    const ancien = mentions.find(a => a.id === m.id || nomMention(a.titre) === nomMention(m.titre));
    if (ancien) {
      if (JSON.stringify({...ancien, id: ""}) !== JSON.stringify({...m, id: ""})) throw new Error(`La mention « ${m.titre} » existe avec un contenu différent. Aucune mention n’a été remplacée.`);
    } else mentions.push(m);
  }
  return validerBibliotheque({ version: b.version, mentions });
}
/** Ajoute du texte sans remplacer celui du document ; une insertion identique est ignorée. */
export function insererMentions(texte: string, mentions: Mention[]): string {
  let resultat = texte;
  for (const m of mentions.filter(m => !m.archivee)) {
    const bloc = m.texte.trim();
    if (!bloc || (`\n\n${resultat.trim()}\n\n`).includes(`\n\n${bloc}\n\n`)) continue;
    resultat = resultat.trimEnd() + (resultat.trim() ? "\n\n" : "") + bloc;
  }
  if (resultat.length > 20000) throw new Error("Ce texte dépasserait 20 000 caractères. Insérez moins de mentions.");
  return resultat;
}
export function dateHeureMention(type: "date" | "heure", instant = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {timeZone: "Europe/Paris", ...(type === "date" ? {day: "2-digit", month: "2-digit", year: "numeric"} as const : {hour: "2-digit", minute: "2-digit"} as const)}).format(instant);
}
