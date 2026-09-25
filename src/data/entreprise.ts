import { useSyncExternalStore } from "react";

/** Fiche entreprise (démonstration, en mémoire). Tous les champs sont du texte. */
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

let entreprise: Entreprise = ENTREPRISE_DEPART;
const abonnes = new Set<() => void>();

export function useEntreprise(): Entreprise {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => entreprise,
    () => ENTREPRISE_DEPART,
  );
}

export function enregistrerEntreprise(e: Entreprise) {
  entreprise = { ...e };
  abonnes.forEach((f) => f());
}

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
