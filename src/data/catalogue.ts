import { useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
  /** Prix d'achat unitaire HT (€) ; null = inconnu, jamais inventé. Interne : n'apparaît jamais sur les documents clients. */
  prixAchat: number | null;
  marque: string;
  referenceFabricant: string;
  notes: string;
  archive: boolean;
  /** Version enregistrée (date de dernière modification côté serveur). */
  majLe?: string;
}

export type ArticleSaisie = Omit<Article, "id" | "archive" | "majLe">;

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

/** Prix d'achat facultatif : vide = inconnu (null), sinon un nombre positif à 2 décimales au plus. */
export function analyserPrixAchat(saisie: string): number | null | string {
  const s = saisie.trim().replace(/\s/g, "");
  if (!s) return null;
  if (!/^\d+([.,]\d+)?$/.test(s)) return "Le prix d'achat doit être un nombre positif (exemple : 47,12).";
  if (/[.,]\d{3,}$/.test(s)) return "Le prix d'achat ne peut pas avoir plus de deux décimales.";
  return Number(s.replace(",", "."));
}

// ---------------------------------------------------------------------------
// Stockage : base Lovable Cloud (table articles, protégée par propriétaire).
// Prix conservé en centimes entiers ; le navigateur ne garde qu'une copie de travail.
// ---------------------------------------------------------------------------

type LigneArticle = Database["public"]["Tables"]["articles"]["Row"];

export function versCentimes(prix: number): number {
  return Math.round(prix * 100);
}

function depuisLigne(l: LigneArticle): Article {
  return {
    id: l.id,
    type: l.type as ArticleType,
    reference: l.reference,
    designation: l.designation,
    description: l.description,
    metier: l.metier as Metier,
    unite: l.unite as Unite,
    prixHT: Number(l.prix_ht_centimes) / 100,
    prixAchat: l.prix_achat_centimes === null || l.prix_achat_centimes === undefined ? null : Number(l.prix_achat_centimes) / 100,
    marque: l.marque,
    referenceFabricant: l.reference_fabricant,
    notes: l.notes,
    archive: l.archive,
    majLe: l.updated_at,
  };
}

function versLigne(s: ArticleSaisie) {
  const materiel = s.type === "materiel";
  return {
    type: s.type,
    reference: s.reference.trim(),
    designation: s.designation.trim(),
    description: s.description.trim(),
    metier: s.metier,
    unite: s.unite,
    prix_ht_centimes: versCentimes(s.prixHT),
    prix_achat_centimes: s.prixAchat === null ? null : versCentimes(s.prixAchat),
    marque: materiel ? s.marque.trim() : "",
    reference_fabricant: materiel ? s.referenceFabricant.trim() : "",
    notes: s.notes.trim(),
  };
}

export type EtatCatalogue = { statut: "inactif" | "chargement" | "pret" | "erreur"; articles: Article[] };

const INITIAL: EtatCatalogue = { statut: "inactif", articles: [] };
let etat: EtatCatalogue = INITIAL;
let generation = 0;
const abonnes = new Set<() => void>();
function definir(e: EtatCatalogue) {
  etat = e;
  abonnes.forEach((f) => f());
}

export function useEtatCatalogue(): EtatCatalogue {
  const e = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
    () => INITIAL,
  );
  useEffect(() => {
    if (etat.statut === "inactif") void chargerCatalogue();
  }, []);
  return e;
}

export function useArticles(): Article[] {
  return useEtatCatalogue().articles;
}

const PAGE = 1000;
/** Charge toutes les pages : la recherche porte sur le catalogue complet. */
export async function chargerCatalogue(): Promise<void> {
  const g = ++generation;
  definir({ statut: "chargement", articles: etat.articles });
  try {
    const tous: Article[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(debut, debut + PAGE - 1);
      if (error) throw error;
      tous.push(...data.map(depuisLigne));
      if (data.length < PAGE) break;
    }
    if (g === generation) definir({ statut: "pret", articles: tous });
  } catch {
    if (g === generation) definir({ statut: "erreur", articles: etat.articles });
  }
}

function remplacer(a: Article) {
  const existe = etat.articles.some((x) => x.id === a.id);
  definir({
    statut: etat.statut === "inactif" ? "pret" : etat.statut,
    articles: existe ? etat.articles.map((x) => (x.id === a.id ? a : x)) : [...etat.articles, a],
  });
}

export class ErreurSauvegardeArticle extends Error {}
export class ConflitVersionArticle extends Error {}
/** La référence est déjà utilisée par un autre article du propriétaire. */
export class ReferenceDejaUtilisee extends Error {
  constructor(public existant: Article | null) {
    super("reference");
  }
}

async function referenceExistante(reference: string, sauf?: string): Promise<Article | null> {
  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("reference_normalisee", normaliserReference(reference));
  const l = (data ?? []).find((x) => x.id !== sauf);
  if (!l) return null;
  const a = depuisLigne(l);
  remplacer(a);
  return a;
}

function estDoublonReference(e: { code?: string; message?: string }) {
  return e.code === "23505" && (e.message ?? "").includes("articles_reference_unique");
}

/** Création avec identifiant stable par tentative : pas de doublon en cas de nouvel essai. */
export async function ajouterArticle(id: string, s: ArticleSaisie): Promise<Article> {
  const { data, error } = await supabase.from("articles").insert({ id, ...versLigne(s) }).select().single();
  if (error) {
    if (error.code === "23505") {
      const relue = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
      if (relue.data) {
        const a = depuisLigne(relue.data);
        remplacer(a);
        return a;
      }
      if (estDoublonReference(error)) throw new ReferenceDejaUtilisee(await referenceExistante(s.reference));
    }
    throw new ErreurSauvegardeArticle(error.message);
  }
  const a = depuisLigne(data);
  remplacer(a);
  return a;
}

async function majVersionnee(id: string, champs: Database["public"]["Tables"]["articles"]["Update"], versionLue: string): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .update(champs)
    .eq("id", id)
    .eq("updated_at", versionLue)
    .select();
  if (error) {
    if (estDoublonReference(error)) {
      throw new ReferenceDejaUtilisee(await referenceExistante(String(champs["reference"] ?? ""), id));
    }
    throw new ErreurSauvegardeArticle(error.message);
  }
  if (!data || data.length === 0) throw new ConflitVersionArticle();
  const a = depuisLigne(data[0]!);
  remplacer(a);
  return a;
}

/** Modifie seulement si l'article n'a pas changé depuis son ouverture. */
export function modifierArticle(id: string, s: ArticleSaisie, versionLue: string): Promise<Article> {
  return majVersionnee(id, versLigne(s), versionLue);
}

/** Archivage / réactivation : simple changement d'état, jamais une suppression. */
export function definirArchive(id: string, archive: boolean, versionLue: string): Promise<Article> {
  return majVersionnee(id, { archive }, versionLue);
}

export async function relireArticle(id: string): Promise<Article | null> {
  const { data, error } = await supabase.from("articles").select("*").eq("id", id).maybeSingle();
  if (error) throw new ErreurSauvegardeArticle(error.message);
  if (!data) return null;
  const a = depuisLigne(data);
  remplacer(a);
  return a;
}

/** Déconnexion : efface la copie en mémoire (les articles restent en base). */
export function reinitialiserCatalogue() {
  generation++;
  definir(INITIAL);
}

const UNITE_PLURIEL: Record<Unite, string> = { piece: "pièces", heure: "heures", forfait: "forfaits", metre: "mètres", m2: "m²", m3: "m³" };
const UNITE_SINGULIER: Record<Unite, string> = { piece: "pièce", heure: "heure", forfait: "forfait", metre: "mètre", m2: "m²", m3: "m³" };
/** Unité au singulier ou au pluriel selon la quantité (« 1 pièce », « 24 pièces »), en minuscules. */
export function uniteAccordee(unite: Unite | string, quantite: number | string): string {
  const q = typeof quantite === "number" ? quantite : Number(String(quantite).replace(/\s/g, "").replace(",", "."));
  if (!(unite in UNITE_SINGULIER)) return String(unite);
  return (Number.isFinite(q) && q > 1 ? UNITE_PLURIEL : UNITE_SINGULIER)[unite as Unite];
}
