import { useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

// ---------------------------------------------------------------------------
// Stockage : base Lovable Cloud (table clients, protégée par propriétaire).
// Le navigateur ne garde qu'une copie de travail, effacée à la déconnexion.
// ---------------------------------------------------------------------------

type Ligne = Database["public"]["Tables"]["clients"]["Row"];

function depuisLigne(l: Ligne): Client {
  return {
    id: l.id,
    type: l.type as ClientType,
    prenom: l.prenom,
    nom: l.type === "entreprise" ? l.nom_contact : l.nom,
    raisonSociale: l.raison_sociale,
    telephone: l.telephone,
    email: l.email,
    siret: l.siret,
    tva: l.tva,
    adresse: l.adresse,
    complement: l.complement,
    codePostal: l.code_postal,
    ville: l.ville,
    pays: l.pays,
    notes: l.notes,
    majLe: l.updated_at,
  };
}

function versLigne(v: ClientSaisie) {
  const t = (x: string) => x.trim();
  const ent = v.type === "entreprise";
  return {
    type: v.type,
    prenom: ent ? "" : t(v.prenom),
    nom: ent ? "" : t(v.nom),
    raison_sociale: ent ? t(v.raisonSociale) : "",
    nom_contact: ent ? t(v.nom) : "",
    telephone: t(v.telephone),
    email: t(v.email),
    siret: ent ? v.siret.replace(/\s/g, "") : "",
    tva: ent ? t(v.tva) : "",
    adresse: t(v.adresse),
    complement: t(v.complement),
    code_postal: t(v.codePostal),
    ville: t(v.ville),
    pays: t(v.pays),
    notes: v.notes,
  };
}

export type EtatClients =
  | { statut: "inactif" | "chargement"; clients: Client[] }
  | { statut: "pret"; clients: Client[] }
  | { statut: "erreur"; clients: Client[] };

const INITIAL: EtatClients = { statut: "inactif", clients: [] };
let etat: EtatClients = INITIAL;
let generation = 0;
const abonnes = new Set<() => void>();
function definir(e: EtatClients) {
  etat = e;
  abonnes.forEach((f) => f());
}

export function useEtatClients(): EtatClients {
  const e = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
    () => INITIAL,
  );
  useEffect(() => {
    if (etat.statut === "inactif") void chargerClients();
  }, []);
  return e;
}

/** Liste des clients enregistrés (vide tant qu'elle n'est pas chargée). */
export function useClients(): Client[] {
  return useEtatClients().clients;
}

const PAGE = 1000;
/** Charge toutes les pages : aucune limite silencieuse. */
export async function chargerClients(): Promise<void> {
  const g = ++generation;
  definir({ statut: "chargement", clients: etat.clients });
  try {
    const tous: Client[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(debut, debut + PAGE - 1);
      if (error) throw error;
      tous.push(...data.map(depuisLigne));
      if (data.length < PAGE) break;
    }
    if (g === generation) definir({ statut: "pret", clients: tous });
  } catch {
    if (g === generation) definir({ statut: "erreur", clients: etat.clients });
  }
}

function remplacer(c: Client) {
  const existe = etat.clients.some((x) => x.id === c.id);
  definir({
    statut: etat.statut === "inactif" ? "pret" : etat.statut,
    clients: existe ? etat.clients.map((x) => (x.id === c.id ? c : x)) : [...etat.clients, c],
  });
}

export class ErreurSauvegarde extends Error {}
export class ConflitVersion extends Error {}

/**
 * Crée une fiche avec un identifiant fourni par l'appelant (stable pour une même
 * tentative) : une nouvelle tentative après une réponse incertaine ne crée pas de doublon.
 */
export async function creerClient(id: string, v: ClientSaisie): Promise<Client> {
  const { data, error } = await supabase.from("clients").insert({ id, ...versLigne(v) }).select().single();
  if (error) {
    if (error.code === "23505") {
      // Déjà enregistrée lors d'une tentative précédente : on relit la fiche.
      const relue = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (relue.data) {
        const c = depuisLigne(relue.data);
        remplacer(c);
        return c;
      }
    }
    throw new ErreurSauvegarde(error.message);
  }
  const c = depuisLigne(data);
  remplacer(c);
  return c;
}

/** Met à jour seulement si la fiche n'a pas changé depuis son ouverture. */
export async function modifierClient(id: string, v: ClientSaisie, versionLue: string): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(versLigne(v))
    .eq("id", id)
    .eq("updated_at", versionLue)
    .select();
  if (error) throw new ErreurSauvegarde(error.message);
  if (!data || data.length === 0) throw new ConflitVersion();
  const c = depuisLigne(data[0]!);
  remplacer(c);
  return c;
}

/** Relit une fiche depuis la base (après un conflit). */
export async function relireClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw new ErreurSauvegarde(error.message);
  if (!data) return null;
  const c = depuisLigne(data);
  remplacer(c);
  return c;
}

/** Déconnexion : efface la copie en mémoire (les fiches restent en base). */
export function reinitialiserClients() {
  generation++;
  definir(INITIAL);
}
