import { useSyncExternalStore } from "react";

export type ArticleType = "materiel" | "prestation";
export type Metier = "plomberie" | "electricite" | "climatisation" | "general";
export type Unite = "piece" | "heure" | "forfait" | "metre" | "m2" | "m3";

export interface Article {
  id: string;
  type: ArticleType;
  reference: string;
  designation: string;
  description: string;
  metier: Metier;
  unite: Unite;
  prixHT: number;
  marque: string;
  referenceFabricant: string;
  notes: string;
  archive: boolean;
}

export type ArticleSaisie = Omit<Article, "id" | "archive">;

export const TYPE_ARTICLE_LABELS: Record<ArticleType, string> = {
  materiel: "Matériel",
  prestation: "Prestation",
};

export const METIER_LABELS: Record<Metier, string> = {
  plomberie: "Plomberie",
  electricite: "Électricité",
  climatisation: "Climatisation",
  general: "Général",
};

export const UNITE_LABELS: Record<Unite, string> = {
  piece: "Pièce",
  heure: "Heure",
  forfait: "Forfait",
  metre: "Mètre",
  m2: "m²",
  m3: "m³",
};

const UNITE_SUFFIXE: Record<Unite, string> = {
  piece: "pièce",
  heure: "heure",
  forfait: "forfait",
  metre: "mètre",
  m2: "m²",
  m3: "m³",
};

const fmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formaterPrix(prix: number, unite: Unite): string {
  return `${fmt.format(prix).replace(/\u202f|\u00a0/g, " ")} € HT / ${UNITE_SUFFIXE[unite]}`;
}

export function normaliserReference(r: string): string {
  return r.trim().toLowerCase();
}

/** Renvoie le nombre ou un message d'erreur. Une valeur vide n'est jamais 0. */
export function analyserPrix(saisie: string): number | string {
  const s = saisie.trim().replace(/\s/g, "");
  if (!s) return "Indiquez un prix de vente HT.";
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return "Le prix doit être un nombre (exemple : 60,50).";
  const n = Number(s.replace(",", "."));
  if (n < 0) return "Le prix ne peut pas être négatif.";
  if (/[.,]\d{3,}$/.test(s)) return "Le prix ne peut pas avoir plus de deux décimales.";
  return n;
}

const a = (
  id: string,
  type: ArticleType,
  reference: string,
  designation: string,
  metier: Metier,
  unite: Unite,
  prixHT: number,
  extra: Partial<ArticleSaisie> = {},
): Article => ({
  id,
  type,
  reference,
  designation,
  metier,
  unite,
  prixHT,
  description: "",
  marque: "",
  referenceFabricant: "",
  notes: "",
  archive: false,
  ...extra,
});

const ARTICLES_DEMO: Article[] = [
  a("art-001", "materiel", "MAT-PLB-001", "Siphon de lavabo", "plomberie", "piece", 14.5, {
    marque: "Marque démo A", referenceFabricant: "SPH-32", description: "Siphon PVC diamètre 32 mm.",
  }),
  a("art-002", "materiel", "MAT-PLB-002", "Mitigeur de lavabo", "plomberie", "piece", 89, {
    marque: "Marque démo B", referenceFabricant: "MTG-L100", description: "Mitigeur chromé, cartouche céramique.",
  }),
  a("art-003", "materiel", "MAT-ELE-001", "Prise électrique 2P+T", "electricite", "piece", 9.8, {
    marque: "Marque démo C", referenceFabricant: "PR-16A",
  }),
  a("art-004", "materiel", "MAT-ELE-002", "Disjoncteur 16 A", "electricite", "piece", 18.9, {
    marque: "Marque démo C", referenceFabricant: "DJ-16",
  }),
  a("art-005", "materiel", "MAT-CLI-001", "Support de climatisation mural", "climatisation", "piece", 45, {
    marque: "Marque démo D", referenceFabricant: "SUP-450",
  }),
  a("art-006", "materiel", "MAT-CLI-002", "Liaison frigorifique 1/4 - 3/8", "climatisation", "metre", 22, {
    marque: "Marque démo D", notes: "Vendue au mètre linéaire.",
  }),
  a("art-007", "prestation", "PRE-PLB-001", "Remplacement d'un mitigeur", "plomberie", "forfait", 95, {
    description: "Dépose de l'ancien mitigeur et pose du nouveau, hors fourniture.",
  }),
  a("art-008", "prestation", "PRE-PLB-002", "Recherche de fuite", "plomberie", "forfait", 180),
  a("art-009", "prestation", "PRE-ELE-001", "Main-d'œuvre en électricité", "electricite", "heure", 60),
  a("art-010", "prestation", "PRE-ELE-002", "Remplacement d'une prise", "electricite", "forfait", 45),
  a("art-011", "prestation", "PRE-CLI-001", "Entretien de climatisation", "climatisation", "forfait", 120, {
    description: "Nettoyage des filtres, contrôle de fonctionnement.",
  }),
  a("art-012", "prestation", "PRE-GEN-001", "Déplacement", "general", "forfait", 35, {
    notes: "Zone d'intervention habituelle.",
  }),
];

let articles: Article[] = ARTICLES_DEMO;
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

export function useArticles(): Article[] {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => articles,
    () => ARTICLES_DEMO,
  );
}

let compteur = 0;
export function ajouterArticle(s: ArticleSaisie): Article {
  compteur += 1;
  const nouveau: Article = { ...s, id: `art-nouveau-${Date.now()}-${compteur}`, archive: false };
  articles = [...articles, nouveau];
  notifier();
  return nouveau;
}

export function modifierArticle(id: string, s: ArticleSaisie): void {
  articles = articles.map((x) => (x.id === id ? { ...s, id, archive: x.archive } : x));
  notifier();
}

export function definirArchive(id: string, archive: boolean): void {
  articles = articles.map((x) => (x.id === id ? { ...x, archive } : x));
  notifier();
}
