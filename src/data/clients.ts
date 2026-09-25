import { useSyncExternalStore } from "react";

export type ClientType = "particulier" | "entreprise";

export interface Client {
  id: string;
  type: ClientType;
  prenom: string; // particulier
  nom: string; // particulier : nom ; entreprise : nom du contact
  raisonSociale: string; // entreprise
  telephone: string;
  email: string;
  siret: string;
  tva: string;
  adresse: string;
  complement: string;
  codePostal: string;
  ville: string;
  pays: string;
  notes: string;
}

export type ClientSaisie = Omit<Client, "id">;

export const TYPE_CLIENT_LABELS: Record<ClientType, string> = {
  particulier: "Particulier",
  entreprise: "Entreprise",
};

export function clientVide(type: ClientType): ClientSaisie {
  return {
    type,
    prenom: "",
    nom: "",
    raisonSociale: "",
    telephone: "",
    email: "",
    siret: "",
    tva: "",
    adresse: "",
    complement: "",
    codePostal: "",
    ville: "",
    pays: "France",
    notes: "",
  };
}

export function nomClient(c: Pick<Client, "type" | "prenom" | "nom" | "raisonSociale">): string {
  if (c.type === "entreprise") return c.raisonSociale.trim();
  return [c.prenom.trim(), c.nom.trim()].filter(Boolean).join(" ");
}

export function normaliserNom(n: string): string {
  return n.trim().replace(/\s+/g, " ").toLowerCase();
}

const base = (type: ClientType, v: Partial<ClientSaisie>): ClientSaisie => ({
  ...clientVide(type),
  ...v,
});

const CLIENTS_DEMO: Client[] = [
  {
    id: "cli-rouvier",
    ...base("particulier", {
      prenom: "Camille",
      nom: "Rouvier",
      telephone: "06 12 34 56 78",
      email: "camille.rouvier@example.com",
      adresse: "12 chemin des Aubépines",
      codePostal: "07200",
      ville: "Aubenas",
    }),
  },
  {
    id: "cli-marchetti",
    ...base("particulier", {
      prenom: "Julien",
      nom: "Marchetti",
      telephone: "07 45 88 21 09",
      email: "julien.marchetti@example.com",
      ville: "Privas",
      codePostal: "07000",
      notes: "Premier contact par téléphone, souhaite un devis de climatisation.",
    }),
  },
  {
    id: "cli-vergnaud",
    ...base("entreprise", {
      raisonSociale: "Boulangerie Vergnaud",
      nom: "Paul Vergnaud",
      telephone: "04 75 10 20 30",
      email: "contact@boulangerie-vergnaud.example.com",
      adresse: "3 place de l'Église",
      codePostal: "07200",
      ville: "Aubenas",
    }),
  },
  {
    id: "cli-tilleuls",
    ...base("entreprise", {
      raisonSociale: "Résidence Les Tilleuls",
      nom: "Mme Garnier (syndic)",
      telephone: "04 75 44 55 66",
      email: "syndic@tilleuls.example.com",
      adresse: "45 avenue de la Gare",
      codePostal: "07100",
      ville: "Annonay",
    }),
  },
  {
    id: "cli-delmas",
    ...base("entreprise", {
      raisonSociale: "Garage Delmas",
      nom: "Éric Delmas",
      telephone: "04 75 93 12 12",
      email: "garage.delmas@example.com",
      codePostal: "07400",
      ville: "Le Teil",
    }),
  },
  {
    id: "cli-loriol",
    ...base("entreprise", {
      raisonSociale: "Cabinet Dentaire Loriol",
      telephone: "04 75 61 70 80",
      email: "accueil@cabinet-loriol.example.com",
      codePostal: "26270",
      ville: "Loriol-sur-Drôme",
    }),
  },
  {
    id: "cli-pont-vieux",
    ...base("entreprise", {
      raisonSociale: "Hôtel du Pont Vieux",
      nom: "Sophie Arnaud",
      telephone: "04 75 35 00 11",
      email: "reception@pontvieux.example.com",
      codePostal: "07150",
      ville: "Vallon-Pont-d'Arc",
    }),
  },
];

// Stockage en mémoire pour la session (réinitialisé au rechargement).
let clients: Client[] = CLIENTS_DEMO;
const abonnes = new Set<() => void>();
function notifier() {
  abonnes.forEach((f) => f());
}

export function useClients(): Client[] {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => clients,
    () => CLIENTS_DEMO,
  );
}

let compteur = 0;
export function ajouterClient(saisie: ClientSaisie): Client {
  compteur += 1;
  const nouveau: Client = { ...saisie, id: `cli-nouveau-${Date.now()}-${compteur}` };
  clients = [...clients, nouveau];
  notifier();
  return nouveau;
}

export function modifierClient(id: string, saisie: ClientSaisie): void {
  clients = clients.map((c) => (c.id === id ? { ...saisie, id } : c));
  notifier();
}

export function reinitialiserClients() {
  clients = CLIENTS_DEMO;
  notifier();
}
