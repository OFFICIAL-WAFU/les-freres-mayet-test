import { supabase } from "@/integrations/supabase/client";
import { reinitialiserCatalogue } from "@/data/catalogue";
import { reinitialiserClients } from "@/data/clients";
import { reinitialiserDocuments } from "@/data/documents";
import { reinitialiserEntreprise } from "@/data/entreprise";

/** Efface toutes les données commerciales temporaires gardées en mémoire. */
export function effacerDonneesSession() {
  reinitialiserDocuments();
  reinitialiserClients();
  reinitialiserCatalogue();
  reinitialiserEntreprise();
}

export async function seDeconnecter() {
  effacerDonneesSession();
  await supabase.auth.signOut();
}

/** N'accepte qu'un chemin interne ("/..."), jamais une adresse externe. */
export function destinationSure(v: unknown): string {
  if (typeof v !== "string") return "/";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (/^\/(connexion|mot-de-passe-oublie|reinitialiser-mot-de-passe)\b/.test(v)) return "/";
  return v;
}
