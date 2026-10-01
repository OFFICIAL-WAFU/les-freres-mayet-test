import { useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Fiche entreprise du propriétaire connecté. Tous les champs sont du texte. */
export interface Entreprise {
  raisonSociale: string;
  nomCommercial: string;
  activite: string;
  adresse: string;
  complement: string;
  codePostal: string;
  ville: string;
  pays: string;
  telephone: string;
  email: string;
  site: string;
  formeJuridique: string;
  /** Capital normalisé (ex. "10000.50") ou "" si absent. */
  capital: string;
  siret: string;
  tva: string;
  immatriculation: string;
}

export const ENTREPRISE_DEPART: Entreprise = {
  raisonSociale: "Les Frères Mayet",
  nomCommercial: "",
  activite: "Plomberie · Électricité · Climatisation",
  adresse: "",
  complement: "",
  codePostal: "",
  ville: "",
  pays: "France",
  telephone: "",
  email: "",
  site: "",
  formeJuridique: "SARL",
  capital: "",
  siret: "",
  tva: "",
  immatriculation: "",
};

export type ErreursEntreprise = Partial<Record<keyof Entreprise, string>>;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valide et normalise la saisie. Retourne les erreurs, ou la fiche prête à enregistrer. */
export function validerEntreprise(v: Entreprise): { erreurs: ErreursEntreprise; propre?: Entreprise } {
  const e: ErreursEntreprise = {};
  const t = (s: string) => s.trim();
  if (!t(v.raisonSociale)) e.raisonSociale = "Indiquez la raison sociale.";
  if (t(v.email) && !EMAIL_RE.test(t(v.email)))
    e.email = "Cette adresse e-mail n'est pas valide (exemple : contact@example.com).";
  const siret = v.siret.replace(/\s/g, "");
  if (siret && !/^\d{14}$/.test(siret)) e.siret = "Le SIRET doit contenir exactement 14 chiffres.";
  let capital = "";
  const c = t(v.capital).replace(/\s/g, "");
  if (c) {
    if (c.startsWith("-")) e.capital = "Le capital ne peut pas être négatif.";
    else if (!/^\d+([.,]\d{1,2})?$/.test(c))
      e.capital = /^\d+[.,]\d{3,}$/.test(c)
        ? "Deux décimales au maximum."
        : "Saisissez un montant en chiffres (exemple : 10 000 ou 7 500,50).";
    else capital = c.replace(",", ".");
  }
  let site = t(v.site);
  if (site) {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(site)) site = "https://" + site;
    try {
      const u = new URL(site);
      if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes("."))
        throw new Error();
    } catch {
      e.site = "Adresse de site invalide : seuls les liens http:// ou https:// sont acceptés.";
    }
  }
  if (Object.keys(e).length) return { erreurs: e };
  const propre = Object.fromEntries(Object.entries(v).map(([k, s]) => [k, s.trim()])) as unknown as Entreprise;
  return { erreurs: {}, propre: { ...propre, capital, site } };
}

/** "10000.5" → "10 000,50 €" */
export function formaterCapital(c: string): string {
  const [ent, dec = ""] = c.split(".");
  const e = (ent ?? "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${e},${dec.padEnd(2, "0")} €`;
}


type Ligne = Database["public"]["Tables"]["entreprises"]["Row"];
type Insertion = Database["public"]["Tables"]["entreprises"]["Insert"];

export type EtatEntreprise =
  | { statut: "inactif" | "chargement" }
  | { statut: "absente" }
  | { statut: "pret"; fiche: Entreprise; majLe: string }
  | { statut: "erreur" };

let etat: EtatEntreprise = { statut: "inactif" };
const abonnes = new Set<() => void>();
const publier = (e: EtatEntreprise) => { etat = e; abonnes.forEach((f) => f()); };

/** Capital : numeric exact en base, transmis en texte pour éviter tout arrondi. */
function depuisLigne(l: Ligne): Entreprise {
  return {
    raisonSociale: l.raison_sociale, nomCommercial: l.nom_commercial, activite: l.activite,
    adresse: l.adresse, complement: l.complement, codePostal: l.code_postal, ville: l.ville,
    pays: l.pays, telephone: l.telephone, email: l.email, site: l.site,
    formeJuridique: l.forme_juridique,
    capital: l.capital === null || l.capital === undefined ? "" : normaliserCapital(String(l.capital)),
    siret: l.siret, tva: l.tva, immatriculation: l.immatriculation,
  };
}
function normaliserCapital(s: string): string {
  const [e = "0", d = ""] = s.split(".");
  const dec = d.replace(/0+$/, "");
  return dec ? `${e}.${dec}` : e;
}
function versLigne(e: Entreprise): Omit<Insertion, "owner_id"> {
  return {
    raison_sociale: e.raisonSociale, nom_commercial: e.nomCommercial, activite: e.activite,
    adresse: e.adresse, complement: e.complement, code_postal: e.codePostal, ville: e.ville,
    pays: e.pays, telephone: e.telephone, email: e.email, site: e.site,
    forme_juridique: e.formeJuridique,
    // Chaîne transmise telle quelle : PostgreSQL la convertit en numeric exact.
    capital: (e.capital === "" ? null : e.capital) as unknown as number | null,
    siret: e.siret.replace(/\s/g, ""), tva: e.tva, immatriculation: e.immatriculation,
  };
}

export class ConflitEntreprise extends Error {
  constructor() { super("La fiche entreprise a été modifiée ailleurs."); }
}

export async function chargerEntreprise(): Promise<void> {
  publier({ statut: "chargement" });
  const { data, error } = await supabase.from("entreprises").select("*").maybeSingle();
  if (error) { publier({ statut: "erreur" }); return; }
  publier(data ? { statut: "pret", fiche: depuisLigne(data), majLe: data.updated_at } : { statut: "absente" });
}

export function useEtatEntreprise(): EtatEntreprise {
  const e = useSyncExternalStore(
    (f) => { abonnes.add(f); return () => abonnes.delete(f); },
    () => etat,
    () => etat,
  );
  useEffect(() => { if (etat.statut === "inactif") void chargerEntreprise(); }, []);
  return e;
}

/**
 * Crée la fiche (versionLue = null) ou la met à jour si la version lue est toujours la dernière.
 * Unicité par propriétaire garantie en base : une création concurrente échoue en conflit.
 */
export async function enregistrerEntreprise(e: Entreprise, versionLue: string | null): Promise<Entreprise> {
  const valeurs = versLigne(e);
  if (versionLue === null) {
    const { data, error } = await supabase.from("entreprises").insert(valeurs).select("*").single();
    if (error) {
      if (error.code === "23505") {
        // Une fiche existe déjà (autre onglet ou tentative précédente aboutie).
        const { data: ex } = await supabase.from("entreprises").select("*").maybeSingle();
        if (ex) {
          const fiche = depuisLigne(ex);
          if (JSON.stringify(fiche) === JSON.stringify(e)) {
            publier({ statut: "pret", fiche, majLe: ex.updated_at });
            return fiche;
          }
          publier({ statut: "pret", fiche, majLe: ex.updated_at });
        }
        throw new ConflitEntreprise();
      }
      throw error;
    }
    const fiche = depuisLigne(data);
    publier({ statut: "pret", fiche, majLe: data.updated_at });
    return fiche;
  }
  const { data, error } = await supabase.from("entreprises").update(valeurs)
    .eq("updated_at", versionLue).select("*");
  if (error) throw error;
  const ligne = data?.[0];
  if (!ligne) throw new ConflitEntreprise();
  const fiche = depuisLigne(ligne);
  publier({ statut: "pret", fiche, majLe: ligne.updated_at });
  return fiche;
}

export function reinitialiserEntreprise() {
  publier({ statut: "inactif" });
}
