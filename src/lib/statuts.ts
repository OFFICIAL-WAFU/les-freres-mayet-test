import type { DocumentAvecDevis, DocumentStatut } from "@/data/documents";
import { suivre } from "@/data/reglements";
import { dateParis, suiviEcheance } from "./echeances";
import { dansPeriode, type PeriodeDocuments } from "./suivi-clients";
import { enMode, ttcBrut, type ModeMontant } from "./montants";

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
    if (e === "signe" && d.reponse?.commandeLe) return "Commande passée";
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
 * En mode HT, chaque montant est converti document par document (proportion HT/TTC du document, voir enMode).
 */
/** Case de la synthèse : chaque montant affiché est la somme de ses documents (voir detailSynthese). */
export type CaseSynthese =
  | "devis.attente" | "devis.signe" | "devis.refuse" | "devis.expire"
  | "factures.attente" | "factures.paye" | "factures.retard"
  | "acomptes.attente" | "acomptes.paye" | "acomptes.retard"
  | "aFacturer" | "encaisse";
export interface ElementSynthese { doc: DocumentAvecDevis; montant: bigint }

/** Documents de chaque case de la synthèse, avec le montant qu'ils y apportent (mêmes règles que synthese). */
export function detailSynthese(documents: DocumentAvecDevis[], periode: PeriodeDocuments, aujourdHui = dateParis(), mode: ModeMontant = "ttc"): Record<CaseSynthese, ElementSynthese[]> {
  const m = (d: DocumentAvecDevis, ttc: bigint) => enMode(d, ttc, mode);
  const r = Object.fromEntries((["devis.attente", "devis.signe", "devis.refuse", "devis.expire", "factures.attente", "factures.paye", "factures.retard",
    "acomptes.attente", "acomptes.paye", "acomptes.retard", "aFacturer", "encaisse"] as const).map((k) => [k, [] as ElementSynthese[]])) as Record<CaseSynthese, ElementSynthese[]>;
  const ajouter = (k: CaseSynthese, doc: DocumentAvecDevis, montant: bigint) => { if (montant !== 0n) r[k].push({ doc, montant }); };
  // Comme Khosmos : une facture émise sur un devis le couvre, même annulée ensuite ; un acompte annulé ne compte pas.
  const factureParDevis = new Map<string, bigint>();
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé" || (d.type !== "facture" && d.type !== "acompte") || !d.devisSource) continue;
    if (d.type === "acompte" && estAnnulee(d)) continue;
    factureParDevis.set(d.devisSource.id, (factureParDevis.get(d.devisSource.id) ?? 0n) + m(d, ttcBrut(d)));
  }
  const dans = (date: string) => dansPeriode(date, periode, aujourdHui);
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé") continue;
    if (d.type === "devis") {
      const ttc = m(d, ttcBrut(d));
      const e = etatDevis(d, aujourdHui);
      if (e === "signe") {
        if (dans(d.reponse?.le ?? d.date)) r["devis.signe"].push({ doc: d, montant: ttc });
        const reste = ttc - (factureParDevis.get(d.id) ?? 0n);
        if (reste > 0n && dans(d.date)) ajouter("aFacturer", d, reste);
        continue;
      }
      if (!dans(d.date)) continue;
      if (e === "refuse" || e === "expire" || e === "attente") r[`devis.${e}`].push({ doc: d, montant: ttc });
      continue;
    }
    if ((d.type !== "facture" && d.type !== "acompte") || d.aRegler === undefined || estAnnulee(d)) continue;
    const s = suivre(d.aRegler, d.reglements ?? [], d.credite ?? 0n);
    const cible = d.type === "facture" ? "factures" : "acomptes";
    const actifs = (d.reglements ?? []).filter((x) => !x.annuleLe);
    const dansPer = actifs.filter((x) => dans(x.date)).reduce((t, x) => t + x.montant, 0n);
    ajouter("encaisse", d, m(d, dansPer));
    if (s.reste === 0n) {
      const dernier = actifs.reduce((mx, x) => (x.date > mx ? x.date : mx), "");
      if (dans(dernier || d.date)) ajouter(`${cible}.paye`, d, m(d, ttcBrut(d) - s.credite));
    } else {
      ajouter(`${cible}.paye`, d, m(d, dansPer));
      if (!dans(d.date)) continue;
      if (suiviEcheance(d.devis?.validite, s.reste, aujourdHui).etat === "retard") ajouter(`${cible}.retard`, d, m(d, s.reste));
      else ajouter(`${cible}.attente`, d, m(d, s.reste));
    }
  }
  return r;
}

export function synthese(documents: DocumentAvecDevis[], periode: PeriodeDocuments, aujourdHui = dateParis(), mode: ModeMontant = "ttc"): Synthese {
  const d = detailSynthese(documents, periode, aujourdHui, mode);
  const t = (k: CaseSynthese) => d[k].reduce((s, e) => s + e.montant, 0n);
  return {
    devis: { attente: t("devis.attente"), signe: t("devis.signe"), refuse: t("devis.refuse"), expire: t("devis.expire"),
      nbAttente: d["devis.attente"].length, nbSigne: d["devis.signe"].length, nbRefuse: d["devis.refuse"].length, nbExpire: d["devis.expire"].length },
    factures: { attente: t("factures.attente"), paye: t("factures.paye"), retard: t("factures.retard") },
    acomptes: { attente: t("acomptes.attente"), paye: t("acomptes.paye"), retard: t("acomptes.retard") },
    aFacturer: t("aFacturer"), encaisse: t("encaisse"),
  };
}
