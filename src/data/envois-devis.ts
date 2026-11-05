// Seul accès au journal des envois et relances de devis (table envois_devis, migration 20261106090000).
// Lecture directe (RLS propriétaire) ; écriture uniquement par la fonction SQL noter_envoi_devis (idempotente).
import { supabase } from "@/integrations/supabase/client";
import type { CanalEnvoi, EnvoiDevis, NatureEnvoi } from "@/lib/relances-devis";

type Rep = { data: unknown; error: { code?: string; message: string } | null };
const cloud = supabase as unknown as {
  rpc: (nom: string, args?: Record<string, unknown>) => Promise<Rep>;
  from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => Promise<Rep> } };
};
const absent = (e: { code?: string; message: string }) => e.code === "PGRST202" || e.code === "42P01" || e.code === "PGRST205";
const COLONNES = "id,devis_id,nature,canal,destinataire,sujet,avec_pdf,avec_lien,le";

/** null si la fonctionnalité n'est pas installée dans la base. */
export async function lireEnvoisDevis(): Promise<EnvoiDevis[] | null> {
  const { data, error } = await cloud.from("envois_devis").select(COLONNES).order("le", { ascending: true });
  if (error) { if (absent(error)) return null; throw new Error("Le suivi des envois n’a pas pu être lu."); }
  return (data as EnvoiDevis[]) ?? [];
}

export async function noterEnvoiDevis(p: { id: string; devisId: string; nature: NatureEnvoi; canal: CanalEnvoi; destinataire: string; sujet: string; avecPdf: boolean; avecLien: boolean }): Promise<EnvoiDevis> {
  const { data, error } = await cloud.rpc("noter_envoi_devis", {
    p_id: p.id, p_devis_id: p.devisId, p_nature: p.nature, p_canal: p.canal, p_destinataire: p.destinataire.slice(0, 320),
    p_sujet: p.sujet.slice(0, 200), p_avec_pdf: p.avecPdf, p_avec_lien: p.avecLien,
  });
  if (error) {
    if (absent(error)) throw new Error("Le suivi des relances n’est pas encore installé dans la base.");
    if (error.message.includes("deja_relance")) throw new Error("Cette relance est déjà notée pour ce devis.");
    if (error.message.includes("devis_non_finalise")) throw new Error("Seul un devis finalisé peut être relancé.");
    throw new Error("L’envoi n’a pas pu être noté. Réessayez : aucun doublon ne sera créé.");
  }
  return data as EnvoiDevis;
}
