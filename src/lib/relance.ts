import { dateParis, suiviEcheance } from "./echeances";

export function preparerRelanceDevis(p: { numero: string; client: string; entreprise: string; objet: string; validite?: string; aujourdHui?: string }) {
  const date = p.validite;
  const valide = !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  const expire = valide && date! < (p.aujourdHui ?? dateParis());
  return {
    sujet: `Suivi de votre devis ${p.numero}`,
    message: `Bonjour ${p.client},\n\nJe reviens vers vous au sujet du devis ${p.numero} concernant « ${p.objet} ».\n\n${expire ? "Sa date de validité est passée. Si votre projet est toujours d’actualité, nous pouvons revoir ensemble le devis et confirmer les conditions et les disponibilités avant votre accord." : "Avez-vous pu en prendre connaissance ? Je reste disponible pour répondre à vos questions et faire le point sur votre projet."}${valide && !expire ? `\n\nLa date de validité indiquée sur ce devis est le ${date!.split("-").reverse().join("/")}.` : ""}\n\nMerci et bonne journée,\n${p.entreprise}`,
  };
}

export function preparerRelance(p: { numero: string; client: string; entreprise: string; reste: bigint; echeance?: string; aujourdHui?: string; acompte?: boolean }) {
  if (p.reste <= 0n) throw new Error("Aucun reste à régler : aucun rappel nécessaire.");
  const suivi = suiviEcheance(p.echeance, p.reste, p.aujourdHui);
  const retard = suivi.etat === "retard";
  const montant = `${p.reste / 100n},${String(p.reste % 100n).padStart(2, "0")} €`;
  const nature = p.acompte ? "facture d’acompte" : "facture";
  const delai = retard ? ` Son échéance était fixée au ${p.echeance!.split("-").reverse().join("/")}.`
    : suivi.etat === "avenir" || suivi.etat === "aujourdhui" ? ` Son échéance est fixée au ${p.echeance!.split("-").reverse().join("/")}.` : "";
  return {
    sujet: `${retard ? "Relance" : "Rappel"} — ${nature} ${p.numero}`,
    message: `Bonjour ${p.client},\n\n${retard ? "Sauf erreur de notre part, " : "À ce jour, "}le reste à régler sur votre ${nature} ${p.numero} est de ${montant}.${delai}\n\n${retard ? "Pourriez-vous nous confirmer la date prévue de votre règlement ?" : "Vous pouvez nous contacter si vous avez besoin d’une précision sur cette facture."}\n\nSi vous avez déjà effectué ce règlement, merci de nous transmettre sa référence afin que nous puissions mettre à jour votre dossier.\n\nMerci et bonne journée,\n${p.entreprise}`,
  };
}
