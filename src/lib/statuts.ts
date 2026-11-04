import type { DocumentAvecDevis, DocumentStatut } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { dateParis, suiviEcheance } from "./echeances";
import { dansPeriode, type PeriodeDocuments } from "./suivi-clients";

/** Devis finalisé : signé, refusé, expiré (validité dépassée sans réponse) ou en attente de signature. */
export function etatDevis(d: DocumentAvecDevis, aujourdHui = dateParis()): "brouillon" | "signe" | "refuse" | "expire" | "attente" {
  if (d.statut !== "Finalisé") return "brouillon";
  if (d.reponse?.etat === "accepte") return "signe";
  if (d.reponse?.etat === "refuse") return "refuse";
  const v = d.devis?.validite;
  return v && v < aujourdHui ? "expire" : "attente";
}

/** Facture ou acompte finalisé, annulé par avoir(s) sans aucun règlement compté. */
export function estAnnulee(d: DocumentAvecDevis): boolean {
  if (d.statut !== "Finalisé" || (d.type !== "facture" && d.type !== "acompte") || d.aRegler === undefined) return false;
  const s = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
  return (d.credite ?? 0n) > 0n && s.reste === 0n && s.regle === 0n;
}

/** Statut affiché dans les listes (le statut d'émission « Finalisé » reste celui des données). */
export function statutAffiche(d: DocumentAvecDevis, aujourdHui = dateParis()): DocumentStatut {
  if (d.fictif || d.statut === "Brouillon") return d.statut;
  if (d.type === "devis") {
    const e = etatDevis(d, aujourdHui);
    return e === "signe" ? "Signé" : e === "refuse" ? "Refusé" : e === "expire" ? "Expiré" : "En attente de signature";
  }
  if (d.type === "avoir") return "Émis";
  if ((d.type === "facture" || d.type === "acompte") && d.aRegler !== undefined) {
    const s = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
    if (estAnnulee(d)) return d.type === "facture" ? "Annulée" : "Annulé";
    if (s.reste === 0n) return d.type === "facture" ? "Payée" : "Payé";
    return "En attente de paiement";
  }
  return d.statut;
}

/** TTC facturé avant déduction d'acompte (montant du document). */
const ttcBrut = (d: DocumentAvecDevis) => (d.aRegler ?? 0n) + (d.deduction?.statut === "finalise" ? d.deduction.ttc : 0n);

export interface Synthese {
  devis: { attente: bigint; signe: bigint; refuse: bigint; expire: bigint; nbAttente: number; nbSigne: number; nbRefuse: number; nbExpire: number };
  factures: { attente: bigint; paye: bigint; retard: bigint };
  acomptes: { attente: bigint; paye: bigint; retard: bigint };
  aFacturer: bigint;
  encaisse: bigint;
}

/**
 * Indicateurs de la page d'accueil sur la période choisie, avec les définitions de Khosmos (vérifiées sur l'historique repris) :
 * - devis en attente / expirés / refusés : TTC des devis émis sur la période ; signés : TTC des devis signés sur la période
 *   (date de signature, à défaut date du devis) ;
 * - factures / acomptes : « en attente » et « en retard » = reste à régler des documents émis sur la période (échéance non
 *   dépassée / dépassée) ; « payé » = montant TTC (avant déduction d'acompte) des documents soldés sur la période, à la date
 *   du dernier règlement, plus les règlements partiels de la période ; les documents annulés par avoir sont exclus ;
 * - devis à facturer : TTC des devis signés, émis sur la période, non encore couvert par leurs factures et acomptes ;
 * - encaissé : règlements enregistrés (non annulés) datés de la période.
 */
export function synthese(documents: DocumentAvecDevis[], periode: PeriodeDocuments, aujourdHui = dateParis()): Synthese {
  const r: Synthese = {
    devis: { attente: 0n, signe: 0n, refuse: 0n, expire: 0n, nbAttente: 0, nbSigne: 0, nbRefuse: 0, nbExpire: 0 },
    factures: { attente: 0n, paye: 0n, retard: 0n }, acomptes: { attente: 0n, paye: 0n, retard: 0n }, aFacturer: 0n, encaisse: 0n,
  };
  // Comme Khosmos : une facture émise sur un devis le couvre, même annulée ensuite ; un acompte annulé ne compte pas.
  const factureParDevis = new Map<string, bigint>();
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé" || (d.type !== "facture" && d.type !== "acompte") || !d.devisSource) continue;
    if (d.type === "acompte" && estAnnulee(d)) continue;
    factureParDevis.set(d.devisSource.id, (factureParDevis.get(d.devisSource.id) ?? 0n) + ttcBrut(d));
  }
  const dans = (date: string) => dansPeriode(date, periode, aujourdHui);
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé") continue;
    if (d.type === "devis") {
      const ttc = BigInt(Math.round((d.montantTTC ?? 0) * 100));
      const e = etatDevis(d, aujourdHui);
      if (e === "signe") {
        if (dans(d.reponse?.le ?? d.date)) { r.devis.signe += ttc; r.devis.nbSigne++; }
        const reste = ttc - (factureParDevis.get(d.id) ?? 0n);
        if (reste > 0n && dans(d.date)) r.aFacturer += reste;
        continue;
      }
      if (!dans(d.date)) continue;
      if (e === "refuse") { r.devis.refuse += ttc; r.devis.nbRefuse++; }
      else if (e === "expire") { r.devis.expire += ttc; r.devis.nbExpire++; }
      else if (e === "attente") { r.devis.attente += ttc; r.devis.nbAttente++; }
      continue;
    }
    if ((d.type !== "facture" && d.type !== "acompte") || d.aRegler === undefined || estAnnulee(d)) continue;
    const s = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
    const cible = d.type === "facture" ? r.factures : r.acomptes;
    const actifs = (d.reglements ?? []).filter((x) => !x.annuleLe);
    const dansPer = actifs.filter((x) => dans(x.date)).reduce((t, x) => t + x.montant, 0n);
    r.encaisse += dansPer;
    if (s.reste === 0n) {
      const dernier = actifs.reduce((m, x) => (x.date > m ? x.date : m), "");
      if (dans(dernier || d.date)) cible.paye += ttcBrut(d) - s.credite;
    } else {
      cible.paye += dansPer;
      if (!dans(d.date)) continue;
      if (suiviEcheance(d.devis?.validite, s.reste, aujourdHui).etat === "retard") cible.retard += s.reste;
      else cible.attente += s.reste;
    }
  }
  return r;
}
