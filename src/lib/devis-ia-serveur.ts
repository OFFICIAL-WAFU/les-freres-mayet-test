import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIMITES, OUTIL_PROPOSITION, construirePrompt, type ArticleCompact, type Habitude } from "@/lib/devis-ia";
import { LIMITES_CONNAISSANCES_IA } from "@/lib/reprise";

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

type Entree = { demande: string; catalogue: ArticleCompact[]; habitudes?: Habitude[] };
export type SortieIA = { ok: true; texte: string } | { ok: false; raison: "cle_absente" | "service" | "delai" | "reponse_vide" };

export const proposerDevisIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Entree): Entree => {
    if (!d || typeof d.demande !== "string") throw new Error("demande_invalide");
    const demande = d.demande.trim();
    if (demande.length < 10 || demande.length > LIMITES.demande) throw new Error("demande_invalide");
    if (!Array.isArray(d.catalogue) || d.catalogue.length > LIMITES.catalogue) throw new Error("catalogue_invalide");
    const catalogue = d.catalogue.map((a) => ({ id: String(a.id).slice(0, 64), ref: String(a.ref).slice(0, 64), d: String(a.d).slice(0, 120), u: String(a.u).slice(0, 12), p: Number(a.p) || 0, t: String(a.t).slice(0, 12) }));
    const brutes = Array.isArray(d.habitudes) ? d.habitudes.slice(0, LIMITES_CONNAISSANCES_IA.nombre) : [];
    const habitudes = brutes.map((h) => ({ titre: String(h?.titre ?? "").slice(0, 300), contenu: String(h?.contenu ?? "").slice(0, LIMITES_CONNAISSANCES_IA.contenu) })).filter((h) => h.titre && h.contenu);
    return { demande, catalogue, habitudes };
  })
  .handler(async ({ data }): Promise<SortieIA> => {
    const cle = process.env["ANTHROPIC_API_KEY"]?.trim();
    if (!cle) return { ok: false, raison: "cle_absente" };
    const { system, contexte, user } = construirePrompt(data.demande, data.catalogue, data.habitudes ?? []);
    try {
      const rep = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: process.env["DEVIS_IA_MODELE"]?.trim() || "claude-haiku-5-5", // Haiku 5.5 : choix de Baptiste (13/11/2026), coût réduit
          max_tokens: 4000,
          // Consignes + catalogue + habitudes : bloc stable mis en cache (les demandes suivantes coûtent beaucoup moins).
          system: [{ type: "text", text: system }, { type: "text", text: contexte, cache_control: { type: "ephemeral" } }],
          // Réponse imposée sous forme structurée : plus de texte à interpréter.
          tools: [OUTIL_PROPOSITION],
          tool_choice: { type: "tool", name: OUTIL_PROPOSITION.name },
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!rep.ok) return { ok: false, raison: "service" };
      const j = (await rep.json()) as { content?: { type: string; text?: string; name?: string; input?: unknown }[] };
      const outil = (j.content ?? []).find((c) => c.type === "tool_use" && c.name === OUTIL_PROPOSITION.name);
      // Même chemin de contrôle que le texte : l'objet est resérialisé puis revalidé côté écran.
      const texte = outil?.input ? JSON.stringify(outil.input) : (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
      return texte ? { ok: true, texte } : { ok: false, raison: "reponse_vide" };
    } catch (e) {
      return { ok: false, raison: e instanceof Error && e.name === "TimeoutError" ? "delai" : "service" };
    }
  });
