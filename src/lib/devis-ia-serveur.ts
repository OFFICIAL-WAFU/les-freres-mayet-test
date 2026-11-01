import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITES, construirePrompt, type ArticleCompact } from "@/lib/devis-ia";

/**
 * Devis assisté par IA — partie serveur. La clé ANTHROPIC_API_KEY n'est jamais renvoyée au navigateur ni journalisée ;
 * le contenu de la demande n'est pas journalisé. La réponse brute est REVALIDÉE côté écran (src/lib/devis-ia.ts) contre le catalogue réel.
 */
export const statutDevisIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ cleDetectee: boolean }> => {
    const cle = process.env["ANTHROPIC_API_KEY"];
    return { cleDetectee: typeof cle === "string" && cle.trim().length > 0 };
  });

type Entree = { demande: string; catalogue: ArticleCompact[] };
export type SortieIA = { ok: true; texte: string } | { ok: false; raison: "cle_absente" | "service" | "delai" | "reponse_vide" };

export const proposerDevisIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Entree): Entree => {
    if (!d || typeof d.demande !== "string") throw new Error("demande_invalide");
    const demande = d.demande.trim();
    if (demande.length < 10 || demande.length > LIMITES.demande) throw new Error("demande_invalide");
    if (!Array.isArray(d.catalogue) || d.catalogue.length > LIMITES.catalogue) throw new Error("catalogue_invalide");
    const catalogue = d.catalogue.map((a) => ({ id: String(a.id).slice(0, 64), ref: String(a.ref).slice(0, 64), d: String(a.d).slice(0, 120), u: String(a.u).slice(0, 12), p: Number(a.p) || 0, t: String(a.t).slice(0, 12) }));
    return { demande, catalogue };
  })
  .handler(async ({ data }): Promise<SortieIA> => {
    const cle = process.env["ANTHROPIC_API_KEY"]?.trim();
    if (!cle) return { ok: false, raison: "cle_absente" };
    const { system, user } = construirePrompt(data.demande, data.catalogue);
    try {
      const rep = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env["DEVIS_IA_MODELE"]?.trim() || "claude-sonnet-5-5", max_tokens: 3000, system, messages: [{ role: "user", content: user }] }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!rep.ok) return { ok: false, raison: "service" };
      const j = (await rep.json()) as { content?: { type: string; text?: string }[] };
      const texte = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
      return texte ? { ok: true, texte } : { ok: false, raison: "reponse_vide" };
    } catch (e) {
      return { ok: false, raison: e instanceof Error && e.name === "TimeoutError" ? "delai" : "service" };
    }
  });
