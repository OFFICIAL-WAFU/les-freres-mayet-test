// Fabrication d'un e-mail MIME (texte + PDF joint) au format attendu par l'API Gmail (users.messages.send, champ raw).
// Règles pures, testées par verification-relances.mjs. Aucun en-tête ne reprend une saisie sans nettoyage (pas d'injection).

const b64 = (s: string) => {
  const octets = new TextEncoder().encode(s);
  let bin = ""; for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin);
};
/** Découpe en lignes de 76 caractères (RFC 2045). */
const plier = (s: string) => s.replace(/.{1,76}/g, (m) => m + "\r\n").trimEnd();
/** En-tête encodé (RFC 2047) si des caractères non ASCII sont présents ; retours à la ligne supprimés. */
export const enTete = (s: string) => {
  const propre = s.replace(/[\r\n]+/g, " ").trim();
  return /^[\x20-\x7e]*$/.test(propre) ? propre : `=?UTF-8?B?${b64(propre)}?=`;
};
export const nomFichierSur = (n: string) => (n.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "document").slice(0, 120);

export interface MailAEnvoyer { a: string; sujet: string; texte: string; pdf?: { nom: string; base64: string } }

export function construireMime(m: MailAEnvoyer, frontiere: string): string {
  const entetes = [`To: ${m.a.replace(/[\r\n<>",;]/g, "").trim()}`, `Subject: ${enTete(m.sujet)}`, "MIME-Version: 1.0"];
  const corps = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", plier(b64(m.texte.replace(/\r?\n/g, "\r\n")))].join("\r\n");
  if (!m.pdf) return [...entetes, corps].join("\r\n");
  const nom = nomFichierSur(m.pdf.nom);
  return [
    ...entetes, `Content-Type: multipart/mixed; boundary="${frontiere}"`, "",
    `--${frontiere}`, corps, "",
    `--${frontiere}`, `Content-Type: application/pdf; name="${nom}"`, "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${nom}"`, "", plier(m.pdf.base64.replace(/\s+/g, "")), "",
    `--${frontiere}--`, "",
  ].join("\r\n");
}

/** base64url sans remplissage, comme l'exige Gmail pour le champ raw. */
export function versBase64Url(mime: string): string {
  return b64(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const LIMITES_MAIL = { sujet: 200, texte: 20000, pdfBase64: 8_000_000 } as const;
