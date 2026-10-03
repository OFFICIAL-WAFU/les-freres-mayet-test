import { useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
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
  devis: ["Brouillon", "En attente de signature", "Signé"],
  facture: ["En attente de paiement", "Payée"],
  acompte: ["En attente de paiement", "Payé"],
  avoir: ["Émis"],
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
  total_ttc_centimes: number; version: number; lignes?: LigneBase[]; devis_lignes?: LigneBase[];
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
    lignes: lignes.map((l) => ({
      cle: l.id, articleId: l.article_id, type: l.type, reference: l.reference,
      designation: l.designation, description: l.description, unite: l.unite as DevisBrouillon["lignes"][number]["unite"],
      quantite: echelle(l.quantite_milliemes, 3), prix: prixTexte(l.prix_ht_centimes),
      taux: l.taux_tva_milliemes as TauxTVA,
    })),
  };
  const [a, m, j] = d.date_devis.split("-");
  return {
    id: d.id, date: `${j}/${m}/${a}`, numero: d.reference, client: d.client_copie.nom, clientId: d.client_id,
    type: "devis", montantTTC: d.total_ttc_centimes / 100, statut: "Brouillon", devis, version: d.version,
  };
}

const PAGE = 500;
export async function chargerDocuments(): Promise<void> {
  publier({ statut: "chargement" });
  const tous: DocumentAvecDevis[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await supabase.from("devis").select("*, devis_lignes(*)")
      .order("created_at", { ascending: false }).order("id").range(debut, debut + PAGE - 1);
    if (error) { publier({ statut: "erreur" }); return; }
    tous.push(...(data as unknown as DevisBase[]).map(depuisBase));
    if (data.length < PAGE) break;
  }
  publier({ statut: "pret", brouillons: tous });
}

export class ConflitDevis extends Error { constructor() { super("Une version plus récente du brouillon existe."); } }
export class ErreurDevis extends Error {}

/**
 * Enregistre un brouillon complet en une seule opération côté base (création si version = null).
 * Les montants sont recalculés par le serveur ; la valeur renvoyée est celle réellement enregistrée.
 */
export async function enregistrerBrouillon(id: string, v: DevisBrouillon, version: number | null): Promise<DocumentAvecDevis> {
  const lignes = v.lignes.map((l) => {
    const q = analyserQuantite(l.quantite), p = analyserPrixCentimes(l.prix);
    if (typeof q === "string" || typeof p === "string" || l.taux === null) throw new ErreurDevis("Ligne invalide");
    return {
      id: l.cle, type: l.type, article_id: l.articleId ?? "", reference: l.reference, designation: l.designation.trim(),
      description: l.description, unite: l.unite, quantite_milliemes: q.toString(), prix_ht_centimes: p.toString(),
      taux_tva_milliemes: l.taux,
    };
  });
  const charge = {
    client_id: v.clientId, client_copie: v.client, objet: v.objet.trim(), date_devis: v.date,
    date_validite: v.validite, remarques: v.remarques, notes: v.notes, lignes,
  };
  const { data, error } = await supabase.rpc("enregistrer_brouillon", {
    p_id: id, p_version: version as number, p: charge as unknown as Json,
  });
  if (error) {
    if (error.code === "40001" || error.message.includes("conflit_version")) throw new ConflitDevis();
    throw new ErreurDevis(error.message);
  }
  const doc = depuisBase(data as unknown as DevisBase);
  const autres = etat.brouillons.filter((d) => d.id !== doc.id);
  publier({ brouillons: [doc, ...autres] });
  return doc;
}

export function reinitialiserDocuments() {
  etat = { ...VIDE };
  abonnes.forEach((f) => f());
}
