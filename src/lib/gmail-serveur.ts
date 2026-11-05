import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { construireMime, LIMITES_MAIL, versBase64Url, type MailAEnvoyer } from "@/lib/mime";
import { emailValide } from "@/lib/relances-devis";

/**
 * Envoi d'e-mails depuis la boîte Gmail de l'entreprise, par le connecteur Gmail de Lovable (Settings › Integrations › Gmail).
 * Réservé aux utilisateurs connectés (requireSupabaseAuth). Un seul destinataire par envoi, toujours sur clic de l'utilisateur.
 * Les clés du connecteur restent sur le serveur : jamais renvoyées au navigateur, jamais journalisées ; le contenu des mails
 * n'est pas journalisé non plus.
 *
 * Passerelle des connecteurs Lovable : https://connector-gateway.lovable.dev/google_mail/<chemin de l'API Gmail>, avec
 * LOVABLE_API_KEY (Authorization) et GOOGLE_MAIL_API_KEY (X-Connection-Api-Key), fournis par Lovable quand Gmail est connecté.
 * À vérifier lors du branchement : si Lovable expose autrement le connecteur, seul ce fichier change.
 */
const PASSERELLE = "https://connector-gateway.lovable.dev/google_mail";
const cles = () => {
  const lovable = process.env["LOVABLE_API_KEY"]?.trim(), gmail = process.env["GOOGLE_MAIL_API_KEY"]?.trim();
  return lovable && gmail ? { lovable, gmail } : null;
};

export const statutGmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ connecte: boolean }> => ({ connecte: cles() !== null }));

export type SortieGmail = { ok: true; id: string } | { ok: false; raison: "non_connecte" | "refuse" | "service" | "delai" };

export const envoyerMailGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: MailAEnvoyer): MailAEnvoyer => {
    if (!d || typeof d.a !== "string" || !emailValide(d.a)) throw new Error("destinataire_invalide");
    if (typeof d.sujet !== "string" || !d.sujet.trim() || d.sujet.length > LIMITES_MAIL.sujet) throw new Error("sujet_invalide");
    if (typeof d.texte !== "string" || !d.texte.trim() || d.texte.length > LIMITES_MAIL.texte) throw new Error("texte_invalide");
    let pdf: MailAEnvoyer["pdf"];
    if (d.pdf) {
      if (typeof d.pdf.nom !== "string" || typeof d.pdf.base64 !== "string" || d.pdf.base64.length > LIMITES_MAIL.pdfBase64 || !/^[A-Za-z0-9+/=\s]+$/.test(d.pdf.base64)) throw new Error("piece_jointe_invalide");
      pdf = { nom: d.pdf.nom.slice(0, 120), base64: d.pdf.base64 };
    }
    return { a: d.a.trim(), sujet: d.sujet.trim(), texte: d.texte, ...(pdf ? { pdf } : {}) };
  })
  .handler(async ({ data }): Promise<SortieGmail> => {
    const c = cles();
    if (!c) return { ok: false, raison: "non_connecte" };
    const raw = versBase64Url(construireMime(data, `mayet-${crypto.randomUUID()}`));
    try {
      const rep = await fetch(`${PASSERELLE}/gmail/v1/users/me/messages/send`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${c.lovable}`, "x-connection-api-key": c.gmail },
        body: JSON.stringify({ raw }),
        signal: AbortSignal.timeout(30_000),
      });
      if (rep.status === 401 || rep.status === 403) return { ok: false, raison: "refuse" };
      if (!rep.ok) return { ok: false, raison: "service" };
      const j = (await rep.json()) as { id?: string };
      return j.id ? { ok: true, id: j.id } : { ok: false, raison: "service" };
    } catch (e) {
      return { ok: false, raison: e instanceof Error && e.name === "TimeoutError" ? "delai" : "service" };
    }
  });
