import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { genererJeton, lienSignature, lireReponseSignature, type LectureSignature } from "@/lib/signature-distante";

type Rep = { data: unknown; error: { code?: string; message: string } | null };
const cloud = supabase as unknown as {
  rpc: (nom: string, args?: Record<string, unknown>) => Promise<Rep>;
  from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => Promise<Rep> }; not: (c: string, op: string, v: null) => Promise<Rep> } };
};
export type LienSignature = { id: string; devis_id: string; cree_le: string; expire_le: string; revoque_le: string | null; signe_le: string | null; signataire_nom: string | null; signature_image: string | null; empreinte_document: string | null };
const COLONNES = "id,devis_id,cree_le,expire_le,revoque_le,signe_le,signataire_nom,signature_image,empreinte_document";
const absent = (e: { code?: string; message: string }) => e.code === "PGRST202" || e.code === "42P01" || e.code === "PGRST205";

/** Crée un lien : le jeton est tiré dans ce navigateur, transmis une fois au serveur (qui n'en garde que l'empreinte) et jamais relisible ensuite. */
export async function creerLienSignature(devisId: string, validiteJours = 30): Promise<{ lien: string; id: string; expireLe: string }> {
  const jeton = genererJeton(n => crypto.getRandomValues(new Uint8Array(n)));
  const { data, error } = await cloud.rpc("creer_lien_signature", { p_devis_id: devisId, p_jeton: jeton, p_validite_jours: validiteJours });
  if (error) {
    if (absent(error)) throw new Error("La signature à distance n’est pas encore installée dans la base. La migration doit d’abord être appliquée.");
    if (error.message.includes("deja_signe")) throw new Error("Ce devis est déjà signé.");
    if (error.message.includes("devis_non_finalise")) throw new Error("Seul un devis finalisé peut être envoyé à la signature.");
    throw new Error("Le lien n’a pas pu être créé. Réessayez.");
  }
  const r = data as { id?: unknown; expire_le?: unknown } | null;
  if (!r || typeof r.id !== "string" || typeof r.expire_le !== "string") throw new Error("Réponse inattendue du serveur : le lien n’a pas été confirmé.");
  return { lien: lienSignature(window.location.origin, jeton), id: r.id, expireLe: r.expire_le };
}
export async function revoquerLienSignature(id: string): Promise<void> {
  const { error } = await cloud.rpc("revoquer_lien_signature", { p_id: id });
  if (error) throw new Error(error.message.includes("signature_figee") ? "Ce lien est déjà signé : il ne peut plus être désactivé." : "Le lien n’a pas pu être désactivé.");
}
/** Liens du devis, les plus récents d'abord. Renvoie null si la fonctionnalité n'est pas installée dans la base. */
export async function lireLiensDevis(devisId: string): Promise<LienSignature[] | null> {
  const { data, error } = await cloud.from("signatures_devis").select(COLONNES).eq("devis_id", devisId).order("cree_le", { ascending: false });
  if (error) { if (absent(error)) return null; throw new Error("Les liens de signature n’ont pas pu être lus."); }
  return (data as LienSignature[]) ?? [];
}
/** Devis signés à distance, pour l'écran de suivi (liste vide si non installé). */
export async function lireDevisSignes(): Promise<Record<string, { signeLe: string; nom: string }>> {
  const { data, error } = await cloud.from("signatures_devis").select("devis_id,signe_le,signataire_nom").not("signe_le", "is", null);
  if (error) { if (absent(error)) return {}; throw new Error("Les signatures n’ont pas pu être lues."); }
  const r: Record<string, { signeLe: string; nom: string }> = {};
  for (const x of (data as { devis_id: string; signe_le: string; signataire_nom: string }[]) ?? []) r[x.devis_id] = { signeLe: x.signe_le, nom: x.signataire_nom };
  return r;
}

// --- Côté client (sans compte) ---
export async function lireDevisPourSignature(jeton: string): Promise<LectureSignature> {
  const { data, error } = await cloud.rpc("lire_devis_pour_signature", { p_jeton: jeton });
  if (error) throw new Error("Le devis n’a pas pu être chargé. Vérifiez votre connexion et rechargez la page.");
  return lireReponseSignature(data);
}
export async function signerDevisDistant(jeton: string, nom: string, image: string, accord: boolean): Promise<{ empreinte: string; signeLe: string }> {
  const { data, error } = await cloud.rpc("signer_devis_distant", { p_jeton: jeton, p_nom: nom, p_image: image, p_accord: accord, p_agent: navigator.userAgent.slice(0, 300) });
  if (error) throw new Error(error.message);
  const r = data as { empreinte?: unknown; signe_le?: unknown } | null;
  if (!r || typeof r.empreinte !== "string" || typeof r.signe_le !== "string") throw new Error("Réponse inattendue du serveur : la signature n’est pas confirmée.");
  return { empreinte: r.empreinte, signeLe: r.signe_le };
}

// --- Devis signés : état partagé pour la liste Documents et la frise du devis ---
type Signes = Record<string, { signeLe: string; nom: string }>;
let signesCache: Signes = {};
const abonnes = new Set<() => void>();
function rechargerSignes() {
  lireDevisSignes().then((r) => { signesCache = r; abonnes.forEach((f) => f()); }).catch(() => { /* on garde l'état précédent */ });
}
/** Devis signés à distance (indexés par identifiant de devis), rechargés à chaque affichage de l'écran. */
export function useDevisSignes(): Signes {
  useEffect(() => { rechargerSignes(); }, []);
  return useSyncExternalStore(
    (f) => { abonnes.add(f); return () => { abonnes.delete(f); }; },
    () => signesCache,
    () => signesCache,
  );
}
