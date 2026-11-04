// Habitudes des documents (table habitudes_documents) — règles pures. Un champ déjà rempli n'est jamais remplacé.
import type { DevisBrouillon } from "@/data/devis";

export interface Habitudes { validite_devis_jours: number; echeance_facture_jours: number; remarques_devis: string; remarques_facture: string }

export function ajouterJours(iso: string, jours: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + jours));
  return d.toISOString().slice(0, 10);
}

/** Nouveau devis : validité = date + N jours et mentions habituelles, seulement si ces champs sont vides. */
export function appliquerHabitudesDevis(d: DevisBrouillon, h: Habitudes | null): DevisBrouillon {
  if (!h) return d;
  return {
    ...d,
    validite: d.validite || (h.validite_devis_jours > 0 ? ajouterJours(d.date, h.validite_devis_jours) : ""),
    remarques: d.remarques.trim() ? d.remarques : h.remarques_devis,
  };
}

export function validerHabitudes(h: Habitudes): Habitudes {
  const entier = (n: number, max: number, nom: string) => {
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${nom} : nombre de jours entre 0 et ${max}.`);
    return n;
  };
  if (h.remarques_devis.length > 5000 || h.remarques_facture.length > 5000) throw new Error("Mentions trop longues (5 000 caractères au plus).");
  return { validite_devis_jours: entier(h.validite_devis_jours, 365, "Validité des devis"), echeance_facture_jours: entier(h.echeance_facture_jours, 120, "Échéance des factures"),
    remarques_devis: h.remarques_devis, remarques_facture: h.remarques_facture };
}
