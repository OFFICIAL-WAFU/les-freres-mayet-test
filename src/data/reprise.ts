// Seul point d'accès aux tables de la reprise Khosmos : documents_importes (lecture seule), connaissances_metier
// (seul le statut est modifiable ici), modeles_devis (lecture). Les écritures d'import se font en administrateur.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Connaissance, DocumentImporte, ModeleDevis, StatutConnaissance } from "@/lib/reprise";

// Tables créées par la migration 20261103220000 : absentes des types générés tant qu'ils ne sont pas régénérés.
const db = supabase as unknown as SupabaseClient;

export class RepriseIndisponible extends Error {
  constructor() { super("La reprise Khosmos n'est pas installée dans cet environnement."); }
}
function verifier(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") throw new RepriseIndisponible();
  throw new Error("Lecture impossible pour le moment. Réessayez dans un instant.");
}

const COLONNES_DOCS = "id,type,reference,date_document,client_id,client_nom,objet,total_ht_centimes,total_tva_centimes,total_ttc_centimes,statut_source,date_echeance,reference_liee,deja_regle_centimes,lignes,source";

export async function lireDocumentsImportes(clientId?: string): Promise<DocumentImporte[]> {
  let q = db.from("documents_importes").select(COLONNES_DOCS);
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q.order("date_document", { ascending: false }).limit(2000);
  verifier(error);
  return (data ?? []) as DocumentImporte[];
}

export async function lireConnaissances(): Promise<Connaissance[]> {
  const { data, error } = await db.from("connaissances_metier").select("id,categorie,metier,titre,contenu,statut,source,updated_at").order("categorie").order("titre");
  verifier(error);
  return (data ?? []) as Connaissance[];
}

/** Concurrence optimiste : la modification n'aboutit que si la fiche n'a pas changé depuis sa lecture. */
export async function changerStatutConnaissance(c: Connaissance, statut: StatutConnaissance): Promise<Connaissance> {
  const { data, error } = await db.from("connaissances_metier").update({ statut }).eq("id", c.id).eq("updated_at", c.updated_at)
    .select("id,categorie,metier,titre,contenu,statut,source,updated_at");
  verifier(error);
  const ligne = (data ?? [])[0] as Connaissance | undefined;
  if (!ligne) throw new Error("Cette fiche a été modifiée ailleurs. Rechargez la page.");
  return ligne;
}

export async function lireModeles(): Promise<ModeleDevis[]> {
  const { data, error } = await db.from("modeles_devis").select("id,nom,metier,type_travaux,objet,lignes,remarques,conditions_paiement,notes_usage,updated_at").eq("archive", false).order("nom");
  verifier(error);
  return (data ?? []) as ModeleDevis[];
}

export async function lireModele(id: string): Promise<ModeleDevis | null> {
  const { data, error } = await db.from("modeles_devis").select("id,nom,metier,type_travaux,objet,lignes,remarques,conditions_paiement,notes_usage,updated_at").eq("id", id).maybeSingle();
  verifier(error);
  return (data as ModeleDevis | null) ?? null;
}
