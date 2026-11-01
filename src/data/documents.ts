import { useEffect, useSyncExternalStore } from "react";
import { lireReglement, type Reglement, type ReglementBase } from "@/data/reglements";
import { explicationRefus, lireDeduction, type Deduction } from "@/data/deduction";

import { supabase } from "@/integrations/supabase/client";
import { depuisLigneEntreprise, type Entreprise } from "@/data/entreprise";
import type { Json } from "@/integrations/supabase/types";
import {
  analyserPrixCentimes,
  analyserQuantite,
  type CoordonneesClient,
  type DevisBrouillon,
  type TauxTVA,
} from "@/data/devis";
export type DocumentType = "devis" | "facture" | "acompte" | "avoir" | "rapport";

export type DocumentStatut =
  | "Brouillon"
  | "En attente de signature"
  | "Signé"
  | "En attente de paiement"
  | "Payée"
  | "Payé"
  | "Émis"
  | "Finalisé";

export interface DemoDocument {
  id: string;
  date: string; // JJ/MM/AAAA
  numero: string;
  /** Nom du destinataire tel qu'établi sur le document (historique). */
  client: string;
  /** Identifiant stable de la fiche client. */
  clientId: string;
  type: DocumentType;
  montantTTC: number | null;
  statut: DocumentStatut;
}

export const TYPE_LABELS: Record<DocumentType, string> = {
  devis: "Devis",
  facture: "Facture",
  acompte: "Acompte",
  avoir: "Avoir",
  rapport: "Rapport d'intervention",
};

export const TYPE_FILTERS: { value: DocumentType | "tous"; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "devis", label: "Devis" },
  { value: "facture", label: "Factures" },
  { value: "acompte", label: "Acomptes" },
  { value: "avoir", label: "Avoirs" },
  { value: "rapport", label: "Rapports d'intervention" },
];

export const STATUTS_PAR_TYPE: Record<DocumentType, DocumentStatut[]> = {
  devis: ["Brouillon", "Finalisé", "En attente de signature", "Signé"],
  facture: ["Brouillon", "Finalisé", "En attente de paiement", "Payée"],
  acompte: ["Brouillon", "Finalisé", "En attente de paiement", "Payé"],
  avoir: ["Brouillon", "Finalisé", "Émis"],
  rapport: ["Finalisé"],
};

export const TOUS_LES_STATUTS: DocumentStatut[] = [
  "Brouillon",
  "En attente de signature",
  "Signé",
  "En attente de paiement",
  "Payée",
  "Payé",
  "Émis",
  "Finalisé",
];

export type BadgeTon = "neutre" | "attente" | "valide" | "info";

export function tonDuStatut(statut: DocumentStatut): BadgeTon {
  if (statut === "Brouillon") return "neutre";
  if (statut.startsWith("En attente")) return "attente";
  if (statut === "Signé" || statut === "Payé" || statut === "Payée") return "valide";
  return "info";
}

export function formaterMontant(montant: number | null): string {
  if (montant === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(montant);
}

export const DOCUMENTS_DEMO: DemoDocument[] = [
  {
    id: "1",
    date: "03/02/2026",
    numero: "DEV-2026-014",
    client: "Boulangerie Vergnaud",
    clientId: "cli-vergnaud",
    type: "devis",
    montantTTC: 1250,
    statut: "Brouillon",
  },
  {
    id: "2",
    date: "05/02/2026",
    numero: "DEV-2026-015",
    client: "Camille Rouvier",
    clientId: "cli-rouvier",
    type: "devis",
    montantTTC: 3480.5,
    statut: "En attente de signature",
  },
  {
    id: "3",
    date: "09/02/2026",
    numero: "DEV-2026-016",
    client: "Résidence Les Tilleuls",
    clientId: "cli-tilleuls",
    type: "devis",
    montantTTC: 8920,
    statut: "Signé",
  },
  {
    id: "4",
    date: "11/02/2026",
    numero: "FAC-2026-032",
    client: "Garage Delmas",
    clientId: "cli-delmas",
    type: "facture",
    montantTTC: 2145.9,
    statut: "En attente de paiement",
  },
  {
    id: "5",
    date: "12/02/2026",
    numero: "FAC-2026-033",
    client: "Cabinet Dentaire Loriol",
    clientId: "cli-loriol",
    type: "facture",
    montantTTC: 5760,
    statut: "Payée",
  },
  {
    id: "6",
    date: "14/02/2026",
    numero: "ACO-2026-008",
    client: "Résidence Les Tilleuls",
    clientId: "cli-tilleuls",
    type: "acompte",
    montantTTC: 2676,
    statut: "En attente de paiement",
  },
  {
    id: "7",
    date: "16/02/2026",
    numero: "ACO-2026-009",
    client: "Hôtel du Pont Vieux",
    clientId: "cli-pont-vieux",
    type: "acompte",
    montantTTC: 1500,
    statut: "Payé",
  },
  {
    id: "8",
    date: "18/02/2026",
    numero: "AVO-2026-003",
    client: "Garage Delmas",
    clientId: "cli-delmas",
    type: "avoir",
    montantTTC: 320.4,
    statut: "Émis",
  },
  {
    id: "9",
    date: "19/02/2026",
    numero: "RAP-2026-021",
    client: "Camille Rouvier",
    clientId: "cli-rouvier",
    type: "rapport",
    montantTTC: null,
    statut: "Finalisé",
  },
  {
    id: "10",
    date: "20/02/2026",
    numero: "RAP-2026-022",
    client: "Hôtel du Pont Vieux",
    clientId: "cli-pont-vieux",
    type: "rapport",
    montantTTC: null,
    statut: "Finalisé",
  },
];

// ---------------------------------------------------------------------------
// Étape 12 : brouillons de devis sauvegardés en base. Les documents fictifs
// des premières étapes ne sont affichés qu'en mode démonstration (désactivé par défaut).
// ---------------------------------------------------------------------------

export interface DocumentAvecDevis extends DemoDocument {
  /** Présent uniquement pour les brouillons de devis enregistrés. */
  devis?: DevisBrouillon;
  /** Version enregistrée du brouillon. */
  version?: number;
  fictif?: boolean;
  /** Référence provisoire conservée pour la traçabilité (BROUILLON-NNN). */
  referenceProvisoire?: string;
  /** Devis finalisé : horodatage ISO et copie figée de l'entreprise. */
  finaliseLe?: string;
  entrepriseFigee?: Entreprise;
  /** Facture brouillon : devis d'origine (le champ devis.validite porte alors l'échéance). */
  devisSource?: { id: string; reference: string };
  /** Facture d'acompte : pourcentage appliqué au devis source. */
  pourcentage?: number;
  /** Facture ordinaire : acompte du même devis à déduire (figé à la finalisation). */
  deduction?: Deduction;
  /** Facture finalisée : règlements enregistrés et montant à régler (centimes). */
  reglements?: Reglement[];
  aRegler?: bigint;
  /** Avoir : facture d'origine et motif. */
  factureSource?: { id: string; reference: string };
  motif?: string;
  /** Facture : montant TTC crédité par avoirs finalisés (centimes). */
  credite?: bigint;
  /** HT enregistré par le serveur, après déduction d'acompte pour la facture de solde. */
  montantHTCentimes?: bigint;
}

export type StatutDocuments = "inactif" | "chargement" | "pret" | "erreur";
interface EtatDocs { statut: StatutDocuments; brouillons: DocumentAvecDevis[]; demo: boolean; liste: DocumentAvecDevis[] }

const DEMO_MARQUES: DocumentAvecDevis[] = DOCUMENTS_DEMO.map((d) => ({ ...d, id: `demo-${d.id}`, fictif: true }));
let etat: EtatDocs = { statut: "inactif", brouillons: [], demo: false, liste: [] };
const abonnes = new Set<() => void>();
function publier(patch: Partial<EtatDocs>) {
  const n = { ...etat, ...patch };
  n.liste = n.demo ? [...n.brouillons, ...DEMO_MARQUES] : n.brouillons;
  etat = n;
  abonnes.forEach((f) => f());
}
const VIDE: EtatDocs = { statut: "inactif", brouillons: [], demo: false, liste: [] };

export function useEtatDocuments(): EtatDocs {
  const e = useSyncExternalStore(
    (f) => { abonnes.add(f); return () => abonnes.delete(f); },
    () => etat,
    () => VIDE,
  );
  useEffect(() => { if (etat.statut === "inactif") void chargerDocuments(); }, []);
  return e;
}
export function useDocuments(): DocumentAvecDevis[] {
  return useEtatDocuments().liste;
}
export function definirModeDemo(actif: boolean) { publier({ demo: actif }); }

// --- Conversion base <-> application ---------------------------------------

interface LigneBase {
  id: string; position: number; type: "materiel" | "prestation"; article_id: string | null;
  reference: string; designation: string; description: string; unite: string;
  quantite_milliemes: number; prix_ht_centimes: number; taux_tva_milliemes: number;
}
interface DevisBase {
  id: string; reference: string; client_id: string; client_copie: CoordonneesClient;
  objet: string; date_devis: string; date_validite: string | null; remarques: string; notes: string;
  conditions_paiement?: string | undefined; prestation_debut?: string | null | undefined; prestation_fin?: string | null | undefined;
  total_ttc_centimes: number; total_ht_centimes?: number; version: number; statut: "brouillon" | "finalise";
  reference_definitive: string | null; finalise_le: string | null; entreprise_copie: Record<string, unknown> | null; lignes?: LigneBase[]; devis_lignes?: LigneBase[];
}

const echelle = (v: number, dec: number) => {
  const s = String(Math.trunc(v)).padStart(dec + 1, "0");
  const e = s.slice(0, -dec), d = s.slice(-dec).replace(/0+$/, "");
  return d ? `${e},${d}` : e;
};
const prixTexte = (c: number) => `${Math.trunc(c / 100)},${String(c % 100).padStart(2, "0")}`;

function depuisBase(d: DevisBase): DocumentAvecDevis {
  const lignes = [...(d.lignes ?? d.devis_lignes ?? [])].sort((a, b) => a.position - b.position);
  const devis: DevisBrouillon = {
    clientId: d.client_id,
    client: d.client_copie,
    objet: d.objet,
    date: d.date_devis,
    validite: d.date_validite ?? "",
    remarques: d.remarques,
    notes: d.notes,
    conditions: d.conditions_paiement ?? "",
    prestationDebut: d.prestation_debut ?? "",
    prestationFin: d.prestation_fin ?? "",
    lignes: lignes.map((l) => ({
      cle: l.id, articleId: l.article_id, type: l.type, reference: l.reference,
      designation: l.designation, description: l.description, unite: l.unite as DevisBrouillon["lignes"][number]["unite"],
      quantite: echelle(l.quantite_milliemes, 3), prix: prixTexte(l.prix_ht_centimes),
      taux: l.taux_tva_milliemes as TauxTVA,
    })),
  };
  const [a, m, j] = d.date_devis.split("-");
  return {
    id: d.id, date: `${j}/${m}/${a}`, numero: d.reference_definitive ?? d.reference, client: d.client_copie.nom, clientId: d.client_id,
    type: "devis", montantTTC: d.total_ttc_centimes / 100, statut: d.statut === "finalise" ? "Finalisé" : "Brouillon",
    ...(Number.isSafeInteger(d.total_ht_centimes) ? { montantHTCentimes: BigInt(d.total_ht_centimes!) } : {}),
    devis, version: d.version, referenceProvisoire: d.reference,
    ...(d.statut === "finalise" && d.finalise_le && d.entreprise_copie
      ? { finaliseLe: d.finalise_le, entrepriseFigee: depuisLigneEntreprise(d.entreprise_copie as never) }
      : {}),
  };
}

// --- Factures brouillons (étape 14) -----------------------------------------
interface FactureBase {
  id: string; reference: string; client_id: string; client_copie: CoordonneesClient; objet: string;
  date_facture: string; date_echeance: string | null; remarques: string; notes: string; total_ttc_centimes: number; total_ht_centimes?: number;
  conditions_paiement?: string | undefined; prestation_debut?: string | null | undefined; prestation_fin?: string | null | undefined;
  version: number; devis_source_id: string | null; devis_source_reference: string | null;
  nature?: "facture" | "acompte"; pourcentage?: number | string | null;
  statut?: "brouillon" | "finalise"; reference_definitive?: string | null; finalise_le?: string | null; entreprise_copie?: Record<string, unknown> | null; lignes?: LigneBase[]; factures_lignes?: LigneBase[];
  deduction?: unknown; deduction_calc?: unknown; reglements?: ReglementBase[];
}
const acompte_ou = (f: FactureBase) => f.nature === "acompte";
function depuisFacture(f: FactureBase): DocumentAvecDevis {
  const base = depuisBase({
    id: f.id, reference: f.reference, client_id: f.client_id, client_copie: f.client_copie, objet: f.objet,
    date_devis: f.date_facture, date_validite: f.date_echeance, remarques: f.remarques, notes: f.notes,
    conditions_paiement: f.conditions_paiement, prestation_debut: f.prestation_debut, prestation_fin: f.prestation_fin,
    total_ttc_centimes: f.total_ttc_centimes, version: f.version, statut: f.statut ?? "brouillon",
    reference_definitive: f.reference_definitive ?? null, finalise_le: f.finalise_le ?? null, entreprise_copie: f.entreprise_copie ?? null, lignes: f.lignes ?? f.factures_lignes ?? [],
  });
  const deduction = acompte_ou(f) ? undefined : lireDeduction(f.deduction_calc ?? f.deduction);
  const acompte = f.nature === "acompte";
  return {
    ...base, ...(Number.isSafeInteger(f.total_ht_centimes) ? { montantHTCentimes: BigInt(f.total_ht_centimes!) - (!acompte && deduction?.statut === "finalise" ? deduction.ht : 0n) } : {}), ...(deduction ? { deduction } : {}), ...(deduction?.statut === "finalise" ? { montantTTC: (f.total_ttc_centimes - Number(deduction.ttc)) / 100 } : {}), type: acompte ? "acompte" : "facture", ...(f.devis_source_id && f.devis_source_reference ? { devisSource: { id: f.devis_source_id, reference: f.devis_source_reference } } : {}),
    ...(acompte && f.pourcentage != null ? { pourcentage: Number(f.pourcentage) } : {}),
    ...(f.statut === "finalise" ? {
      reglements: (f.reglements ?? []).map(lireReglement).sort((a, b) => a.creeLe.localeCompare(b.creeLe)),
      aRegler: BigInt(f.total_ttc_centimes) - (!acompte && f.deduction ? BigInt((f.deduction as { ttc: number }).ttc) : 0n),
    } : {}),
  };
}

export class DevisNonFinalise extends Error {}

// --- Avoirs brouillons (étape 21) -------------------------------------------
interface AvoirBase {
  id: string; reference: string; facture_source_id: string; facture_source_reference: string; client_id: string;
  client_copie: CoordonneesClient; objet: string; lignes: LigneBase[]; total_ttc_centimes: number; total_ht_centimes?: number; date_avoir: string;
  motif: string; remarques: string; version: number;
  statut?: "brouillon" | "finalise"; reference_definitive?: string | null; finalise_le?: string | null; entreprise_copie?: Record<string, unknown> | null;
}
function depuisAvoir(a: AvoirBase): DocumentAvecDevis {
  const base = depuisBase({
    id: a.id, reference: a.reference, client_id: a.client_id, client_copie: a.client_copie, objet: a.objet,
    date_devis: a.date_avoir, date_validite: null, remarques: a.remarques, notes: "", total_ttc_centimes: a.total_ttc_centimes, ...(a.total_ht_centimes !== undefined ? { total_ht_centimes: a.total_ht_centimes } : {}),
    version: a.version, statut: a.statut ?? "brouillon", reference_definitive: a.reference_definitive ?? null, finalise_le: a.finalise_le ?? null, entreprise_copie: a.entreprise_copie ?? null, lignes: a.lignes,
  });
  return { ...base, type: "avoir", factureSource: { id: a.facture_source_id, reference: a.facture_source_reference }, motif: a.motif };
}
export const avoirDeFacture = (liste: DocumentAvecDevis[], factureId: string) =>
  liste.find((d) => d.type === "avoir" && d.factureSource?.id === factureId);
/** Avoir possible : facture ordinaire finalisée, sans déduction d'acompte. */
export const avoirEligible = (d: DocumentAvecDevis) => d.type === "facture" && d.statut === "Finalisé" && !d.deduction;
export const MSG_AVOIR_ACOMPTE = "Avoir avec acompte : fonctionnalité à venir.";
export class AvoirRefuse extends Error {}
const MSG_AVOIR: Record<string, string> = {
  avoir_acompte_a_venir: MSG_AVOIR_ACOMPTE,
  motif_requis: "Le motif est obligatoire.",
  avoir_finalise: "Cet avoir est finalisé : il ne peut plus être modifié.",
  avoir_deja_finalise: "Un avoir est déjà finalisé pour cette facture.",
  montants_incoherents: "Les montants de l'avoir ne correspondent plus à la facture d'origine.",
  fiche_entreprise: "Enregistrez la fiche Entreprise avant de finaliser.",
  avoir_facture_non_finalisee: "Un avoir ne peut être préparé que sur une facture finalisée.",
};
const erreurAvoir = (m: string) => new AvoirRefuse(Object.entries(MSG_AVOIR).find(([k]) => m.includes(k))?.[1] ?? "L'opération n'a pas abouti. Vous pouvez réessayer sans risque de doublon.");

/** Prépare (ou retrouve) l'avoir total brouillon d'une facture. Idempotent côté serveur. */
export async function preparerAvoir(factureId: string, motif: string): Promise<DocumentAvecDevis> {
  const { data, error } = await supabase.rpc("preparer_avoir", { p_facture_id: factureId, p_motif: motif });
  if (error) throw erreurAvoir(error.message);
  const doc = depuisAvoir(data as unknown as AvoirBase);
  conserver(doc);
  return doc;
}
/** Finalise l'avoir (idempotent : une nouvelle tentative renvoie le même numéro). */
export async function finaliserAvoir(id: string, version: number): Promise<DocumentAvecDevis> {
  const { data, error } = await supabase.rpc("finaliser_avoir", { p_id: id, p_version: version });
  if (error) {
    if (error.code === "PT409" || error.message.includes("conflit_version")) throw new ConflitDevis();
    throw erreurAvoir(error.message);
  }
  const doc = depuisAvoir(data as unknown as AvoirBase);
  conserver(doc);
  await chargerDocuments();
  return doc;
}
export async function enregistrerAvoir(id: string, version: number, v: { date: string; motif: string; remarques: string }): Promise<DocumentAvecDevis> {
  const { data, error } = await supabase.rpc("enregistrer_avoir", { p_id: id, p_version: version, p: { date_avoir: v.date, motif: v.motif, remarques: v.remarques } });
  if (error) {
    if (error.code === "PT409" || error.message.includes("conflit_version")) throw new ConflitDevis();
    throw erreurAvoir(error.message);
  }
  const doc = depuisAvoir(data as unknown as AvoirBase);
  conserver(doc);
  return doc;
}

/** Prépare (ou retrouve) la facture brouillon d'un devis finalisé. Idempotent côté serveur. */
export async function preparerFacture(devisId: string): Promise<DocumentAvecDevis> {
  const { data, error } = await supabase.rpc("preparer_facture", { p_devis_id: devisId });
  if (error) {
    if (error.message.includes("devis_non_finalise")) throw new DevisNonFinalise();
    throw new ErreurDevis(error.message);
  }
  const doc = depuisFacture(data as unknown as FactureBase);
  conserver(doc);
  return doc;
}

/** Facture brouillon liée à un devis, si elle est déjà chargée. */
export const factureDuDevis = (liste: DocumentAvecDevis[], devisId: string) =>
  liste.find((d) => d.type === "facture" && d.devisSource?.id === devisId);

/** Acompte lié à un devis, s'il est déjà chargé. */
export const acompteDuDevis = (liste: DocumentAvecDevis[], devisId: string) =>
  liste.find((d) => d.type === "acompte" && d.devisSource?.id === devisId);

export interface PartAcompte { taux: number; base_devis: number; ht: number; tva: number; ttc: number }
export class AcompteRefuse extends Error { constructor(public code: string) { super(code); } }
const codeAcompte = (m: string) =>
  ["pourcentage_invalide", "acompte_nul", "facture_deja_finalisee", "devis_non_finalise", "conflit_version"].find((c) => m.includes(c)) ?? "erreur";

/** Pourcentage saisi (« 30 », « 12,5 ») → texte décimal à 2 décimales max, ou null si invalide. */
export function analyserPourcentage(saisie: string): string | null {
  const t = saisie.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n < 100 ? t : null;
}

/** Calcul serveur (même fonction que l'enregistrement) : bases et TVA par taux. */
export async function calculerAcompte(devisId: string, pourcentage: string): Promise<PartAcompte[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("acompte_calcul", { p_devis_id: devisId, p_pourcentage: pourcentage });
  if (error) throw new AcompteRefuse(codeAcompte(error.message));
  return (data as PartAcompte[]).filter((x) => x.ht > 0);
}

/** Prépare (ou retrouve) l'acompte brouillon d'un devis finalisé. Idempotent côté serveur. */
export async function preparerAcompte(devisId: string, pourcentage: string): Promise<DocumentAvecDevis> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("preparer_acompte", { p_devis_id: devisId, p_pourcentage: pourcentage });
  if (error) throw new AcompteRefuse(codeAcompte(error.message));
  const doc = depuisFacture(data as FactureBase);
  conserver(doc);
  return doc;
}

export async function enregistrerAcompte(
  id: string, version: number, v: { pourcentage: string; date: string; echeance: string; remarques: string; notes: string; conditions?: string },
): Promise<DocumentAvecDevis> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("enregistrer_acompte", {
    p_id: id, p_version: version,
    p: { pourcentage: v.pourcentage, date_facture: v.date, date_echeance: v.echeance, remarques: v.remarques, notes: v.notes, conditions_paiement: v.conditions ?? "" },
  });
  if (error) {
    if (error.code === "PT409" || error.message.includes("conflit_version")) throw new ConflitDevis();
    throw new AcompteRefuse(codeAcompte(error.message));
  }
  const doc = depuisFacture(data as FactureBase);
  conserver(doc);
  return doc;
}

export async function enregistrerFacture(id: string, v: DevisBrouillon, version: number): Promise<DocumentAvecDevis> {
  const lignes = versLignes(v);
  const { data, error } = await supabase.rpc("enregistrer_facture", {
    p_id: id, p_version: version,
    p: { objet: v.objet.trim(), date_facture: v.date, date_echeance: v.validite, remarques: v.remarques, notes: v.notes, conditions_paiement: v.conditions ?? "", prestation_debut: v.prestationDebut ?? "", prestation_fin: v.prestationFin ?? "", lignes } as unknown as Json,
  });
  if (error) {
    if (error.code === "PT409" || error.message.includes("conflit_version")) throw new ConflitDevis();
    throw new ErreurDevis(error.message);
  }
  const doc = depuisFacture(data as unknown as FactureBase);
  conserver(doc);
  return doc;
}

export async function factureDirecteDisponible(): Promise<boolean> {
  const rpc = supabase as unknown as { rpc: (nom: string) => Promise<{ data: unknown; error: { code?: string } | null }> };
  const { data, error } = await rpc.rpc("facture_directe_disponible");
  if (error?.code === "PGRST202") return false;
  if (error) throw new ErreurDevis("Impossible de vérifier la création directe. Réessayez lorsque la connexion est rétablie.");
  return data === true;
}

export async function creerFactureDirecte(id: string, v: DevisBrouillon): Promise<DocumentAvecDevis> {
  const rpc = supabase as unknown as { rpc: (nom: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }> };
  const { data, error } = await rpc.rpc("enregistrer_facture_directe", { p_id: id, p: {
    client_id: v.clientId, objet: v.objet.trim(), date_facture: v.date, date_echeance: v.validite,
    remarques: v.remarques, notes: v.notes, conditions_paiement: v.conditions ?? "",
    prestation_debut: v.prestationDebut ?? "", prestation_fin: v.prestationFin ?? "", lignes: versLignes(v),
  } });
  if (error) throw new ErreurDevis(error.code === "PGRST202" ? "La création sans devis nécessite l’installation de la migration Factures directes dans Lovable TEST. Votre saisie reste affichée." : "La facture n’a pas été confirmée. Votre saisie est conservée ; réessayez avec cette même tentative.");
  const doc = depuisFacture(data as FactureBase); conserver(doc); return doc;
}

const PAGE = 500;
export async function chargerDocuments(): Promise<void> {
  publier({ statut: "chargement" });
  const tous: DocumentAvecDevis[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase.from("factures").select("*, deduction_calc:deduction_live, factures_lignes(*), reglements(*)")
      .order("created_at", { ascending: false }).order("id").range(debut, debut + PAGE - 1);
    if (error) { publier({ statut: "erreur" }); return; }
    tous.push(...(data as unknown as FactureBase[]).map(depuisFacture));
    if (data.length < PAGE) break;
  }
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase.from("avoirs").select("*")
      .order("created_at", { ascending: false }).order("id").range(debut, debut + PAGE - 1);
    if (error) { publier({ statut: "erreur" }); return; }
    tous.push(...(data as unknown as AvoirBase[]).map(depuisAvoir));
    if (data.length < PAGE) break;
  }
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase.from("devis").select("*, devis_lignes(*)")
      .order("created_at", { ascending: false }).order("id").range(debut, debut + PAGE - 1);
    if (error) { publier({ statut: "erreur" }); return; }
    tous.push(...(data as unknown as DevisBase[]).map(depuisBase));
    if (data.length < PAGE) break;
  }
  // Seuls les avoirs finalisés réduisent le solde de leur facture source.
  const credits = new Map<string, bigint>();
  for (const d of tous) if (d.type === "avoir" && d.statut === "Finalisé" && d.factureSource)
    credits.set(d.factureSource.id, (credits.get(d.factureSource.id) ?? 0n) + BigInt(Math.round(d.montantTTC! * 100)));
  for (const d of tous) if (d.type === "facture" || d.type === "acompte") d.credite = credits.get(d.id) ?? 0n;
  publier({ statut: "pret", brouillons: tous });
}

export class ConflitDevis extends Error { constructor() { super("Une version plus récente du brouillon existe."); } }
export class ErreurDevis extends Error {}

/**
 * Enregistre un brouillon complet en une seule opération côté base (création si version = null).
 * Les montants sont recalculés par le serveur ; la valeur renvoyée est celle réellement enregistrée.
 */
function versLignes(v: DevisBrouillon) {
  return v.lignes.map((l) => {
    const q = analyserQuantite(l.quantite), p = analyserPrixCentimes(l.prix);
    if (typeof q === "string" || typeof p === "string" || l.taux === null) throw new ErreurDevis("Ligne invalide");
    return {
      id: l.cle, type: l.type, article_id: l.articleId ?? "", reference: l.reference, designation: l.designation.trim(),
      description: l.description, unite: l.unite, quantite_milliemes: q.toString(), prix_ht_centimes: p.toString(),
      taux_tva_milliemes: l.taux,
    };
  });
}

export async function enregistrerBrouillon(id: string, v: DevisBrouillon, version: number | null): Promise<DocumentAvecDevis> {
  const lignes = versLignes(v);
  const charge = {
    client_id: v.clientId, client_copie: v.client, objet: v.objet.trim(), date_devis: v.date,
    date_validite: v.validite, remarques: v.remarques, notes: v.notes, conditions_paiement: v.conditions ?? "", lignes,
  };
  const { data, error } = await supabase.rpc("enregistrer_brouillon", {
    p_id: id, p_version: version as number, p: charge as unknown as Json,
  });
  if (error) {
    if (error.code === "PT409" || error.message.includes("conflit_version")) throw new ConflitDevis();
    throw new ErreurDevis(error.message);
  }
  const doc = depuisBase(data as unknown as DevisBase);
  const autres = etat.brouillons.filter((d) => d.id !== doc.id);
  publier({ brouillons: [doc, ...autres] });
  return doc;
}

export class DevisIncomplet extends Error {
  constructor(public manques: string[]) { super("Informations manquantes"); }
}
export class EtatIncertain extends Error {}
export class FinalisationRefusee extends Error { explication = explicationRefus(this.message); }
export class DeductionAcompteRequise extends Error {}

const conserver = (doc: DocumentAvecDevis) =>
  publier({ brouillons: [doc, ...etat.brouillons.filter((d) => d.id !== doc.id)] });

/** Relit un devis enregistré (état réel côté base). */
export async function relireDevis(id: string): Promise<DocumentAvecDevis | null> {
  const { data, error } = await supabase.rpc("lire_devis", { p_id: id });
  if (error) throw error;
  if (!data) return null;
  const doc = depuisBase(data as unknown as DevisBase);
  conserver(doc);
  return doc;
}

/**
 * Finalise un brouillon (opération unique côté base). Une nouvelle tentative renvoie
 * le même devis finalisé. En cas de réponse incertaine, l'état réel est relu avant de conclure.
 */
export async function finaliserDevis(id: string, version: number): Promise<DocumentAvecDevis> {
  let res;
  try {
    res = await supabase.rpc("finaliser_devis", { p_id: id, p_version: version });
  } catch {
    res = null;
  }
  if (res && !res.error) {
    const doc = depuisBase(res.data as unknown as DevisBase);
    conserver(doc);
    return doc;
  }
  const err = res?.error;
  if (err?.message.startsWith("incomplet:")) throw new DevisIncomplet(err.message.slice(10).split(","));
  if (err && (err.code === "PT409" || err.message.includes("conflit_version"))) throw new ConflitDevis();
  if (err && err.code && err.code !== "PGRST000" && !/fetch|network/i.test(err.message)) throw new FinalisationRefusee(err.message);
  // Réponse perdue ou réseau indisponible : on vérifie l'état enregistré.
  try {
    const doc = await relireDevis(id);
    if (doc?.statut === "Finalisé") return doc;
  } catch {
    throw new EtatIncertain();
  }
  throw new EtatIncertain();
}

/** Relit une facture enregistrée (état réel côté base). */
export async function relireFacture(id: string): Promise<DocumentAvecDevis | null> {
  const { data, error } = await supabase.rpc("lire_facture", { p_id: id });
  if (error) throw error;
  if (!data) return null;
  const doc = depuisFacture(data as unknown as FactureBase);
  conserver(doc);
  return doc;
}

/** Lecture complète pour préparer un message : même lecture SQL pour facture,
 * règlements et avoirs, sans remise à zéro du suivi par une réponse RPC partielle. */
export async function relireFactureAvecSuivi(id: string): Promise<DocumentAvecDevis | null> {
  const {data,error}=await supabase.from("factures")
    .select("*, deduction_calc:deduction_live, factures_lignes(*), reglements(*), avoirs(statut,total_ttc_centimes)").eq("id",id).maybeSingle();
  if(error)throw new ErreurDevis("Impossible de relire la facture et ses règlements. Aucun message n’a été préparé.");
  if(!data)return null;
  const f=data as unknown as FactureBase & {avoirs:{statut:string;total_ttc_centimes:number}[]};
  const doc=depuisFacture(f);
  doc.credite=(f.avoirs ?? []).filter(a=>a.statut==="finalise").reduce((s,a)=>s+BigInt(a.total_ttc_centimes),0n);
  conserver(doc);return doc;
}

/** Finalise une facture brouillon (numéro FAC-LFM attribué par le serveur, idempotent). */
export async function finaliserFacture(id: string, version: number): Promise<DocumentAvecDevis> {
  let res;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res = await (supabase.rpc as any)("finaliser_facture", { p_id: id, p_version: version });
  } catch {
    res = null;
  }
  if (res && !res.error) {
    const doc = depuisFacture(res.data as unknown as FactureBase);
    conserver(doc);
    return doc;
  }
  const err = res?.error as { code?: string; message: string } | undefined;
  if (err?.message.startsWith("incomplet:")) throw new DevisIncomplet(err.message.slice(10).split(","));
  if (err && (err.code === "PT409" || err.message.includes("conflit_version"))) throw new ConflitDevis();
  if (err?.message.includes("acompte_deduction_requise")) throw new DeductionAcompteRequise();
  if (err && err.code && err.code !== "PGRST000" && !/fetch|network/i.test(err.message)) throw new FinalisationRefusee(err.message);
  try {
    const doc = await relireFacture(id);
    if (doc?.statut === "Finalisé") return doc;
  } catch {
    throw new EtatIncertain();
  }
  throw new EtatIncertain();
}

export function reinitialiserDocuments() {
  etat = { ...VIDE };
  abonnes.forEach((f) => f());
}
