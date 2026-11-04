// Seul accès à habitudes_documents (une ligne par compte, migration 20261104100000).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validerHabitudes, type Habitudes } from "@/lib/habitudes";

const db = supabase as unknown as SupabaseClient;
const COLONNES = "validite_devis_jours,echeance_facture_jours,remarques_devis,remarques_facture";

/** null si aucune habitude n'est enregistrée ou si la table n'est pas installée : rien n'est alors pré-rempli. */
export async function lireHabitudes(): Promise<Habitudes | null> {
  const { data, error } = await db.from("habitudes_documents").select(COLONNES).maybeSingle();
  if (error) return null;
  return (data as Habitudes | null) ?? null;
}

export async function enregistrerHabitudes(h: Habitudes): Promise<Habitudes> {
  const propre = validerHabitudes(h);
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Reconnectez-vous pour enregistrer vos habitudes.");
  const { data, error } = await db.from("habitudes_documents").upsert({ owner_id: u.user.id, ...propre, updated_at: new Date().toISOString() }).select(COLONNES).single();
  if (error) throw new Error("Enregistrement impossible pour le moment.");
  return data as Habitudes;
}
