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
