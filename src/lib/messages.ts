export const TYPES_MESSAGES = {
  devis: "Envoi d’un devis", facture: "Envoi d’une facture", acompte: "Envoi d’un acompte", avoir: "Envoi d’un avoir",
  rappelDevis: "Relance d’un devis (1re)", rappelDevis2: "Relance d’un devis (2e)", rappelPaiement: "Rappel de paiement",
} as const;
export type TypeMessage = keyof typeof TYPES_MESSAGES;
export interface ModeleMessage { sujet: string; texte: string }
export interface BibliothequeMessages { version: number; modeles: Partial<Record<TypeMessage, ModeleMessage>> }
export const VARIABLES_MESSAGES = ["client", "numero", "objet", "entreprise", "montant", "reste", "echeance", "lien_signature"] as const;
/** Variables facultatives : si elles sont vides, la ligne qui les contient est retirée du message (ex. pas de lien de signature). */
const FACULTATIVES = ["lien_signature"];
export type ContexteMessage = Record<typeof VARIABLES_MESSAGES[number], string>;
export const MODELES_MESSAGES: Record<TypeMessage, ModeleMessage> = {
  devis: { sujet: "Devis {numero} — {entreprise}", texte: "Bonjour {client},\n\nJe vous transmets le devis {numero} concernant : {objet}.\nPour l’accepter, vous pouvez le signer en ligne : {lien_signature}\nJe reste à votre disposition pour toute question.\n\nCordialement,\n{entreprise}" },
  facture: { sujet: "Facture {numero} — {entreprise}", texte: "Bonjour {client},\n\nJe vous transmets la facture {numero} concernant : {objet}.\nMontant de cette facture : {montant}.\n\nCordialement,\n{entreprise}" },
  acompte: { sujet: "Facture d’acompte {numero} — {entreprise}", texte: "Bonjour {client},\n\nJe vous transmets la facture d’acompte {numero} concernant : {objet}.\nMontant de l’acompte facturé : {montant}.\n\nCordialement,\n{entreprise}" },
  avoir: { sujet: "Avoir {numero} — {entreprise}", texte: "Bonjour {client},\n\nJe vous transmets l’avoir {numero} concernant : {objet}.\nMontant de l’avoir : {montant}.\n\nCordialement,\n{entreprise}" },
  rappelDevis: { sujet: "Suivi de votre devis {numero} — {entreprise}", texte: "Bonjour {client},\n\nJe me permets de revenir vers vous au sujet de notre devis {numero} concernant : {objet}. Vous le trouverez en pièce jointe.\nSi la proposition vous convient, vous pouvez le signer en ligne en quelques secondes : {lien_signature}\n\nJe reste à votre disposition pour toute question ou pour ajuster la proposition.\n\nCordialement,\n{entreprise}" },
  rappelDevis2: { sujet: "Votre devis {numero} — {entreprise}", texte: "Bonjour {client},\n\nJe reviens une dernière fois vers vous concernant notre devis {numero} ({objet}), valable jusqu’au {echeance}. Il est joint à ce message.\nPour l’accepter, il suffit de le signer en ligne : {lien_signature}\n\nN’hésitez pas à m’appeler si vous avez la moindre question.\n\nCordialement,\n{entreprise}" },
  rappelPaiement: { sujet: "Suivi de la facture {numero}", texte: "Bonjour {client},\n\nSelon les règlements enregistrés dans notre application, le reste à régler sur le document {numero} est de {reste}.\nSi vous avez déjà effectué le règlement, merci de nous l’indiquer afin que nous puissions vérifier.\n\nCordialement,\n{entreprise}" },
};
export function validerModele(v: unknown): ModeleMessage {
  if (!v || typeof v !== "object") throw new Error("Modèle de message invalide.");
  const m = v as ModeleMessage;
  if (typeof m.sujet !== "string" || !m.sujet.trim() || m.sujet.length > 200 || /[\r\n]/.test(m.sujet)) throw new Error("L’objet doit contenir de 1 à 200 caractères, sur une seule ligne.");
  if (typeof m.texte !== "string" || !m.texte.trim() || m.texte.length > 10000) throw new Error("Le message doit contenir de 1 à 10 000 caractères.");
  for (const s of [m.sujet, m.texte]) {
    const tokens = s.match(/\{[^{}]*\}/g) ?? [];
    if (tokens.some(t => !(VARIABLES_MESSAGES as readonly string[]).includes(t.slice(1, -1))) || /[{}]/.test(s.replace(/\{[^{}]*\}/g, ""))) throw new Error("Une variable est inconnue ou mal écrite. Utilisez les boutons de variables proposés.");
  }
  return { sujet: m.sujet.trim(), texte: m.texte.trim() };
}
export function validerMessages(v: unknown): BibliothequeMessages {
  if (!v || typeof v !== "object") throw new Error("Bibliothèque de messages invalide.");
  const b = v as BibliothequeMessages;
  if (!Number.isSafeInteger(b.version) || b.version < 0 || !b.modeles || typeof b.modeles !== "object" || Array.isArray(b.modeles)) throw new Error("Bibliothèque de messages invalide.");
  const modeles: BibliothequeMessages["modeles"] = {};
  for (const [type, modele] of Object.entries(b.modeles)) {
    if (!Object.hasOwn(TYPES_MESSAGES, type)) throw new Error("Type de message inconnu.");
    modeles[type as TypeMessage] = validerModele(modele);
  }
  return {version: b.version, modeles};
}
export function rendreMessage(m: ModeleMessage, c: ContexteMessage): ModeleMessage {
  const propre = validerModele(m);
  // Remplacement en une passe : le contenu du client n’est jamais une variable.
  const rendre = (s: string) => s.replace(/\{([^{}]+)\}/g, (_, cle: keyof ContexteMessage) => c[cle] || "Non renseigné");
  // Ligne contenant une variable facultative vide : retirée entière (avant remplacement, pour ne pas toucher au texte du client).
  const sansVides = (s: string) => s.split("\n").filter(l => !FACULTATIVES.some(f => l.includes(`{${f}}`) && !c[f as keyof ContexteMessage])).join("\n");
  return {sujet: rendre(sansVides(propre.sujet)).replace(/[\r\n]+/g, " "), texte: rendre(sansVides(propre.texte))};
}
export function sauvegardeMessages(b: BibliothequeMessages) { return {format: "mayet-messages", schema: 1, modeles: validerMessages(b).modeles}; }
export function lireSauvegardeMessages(v: unknown) {
  if (!v || typeof v !== "object" || (v as {format?:unknown}).format !== "mayet-messages" || (v as {schema?:unknown}).schema !== 1) throw new Error("Choisissez une sauvegarde de messages Les Frères Mayet.");
  return validerMessages({version: 0, modeles: (v as {modeles?:unknown}).modeles}).modeles;
}
export function fusionnerMessages(b: BibliothequeMessages, ajouts: BibliothequeMessages["modeles"]) {
  const existants = validerMessages(b); const nouveaux = validerMessages({version:0, modeles:ajouts});
  const modeles = {...existants.modeles};
  for (const [type, m] of Object.entries(nouveaux.modeles)) {
    const cle = type as TypeMessage;
    if (modeles[cle] && JSON.stringify(modeles[cle]) !== JSON.stringify(m)) throw new Error(`Le modèle « ${TYPES_MESSAGES[cle]} » existe avec un texte différent. Aucun texte n’a été remplacé.`);
    modeles[cle] = m;
  }
  return {...existants, modeles};
}
