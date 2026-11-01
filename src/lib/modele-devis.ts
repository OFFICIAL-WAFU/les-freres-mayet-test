import type { DevisBrouillon } from "@/data/devis";
import { dateParis } from "./echeances";

/** Copie de travail indépendante, sans client, date de validité ni notes internes. */
export function devisDepuisModele(source: DevisBrouillon, aujourdHui = dateParis(), cle = () => crypto.randomUUID()): DevisBrouillon {
  return {
    clientId: "", client: { nom: "", telephone: "", email: "", adresse: [] },
    objet: source.objet, date: aujourdHui, validite: "", remarques: source.remarques,
    conditions: source.conditions ?? "", notes: "",
    lignes: source.lignes.map(l => ({ ...l, cle: cle() })),
  };
}
