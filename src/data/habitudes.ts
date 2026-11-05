// Seul accès à habitudes_documents (une ligne par compte, migration 20261104100000).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validerHabitudes, type Habitudes } from "@/lib/habitudes";
import { REGLAGES_DEFAUT, type ReglagesChiffrage } from "@/lib/rentabilite";

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

// --- Réglages de chiffrage (migration 20261105200000 : colonnes ajoutées à habitudes_documents) ----------------------
const COLONNES_CHIFFRAGE = "coef_materiel_milliemes,cout_horaire_centimes,taux_horaire_centimes";
type LigneChiffrage = { coef_materiel_milliemes: number; cout_horaire_centimes: number; taux_horaire_centimes: number };
const depuisLigne = (l: LigneChiffrage): ReglagesChiffrage => ({ coefMilliemes: Number(l.coef_materiel_milliemes), coutHoraireCentimes: Number(l.cout_horaire_centimes), tauxHoraireCentimes: Number(l.taux_horaire_centimes) });

/** Valeurs par défaut (1,6 / 25 € / 50 €) si rien n'est enregistré ou si la migration n'est pas installée. */
export async function lireReglagesChiffrage(): Promise<ReglagesChiffrage> {
  const { data, error } = await db.from("habitudes_documents").select(COLONNES_CHIFFRAGE).maybeSingle();
  if (error || !data) return REGLAGES_DEFAUT;
  return depuisLigne(data as LigneChiffrage);
}

export async function enregistrerReglagesChiffrage(r: ReglagesChiffrage): Promise<ReglagesChiffrage> {
  const ok = (n: number, max: number) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  if (!ok(r.coefMilliemes, 100000) || !ok(r.coutHoraireCentimes, 10000000) || !ok(r.tauxHoraireCentimes, 10000000)) throw new Error("Valeurs de chiffrage invalides.");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Reconnectez-vous pour enregistrer vos réglages.");
  const { data, error } = await db.from("habitudes_documents").upsert({ owner_id: u.user.id, coef_materiel_milliemes: r.coefMilliemes,
    cout_horaire_centimes: r.coutHoraireCentimes, taux_horaire_centimes: r.tauxHoraireCentimes, updated_at: new Date().toISOString() }).select(COLONNES_CHIFFRAGE).single();
  if (error) throw new Error(error.message.includes("column") ? "La migration « Rentabilité des devis » n'est pas encore installée." : "Enregistrement impossible pour le moment.");
  return depuisLigne(data as LigneChiffrage);
}
