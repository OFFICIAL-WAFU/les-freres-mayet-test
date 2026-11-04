// Reprise Khosmos (migrations 20261103220000 + 20261103233000) — règles PURES, sans accès base.
// Les documents historiques sont figés : on les affiche tels quels, sans jamais recalculer leurs montants.
import type { DevisBrouillon, LigneSaisie, TauxTVA } from "@/data/devis";
import type { ArticleType, Unite } from "@/data/catalogue";

export type TypeImporte = "devis" | "facture" | "acompte" | "avoir";
export interface LigneImportee {
  type?: "materiel" | "prestation"; designation?: string; description?: string; quantite?: number;
  unite?: string; prix_ht?: number; tva?: number; prix_affiche?: boolean;
}
export interface DocumentImporte {
  id: string; type: TypeImporte; reference: string; date_document: string; client_id: string | null; client_nom: string;
  objet: string; total_ht_centimes: number; total_tva_centimes: number; total_ttc_centimes: number;
  statut_source: string; date_echeance: string | null; reference_liee: string; deja_regle_centimes: number | null;
  lignes: LigneImportee[]; source: Record<string, unknown>;
}
export type CategorieConnaissance = "tarif" | "regle" | "redaction" | "checklist" | "mention" | "fournisseur" | "autre";
export type StatutConnaissance = "a_valider" | "valide" | "rejete";
export interface Connaissance {
  id: string; categorie: CategorieConnaissance; metier: string; titre: string; contenu: string;
  statut: StatutConnaissance; source: string; updated_at: string;
}
export interface LigneModele {
  articleId: string | null; type: ArticleType; reference: string; designation: string; description: string;
  unite: Unite | ""; quantite: string; prix: string; taux: number | null;
}
export interface ModeleDevis {
  id: string; nom: string; metier: string; type_travaux: string; objet: string; lignes: LigneModele[];
  remarques: string; conditions_paiement: string; notes_usage: string; updated_at: string;
}

export const TYPES_IMPORTES: Record<TypeImporte, string> = { devis: "Devis", facture: "Facture", acompte: "Acompte", avoir: "Avoir" };
export const CATEGORIES_CONNAISSANCES: Record<CategorieConnaissance, string> = {
  tarif: "Tarifs", regle: "Règles", redaction: "Rédaction", checklist: "À ne pas oublier", mention: "Mentions", fournisseur: "Fournisseurs", autre: "Activité",
};
export const STATUTS_CONNAISSANCES: Record<StatutConnaissance, string> = { a_valider: "À valider", valide: "Validée", rejete: "Écartée" };
export const METIERS: Record<string, string> = { plomberie: "Plomberie", electricite: "Électricité", climatisation: "Climatisation", general: "Général" };

const STATUTS_KHOSMOS: Record<string, string> = {
  pending: "En attente", signed: "Signé", "marked-as-signed": "Signé", refused: "Refusé", expired: "Expiré",
  payed: "Payée", canceled: "Annulée", overdue: "En retard", completed: "Émis",
};
/** Statut d'origine traduit ; un statut inconnu est affiché tel quel plutôt qu'inventé. */
export const statutKhosmos = (s: string) => STATUTS_KHOSMOS[s] ?? (s || "—");

/** « Devis n°218 » : la numérotation Khosmos est un numéro seul, continu par série. */
export const titreImporte = (d: Pick<DocumentImporte, "type" | "reference">) => `${TYPES_IMPORTES[d.type]} n°${d.reference}`;

/** Facture finale avec acomptes : le total des travaux reste le montant du document, le net à payer est conservé à part. */
export function netAPayer(d: DocumentImporte): number {
  const n = d.source["net_a_payer_centimes"];
  return typeof n === "number" && Number.isSafeInteger(n) ? n : d.total_ttc_centimes;
}

export const dateFr = (iso: string | null) => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};

/** Montant affiché d'une ligne historique (nombre décimal d'origine Khosmos), sans recalcul du document. */
export const nombreFr = (n: number | undefined, dec = 2) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "—";

export const quantiteFr = (n: number | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: 3 }) : "—";

export function filtrerImportes(docs: DocumentImporte[], recherche: string, type: TypeImporte | "tous"): DocumentImporte[] {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = n(recherche.trim());
  return docs.filter(d => (type === "tous" || d.type === type) && (!q || n(`${d.reference} ${d.client_nom} ${d.objet}`).includes(q)));
}

const TAUX: readonly number[] = [0, 55, 100, 200];
const decimalFr = (s: string) => s.trim().replace(".", ",");

/** Nouveau brouillon depuis un modèle : client, dates de validité et notes vides ; prix et quantités à vérifier. */
export function devisDepuisModeleTravaux(m: ModeleDevis, aujourdHui: string, cle: () => string = () => crypto.randomUUID()): DevisBrouillon {
  const lignes: LigneSaisie[] = m.lignes.map(l => ({
    cle: cle(), articleId: l.articleId ?? null, type: l.type === "materiel" ? "materiel" : "prestation",
    reference: l.reference ?? "", designation: l.designation, description: l.description ?? "",
    unite: l.unite ?? "", quantite: decimalFr(l.quantite || "1"), prix: decimalFr(l.prix ?? ""),
    taux: typeof l.taux === "number" && TAUX.includes(l.taux) ? (l.taux as TauxTVA) : null,
  }));
  return {
    clientId: "", client: { nom: "", telephone: "", email: "", adresse: [] }, objet: m.objet, date: aujourdHui, validite: "",
    remarques: m.remarques ?? "", conditions: m.conditions_paiement ?? "", notes: "", lignes,
  };
}

export const LIMITES_CONNAISSANCES_IA = { nombre: 40, contenu: 2000, total: 30000 } as const;
/** Seules les connaissances VALIDÉES par l'utilisateur sont transmises à l'IA, tronquées et plafonnées. */
export function connaissancesPourIA(liste: Connaissance[]): { titre: string; contenu: string }[] {
  const out: { titre: string; contenu: string }[] = [];
  let total = 0;
  for (const c of liste) {
    if (c.statut !== "valide" || out.length >= LIMITES_CONNAISSANCES_IA.nombre) continue;
    const e = { titre: c.titre.slice(0, 300), contenu: c.contenu.slice(0, LIMITES_CONNAISSANCES_IA.contenu) };
    if (total + e.titre.length + e.contenu.length > LIMITES_CONNAISSANCES_IA.total) break;
    total += e.titre.length + e.contenu.length; out.push(e);
  }
  return out;
}
