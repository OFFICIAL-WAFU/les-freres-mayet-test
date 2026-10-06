import type { Recapitulatif, TauxTVA } from "@/data/devis";

/** Acompte déjà facturé à déduire d'une facture ordinaire (montants réels de l'acompte, par taux). */
export interface Deduction {
  acompteId: string;
  reference: string;
  statut: "brouillon" | "finalise";
  parTaux: { taux: TauxTVA; ht: bigint; tva: bigint }[];
  ht: bigint;
  tva: bigint;
  ttc: bigint;
  /** Vrai si la déduction dépasse la base HT ou la TVA disponible pour un taux. */
  depasse: boolean;
}

interface DeductionBase {
  acompte_id: string; reference: string; statut: "brouillon" | "finalise";
  par_taux: { taux: number; ht: number; tva: number }[]; ht: number; tva: number; depasse?: boolean;
}

export function lireDeduction(x: unknown): Deduction | undefined {
  if (!x || typeof x !== "object") return undefined;
  const d = x as DeductionBase;
  const ht = BigInt(d.ht), tva = BigInt(d.tva);
  return {
    acompteId: d.acompte_id, reference: d.reference, statut: d.statut,
    parTaux: d.par_taux.map((p) => ({ taux: p.taux as TauxTVA, ht: BigInt(p.ht), tva: BigInt(p.tva) })),
    ht, tva, ttc: ht + tva, depasse: !!d.depasse,
  };
}

/** Solde par soustraction exacte, taux par taux (la TVA du solde n'est jamais recalculée). */
export function solde(recap: Recapitulatif, d: Deduction) {
  const taux = new Set<TauxTVA>([...recap.parTaux.map((p) => p.taux), ...d.parTaux.map((p) => p.taux)]);
  const parTaux = [...taux].sort((a, b) => a - b).map((t) => {
    const p = recap.parTaux.find((x) => x.taux === t);
    const q = d.parTaux.find((x) => x.taux === t);
    return { taux: t, ht: (p?.base ?? 0n) - (q?.ht ?? 0n), tva: (p?.tva ?? 0n) - (q?.tva ?? 0n) };
  });
  const ht = recap.ht - d.ht, tva = recap.tva - d.tva;
  return { parTaux, ht, tva, ttc: ht + tva };
}

export const MSG_REGLEMENT = "La déduction tient compte de l'acompte facturé. Son règlement sera suivi séparément.";

/** Explications compréhensibles des refus serveur liés aux acomptes. */
export const EXPLICATIONS_REFUS: Record<string, string> = {
  acompte_brouillon: "L'acompte de ce devis est encore en brouillon. Finalisez d'abord l'acompte : sa déduction pourra ensuite être appliquée à cette facture.",
  deduction_depasse: "L'acompte à déduire dépasse le montant HT ou la TVA des prestations pour au moins un taux. Corrigez les lignes de la facture ; aucun montant n'est ajusté automatiquement.",
  acompte_deja_deduit: "Cet acompte a déjà été déduit sur une autre facture finale.",
  deduction_invalide: "La déduction de l'acompte n'a pas pu être vérifiée. Rechargez la facture puis réessayez.",
  facture_deja_finalisee: "La facture finale de ce devis est déjà émise : cet acompte ne peut plus être finalisé, car il ne pourrait plus être déduit.",
};
export function explicationRefus(message: string): string | undefined {
  const k = Object.keys(EXPLICATIONS_REFUS).find((c) => message.includes(c));
  return k ? EXPLICATIONS_REFUS[k] : undefined;
}
