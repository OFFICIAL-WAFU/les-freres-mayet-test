import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Détecte seulement la présence de la clé API REXEL côté serveur.
 * La valeur n'est jamais renvoyée au navigateur, ni journalisée.
 * Aucun appel à REXEL n'est effectué : la documentation et l'accès API réels ne sont pas encore établis.
 */
export const statutCleRexel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ cleDetectee: boolean }> => {
    const cle = process.env["REXEL_API_KEY"];
    return { cleDetectee: typeof cle === "string" && cle.trim().length > 0 };
  });
