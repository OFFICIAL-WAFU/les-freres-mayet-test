import { createServerFn } from "@tanstack/react-start";
import { envoyerParPasserelle } from "@/lib/gmail-serveur";
import { euros, jetonValide, lireReponseSignature, quantite, type LectureSignature } from "@/lib/signature-distante";
import { emailValide } from "@/lib/relances-devis";

/**
 * Après une signature à distance (décision de Baptiste du 08/11/2026) :
 *  - une alerte part vers l'adresse de l'entreprise (celle figée sur le devis) ;
 *  - une copie récapitulative part vers le client (adresse figée sur le devis), s'il en a une.
 * Appelée sans compte depuis la page /signer/$jeton. Garde-fous : le serveur relit lui-même le devis avec le jeton
 * (fonction publique lire_devis_pour_signature) et n'envoie QUE si le devis est signé depuis moins de 30 minutes ;
 * destinataires et contenu viennent uniquement de la base, jamais de la requête ; un même jeton n'envoie qu'une fois
 * par instance du serveur. Envoi par le connecteur Gmail (src/lib/gmail-serveur.ts) ; sans connecteur, rien ne part.
 * Aucun contenu n'est journalisé.
 */
const FENETRE_MS = 30 * 60 * 1000;
const dejaEnvoyes = new Map<string, number>();

async function relire(jeton: string): Promise<LectureSignature | null> {
  const url = (process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"])?.replace(/\/+$/, "");
  const cle = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !cle) return null;
  const rep = await fetch(`${url}/rest/v1/rpc/lire_devis_pour_signature`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: cle, ...(cle.startsWith("sb_") ? {} : { authorization: `Bearer ${cle}` }) },
    body: JSON.stringify({ p_jeton: jeton }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!rep.ok) return null;
  return lireReponseSignature(await rep.json());
}

const frHeure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

export type SortieNotification = { alerte: boolean; copieClient: boolean; emailClient: string };

export const notifierSignature = createServerFn({ method: "POST" })
  .inputValidator((d: { jeton: string }) => {
    if (!d || !jetonValide(d.jeton)) throw new Error("lien_invalide");
    return { jeton: d.jeton };
  })
  .handler(async ({ data }): Promise<SortieNotification> => {
    const rien: SortieNotification = { alerte: false, copieClient: false, emailClient: "" };
    const maintenant = Date.now();
    for (const [k, t] of dejaEnvoyes) if (maintenant - t > FENETRE_MS) dejaEnvoyes.delete(k);
    if (dejaEnvoyes.has(data.jeton)) return rien;
    let l: LectureSignature | null;
    try { l = await relire(data.jeton); } catch { return rien; }
    if (!l || l.etat !== "signe" || !l.signe_le) return rien;
    const signeLe = Date.parse(l.signe_le);
    if (!Number.isFinite(signeLe) || maintenant - signeLe > FENETRE_MS) return rien;
    dejaEnvoyes.set(data.jeton, maintenant);

    const d = l.devis, e = d.entreprise;
    const nomEntreprise = e.nom_commercial || e.raison_sociale || "Les Frères Mayet";
    const recap = [
      `Devis n° ${d.reference}${d.objet ? ` — ${d.objet}` : ""}`,
      `Client : ${d.client.nom}`,
      "",
      ...d.lignes.map((x) => `- ${x.designation} : ${quantite(x.quantite_milliemes)} × ${euros(x.prix_ht_centimes)} HT = ${euros(x.ttc_centimes)} TTC`),
      "",
      `Total HT : ${euros(d.total_ht_centimes)}`,
      `TVA : ${euros(d.total_tva_centimes)}`,
      `Total TTC : ${euros(d.total_ttc_centimes)}`,
      "",
      `Signé par ${l.signataire_nom ?? d.client.nom} le ${frHeure(l.signe_le)} (signature électronique simple).`,
      `Empreinte du devis signé (SHA-256) : ${l.empreinte}`,
    ].join("\n");

    const sortie: SortieNotification = { ...rien, emailClient: emailValide(d.client.email) ? d.client.email : "" };
    if (emailValide(e.email)) {
      const r = await envoyerParPasserelle({
        a: e.email,
        sujet: `Devis ${d.reference} signé par ${l.signataire_nom ?? d.client.nom}`,
        texte: `Bonne nouvelle : le devis ${d.reference} vient d'être signé en ligne.\n\n${recap}\n\nPensez à passer la commande du matériel.`,
      });
      sortie.alerte = r.ok;
    }
    if (sortie.emailClient) {
      const r = await envoyerParPasserelle({
        a: sortie.emailClient,
        sujet: `Votre devis ${d.reference} signé - ${nomEntreprise.toUpperCase()}`,
        texte: [
          "Bonjour,",
          "",
          `Nous avons bien reçu votre signature du devis ${d.reference}. Voici votre copie :`,
          "",
          recap,
          "",
          e.cgv.trim() ? "Les conditions générales de vente acceptées lors de la signature figurent ci-dessous.\n" : "",
          "N'hésitez pas à nous contacter pour toute question.",
          "",
          "Merci de votre confiance !",
          "",
          "Cordialement,",
          `L'équipe ${nomEntreprise}${e.telephone ? `\n${e.telephone}` : ""}${e.email ? `\n${e.email}` : ""}`,
          ...(e.cgv.trim() ? ["", "—", "CONDITIONS GÉNÉRALES DE VENTE", "", e.cgv.trim()] : []),
        ].join("\n").slice(0, 20000),
      });
      sortie.copieClient = r.ok;
    }
    return sortie;
  });
