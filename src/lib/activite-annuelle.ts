import type { DocumentAvecDevis } from "@/data/documents";
import { rentabilite, REGLAGES_DEFAUT } from "./rentabilite";
import { dateDocumentIso } from "./suivi-clients";
import { dateParis } from "./echeances";
import { ttcBrut, type ModeMontant } from "./montants";

/**
 * Chiffre d'affaires HT par mois d'émission (même calcul que Khosmos) : factures finalisées pour leur montant HT
 * complet (acompte compris), moins les avoirs émis sur ces factures. Les factures d'acompte n'entrent pas dans
 * le chiffre d'affaires : elles sont comptées avec la facture de solde. Aucun paiement n'est pris en compte.
 * En mode TTC, mêmes documents à leur montant TTC complet.
 */
export function activiteAnnuelle(documents: DocumentAvecDevis[], aujourdHui = dateParis(), mode: ModeMontant = "ht") {
  const annee = aujourdHui.slice(0, 4);
  const mois = Array<bigint>(12).fill(0n);
  const detail: { doc: DocumentAvecDevis; montant: bigint }[][] = Array.from({ length: 12 }, () => []);
  let incomplets = 0;
  const natureSource = new Map(documents.filter(d => d.type === "facture" || d.type === "acompte").map(d => [d.id, d.type]));
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé") continue;
    if (d.type === "avoir" && natureSource.get(d.factureSource?.id ?? "") !== "facture") continue;
    if (d.type !== "facture" && d.type !== "avoir") continue;
    const date = dateDocumentIso(d.date);
    if (!date) { incomplets++; continue; }
    if (!date.startsWith(annee) || date > aujourdHui) continue;
    if (d.montantHTCentimes === undefined) { incomplets++; continue; }
    const ht = mode === "ttc" ? ttcBrut(d)
      : d.type === "facture" && d.deduction?.statut === "finalise" ? d.montantHTCentimes + d.deduction.ht : d.montantHTCentimes;
    const index = Number(date.slice(5,7)) - 1;
    mois[index] = mois[index]! + (d.type === "avoir" ? -ht : ht);
    detail[index]!.push({ doc: d, montant: d.type === "avoir" ? -ht : ht });
  }
  return { annee, mois, detail, total: mois.reduce((s,v) => s+v,0n), incomplets };
}

/**
 * Marge HT par mois d'émission, pour les factures finalisées dont le devis d'origine porte des coûts
 * (prix d'achat et/ou temps de pose). La marge d'une facture de solde est celle de son devis complet,
 * comme le chiffre d'affaires (l'acompte est compté avec la facture de solde). Les avoirs ne sont pas déduits
 * de la marge : ils sont signalés par la couverture. Aucune donnée inventée : une ligne sans coût n'a pas de marge.
 */
export function margeAnnuelle(documents: DocumentAvecDevis[], aujourdHui = dateParis()) {
  const annee = aujourdHui.slice(0, 4);
  const marge = Array<bigint>(12).fill(0n);
  const ventes = Array<bigint>(12).fill(0n); // vente HT des lignes dont le coût est connu
  const sansCout = Array<bigint>(12).fill(0n); // HT des lignes sans coût renseigné
  const devisParId = new Map(documents.filter(d => d.type === "devis" && d.devis).map(d => [d.id, d.devis!]));
  for (const d of documents) {
    if (d.fictif || d.statut !== "Finalisé" || d.type !== "facture") continue;
    const date = dateDocumentIso(d.date);
    if (!date || !date.startsWith(annee) || date > aujourdHui) continue;
    const source = d.devisSource ? devisParId.get(d.devisSource.id) : undefined;
    const i = Number(date.slice(5, 7)) - 1;
    if (!source) { sansCout[i] = sansCout[i]! + (d.montantHTCentimes ?? 0n); continue; }
    const r = rentabilite(source.lignes, REGLAGES_DEFAUT);
    marge[i] = marge[i]! + r.marge; ventes[i] = ventes[i]! + r.vente; sansCout[i] = sansCout[i]! + r.htSansCout;
  }
  const somme = (t: bigint[]) => t.reduce((s, v) => s + v, 0n);
  const totalMarge = somme(marge), totalVentes = somme(ventes), totalSansCout = somme(sansCout);
  const base = totalVentes + totalSansCout;
  return { marge, ventes, totalMarge, totalVentes, totalSansCout,
    /** Part (0–100) du chiffre d'affaires dont le coût est connu. */
    couverture: base > 0n ? Number((totalVentes * 100n) / base) : 0 };
}
