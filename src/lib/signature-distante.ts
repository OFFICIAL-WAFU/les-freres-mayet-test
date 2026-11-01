/**
 * Signature à distance d'un devis (signature électronique SIMPLE : nom + tracé + « bon pour accord » ; ni avancée ni qualifiée).
 * Fonctions pures : génération du jeton (aléa injecté), lien, validation défensive des réponses du serveur.
 */
export type EtatLien = "ouvert" | "signe" | "revoque" | "expire" | "introuvable";
export type LigneSignature = { position: number; type: string; designation: string; description: string; unite: string; quantite_milliemes: number; prix_ht_centimes: number; taux_tva_milliemes: number; ht_centimes: number; tva_centimes: number; ttc_centimes: number };
export type DevisASigner = {
  reference: string; objet: string; date_devis: string; date_validite: string | null;
  client: { nom: string; adresse: string[] }; entreprise: { raison_sociale: string; nom_commercial: string; adresse: string; code_postal: string; ville: string; telephone: string; email: string; siret: string };
  remarques: string; conditions_paiement: string; total_ht_centimes: number; total_tva_centimes: number; total_ttc_centimes: number;
  lignes: LigneSignature[];
};
export type LectureSignature = { etat: "ouvert" | "signe"; devis: DevisASigner; empreinte: string; signe_le: string | null; signataire_nom: string | null; expire_le: string | null } | { etat: "revoque" | "expire" | "introuvable" };

const JETON = /^[A-Za-z0-9_-]{43,64}$/;
export const jetonValide = (j: unknown): j is string => typeof j === "string" && JETON.test(j);

/** 32 octets aléatoires → 43 caractères base64url, sans remplissage. L'aléa est injecté (crypto.getRandomValues dans le navigateur). */
export function genererJeton(aleatoire: (n: number) => Uint8Array): string {
  const o = aleatoire(32);
  if (!(o instanceof Uint8Array) || o.length !== 32 || o.every(x => x === 0)) throw new Error("Source d’aléa indisponible : lien non créé.");
  let bin = ""; for (const x of o) bin += String.fromCharCode(x);
  const jeton = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (!jetonValide(jeton)) throw new Error("Jeton invalide.");
  return jeton;
}
export function lienSignature(origine: string, jeton: string): string {
  if (!jetonValide(jeton)) throw new Error("Jeton invalide.");
  if (!/^https?:\/\/[^\s/?#]+$/.test(origine)) throw new Error("Adresse du site invalide.");
  return `${origine}/signer/${jeton}`;
}
export function etatLienProprietaire(l: { revoque_le: string | null; signe_le: string | null; expire_le: string }, maintenant: number): "signe" | "revoque" | "expire" | "actif" {
  if (l.signe_le) return "signe"; if (l.revoque_le) return "revoque";
  return Date.parse(l.expire_le) <= maintenant ? "expire" : "actif";
}

const num = (v: unknown, nom: string) => { if (typeof v !== "number" || !Number.isSafeInteger(v)) throw new Error(`Réponse invalide : ${nom}.`); return v; };
const txt = (v: unknown, nom: string, max = 4000) => { if (typeof v !== "string" || v.length > max) throw new Error(`Réponse invalide : ${nom}.`); return v; };
export function lireReponseSignature(v: unknown): LectureSignature {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("Réponse invalide.");
  const etat = o["etat"];
  if (etat === "revoque" || etat === "expire" || etat === "introuvable") return { etat };
  if (etat !== "ouvert" && etat !== "signe") throw new Error("Réponse invalide : état.");
  const d = o["devis"] as Record<string, unknown> | null;
  if (!d || typeof d !== "object") throw new Error("Réponse invalide : devis.");
  const c = (d["client"] ?? {}) as Record<string, unknown>, e = (d["entreprise"] ?? {}) as Record<string, unknown>;
  if (!Array.isArray(d["lignes"]) || d["lignes"].length > 500) throw new Error("Réponse invalide : lignes.");
  const empreinte = txt(o["empreinte"], "empreinte", 64); if (!/^[0-9a-f]{64}$/.test(empreinte)) throw new Error("Réponse invalide : empreinte.");
  return {
    etat, empreinte, signe_le: typeof o["signe_le"] === "string" ? o["signe_le"] : null, signataire_nom: typeof o["signataire_nom"] === "string" ? o["signataire_nom"] : null, expire_le: typeof o["expire_le"] === "string" ? o["expire_le"] : null,
    devis: {
      reference: txt(d["reference"], "référence", 60), objet: txt(d["objet"], "objet", 300), date_devis: txt(d["date_devis"], "date", 10), date_validite: typeof d["date_validite"] === "string" ? d["date_validite"] : null,
      client: { nom: txt(c["nom"] ?? "", "client", 200), adresse: Array.isArray(c["adresse"]) ? c["adresse"].map(x => txt(x, "adresse", 200)) : [] },
      entreprise: { raison_sociale: txt(e["raison_sociale"] ?? "", "entreprise"), nom_commercial: txt(e["nom_commercial"] ?? "", "entreprise"), adresse: txt(e["adresse"] ?? "", "entreprise"), code_postal: txt(e["code_postal"] ?? "", "entreprise"), ville: txt(e["ville"] ?? "", "entreprise"), telephone: txt(e["telephone"] ?? "", "entreprise"), email: txt(e["email"] ?? "", "entreprise"), siret: txt(e["siret"] ?? "", "entreprise") },
      remarques: txt(d["remarques"] ?? "", "remarques"), conditions_paiement: txt(d["conditions_paiement"] ?? "", "conditions"),
      total_ht_centimes: num(d["total_ht_centimes"], "total HT"), total_tva_centimes: num(d["total_tva_centimes"], "total TVA"), total_ttc_centimes: num(d["total_ttc_centimes"], "total TTC"),
      lignes: d["lignes"].map((x: unknown, i: number): LigneSignature => {
        const l = (x ?? {}) as Record<string, unknown>;
        return { position: num(l["position"], `ligne ${i + 1}`), type: txt(l["type"] ?? "", "type", 30), designation: txt(l["designation"] ?? "", "désignation", 400), description: txt(l["description"] ?? "", "description"), unite: txt(l["unite"] ?? "", "unité", 30), quantite_milliemes: num(l["quantite_milliemes"], "quantité"), prix_ht_centimes: num(l["prix_ht_centimes"], "prix"), taux_tva_milliemes: num(l["taux_tva_milliemes"], "taux"), ht_centimes: num(l["ht_centimes"], "HT"), tva_centimes: num(l["tva_centimes"], "TVA"), ttc_centimes: num(l["ttc_centimes"], "TTC") };
      }),
    },
  };
}
export function euros(c: number): string {
  const neg = c < 0, a = Math.abs(c);
  return `${neg ? "−" : ""}${Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${String(a % 100).padStart(2, "0")} €`;
}
export function quantite(m: number): string {
  const e = Math.floor(m / 1000), d = String(m % 1000).padStart(3, "0").replace(/0+$/, "");
  return d ? `${e},${d}` : String(e);
}
export function messageErreurSignature(code: string): string {
  const t = (c: string) => code.includes(c);
  if (t("deja_signe")) return "Ce devis a déjà été signé.";
  if (t("lien_revoque")) return "Ce lien a été désactivé par l’entreprise. Contactez-la pour en obtenir un nouveau.";
  if (t("lien_expire")) return "Ce lien a expiré. Contactez l’entreprise pour en obtenir un nouveau.";
  if (t("lien_invalide")) return "Ce lien n’est pas valide.";
  if (t("accord_requis")) return "Cochez la case « Bon pour accord » pour signer.";
  if (t("nom_invalide")) return "Indiquez votre nom (2 à 80 caractères).";
  if (t("image_invalide")) return "Signature manquante ou illisible : tracez-la dans le cadre.";
  return "La signature n’a pas pu être enregistrée. Rien n’a été modifié : vous pouvez réessayer.";
}
