import { supabase } from "@/integrations/supabase/client";

export type ModeReglement = "virement" | "cheque" | "especes" | "carte" | "autre";
export const MODES_REGLEMENT: Record<ModeReglement, string> = {
  virement: "Virement", cheque: "Chèque", especes: "Espèces", carte: "Carte", autre: "Autre",
};

export interface Reglement {
  id: string; montant: bigint; date: string; mode: ModeReglement; commentaire: string;
  creeLe: string; annuleLe: string | null; motifAnnulation: string | null;
}
export interface ReglementBase {
  id: string; montant_centimes: number; date_reglement: string; mode: ModeReglement; commentaire: string;
  created_at: string; annule_le: string | null; motif_annulation: string | null;
}
export const lireReglement = (r: ReglementBase): Reglement => ({
  id: r.id, montant: BigInt(r.montant_centimes), date: r.date_reglement, mode: r.mode, commentaire: r.commentaire,
  creeLe: r.created_at, annuleLe: r.annule_le, motifAnnulation: r.motif_annulation,
});

export interface SuiviReglement { aRegler: bigint; regle: bigint; reste: bigint; etat: "Aucun règlement nécessaire" | "Non réglée" | "Partiellement réglée" | "Réglée" }
export function suivre(aRegler: bigint, reglements: Reglement[]): SuiviReglement {
  const regle = reglements.filter((r) => !r.annuleLe).reduce((s, r) => s + r.montant, 0n);
  const reste = aRegler - regle;
  const etat = aRegler <= 0n ? "Aucun règlement nécessaire" : regle === 0n ? "Non réglée" : reste > 0n ? "Partiellement réglée" : "Réglée";
  return { aRegler, regle, reste, etat };
}

/** Montant en euros (« 12,34 ») → centimes ; null si invalide, nul ou plus de deux décimales. */
export function analyserMontant(saisie: string): bigint | null {
  const s = saisie.trim().replace(/\s/g, "").replace(".", ",");
  const m = /^(\d+)(?:,(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const c = BigInt(m[1]) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return c > 0n ? c : null;
}

const MSG: Record<string, string> = {
  reglement_depasse: "Ce montant dépasse le reste à régler. Les trop-perçus ne sont pas encore gérés.",
  facture_non_finalisee: "Aucun règlement ne peut être enregistré sur un brouillon.",
  motif_requis: "Le motif d'annulation est obligatoire.",
  montant_invalide: "Le montant doit être positif.",
};
export class ReglementRefuse extends Error {
  constructor(code: string) { super(Object.entries(MSG).find(([k]) => code.includes(k))?.[1] ?? "L'opération n'a pas été enregistrée. Vous pouvez réessayer sans risque de doublon."); }
}

export async function enregistrerReglement(p: { id: string; factureId: string; montant: bigint; date: string; mode: ModeReglement; commentaire: string }) {
  const { error } = await supabase.rpc("enregistrer_reglement", {
    p_id: p.id, p_facture_id: p.factureId, p_montant: Number(p.montant), p_date: p.date, p_mode: p.mode, p_commentaire: p.commentaire,
  });
  if (error) throw new ReglementRefuse(error.message);
}
export async function annulerReglement(id: string, motif: string) {
  const { error } = await supabase.rpc("annuler_reglement", { p_id: id, p_motif: motif });
  if (error) throw new ReglementRefuse(error.message);
}
