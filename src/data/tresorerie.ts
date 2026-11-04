import { supabase } from "@/integrations/supabase/client";
import { validerTresorerie, type BibliothequeTresorerie } from "@/lib/tresorerie";

async function cleCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder à la trésorerie.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mayet-tresorerie", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("bibliotheques");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Stockage local de la trésorerie indisponible."));
  });
}
const VIDE: BibliothequeTresorerie = { version: 0, charges: [] };

// --- Stockage en base (compte connecté) --------------------------------------
type Rep = { data: unknown; error: { message: string } | null };
const cloud = supabase as unknown as { rpc: (nom: string, args?: Record<string, unknown>) => Promise<Rep> };

function depuisBase(d: unknown): BibliothequeTresorerie {
  const o = d as { version?: unknown; donnees?: { solde?: unknown; charges?: unknown } } | null;
  if (!o || typeof o !== "object" || !o.donnees) throw new Error("Réponse inattendue du serveur : la trésorerie n’est pas confirmée.");
  return validerTresorerie({ version: o.version, charges: o.donnees.charges, ...(o.donnees.solde !== undefined ? { solde: o.donnees.solde } : {}) });
}
const versBase = (b: BibliothequeTresorerie) => ({ charges: b.charges, ...(b.solde ? { solde: b.solde } : {}) });

/** Ancienne bibliothèque enregistrée dans ce navigateur (avant le passage en base), pour la reprendre une fois. */
async function lireLocale(): Promise<BibliothequeTresorerie | null> {
  try {
    const cle = await cleCompte(), db = await ouvrir();
    try {
      return await new Promise((resolve) => {
        const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
        r.onsuccess = () => { try { resolve(r.result ? validerTresorerie(r.result) : null); } catch { resolve(null); } };
        r.onerror = () => resolve(null);
      });
    } finally { db.close(); }
  } catch { return null; }
}

export async function lireTresorerie(): Promise<BibliothequeTresorerie> {
  const { data, error } = await cloud.rpc("lire_tresorerie");
  if (error) throw new Error("La trésorerie n’a pas pu être lue. Vérifiez votre connexion et rechargez la page.");
  if (data) return depuisBase(data);
  // Première ouverture depuis le passage en base : on reprend ce qui était gardé dans ce navigateur.
  const locale = await lireLocale();
  if (locale && (locale.charges.length > 0 || locale.solde)) {
    const { data: d2, error: e2 } = await cloud.rpc("modifier_tresorerie", { p_version: 0, p_donnees: versBase(locale) });
    if (!e2 && d2) return depuisBase(d2);
    if (e2?.message.includes("conflit_version")) { const r = await cloud.rpc("lire_tresorerie"); if (!r.error && r.data) return depuisBase(r.data); }
  }
  return VIDE;
}

/** Modifie la trésorerie ; refuse si un autre onglet l'a modifiée entre-temps, sans rien écrire. */
export async function modifierTresorerie(version: number, appliquer: (b: BibliothequeTresorerie) => BibliothequeTresorerie): Promise<BibliothequeTresorerie> {
  const actuelle = await lireTresorerie();
  if (actuelle.version !== version) throw new Error("La trésorerie a été modifiée dans un autre onglet. Rechargez la page ; rien n’a été enregistré.");
  const suivante = validerTresorerie({ ...appliquer(actuelle), version });
  const { data, error } = await cloud.rpc("modifier_tresorerie", { p_version: version, p_donnees: versBase(suivante) });
  if (error) {
    if (error.message.includes("conflit_version")) throw new Error("La trésorerie a été modifiée dans un autre onglet. Rechargez la page ; rien n’a été enregistré.");
    throw new Error("Enregistrement impossible : vérifiez votre connexion. Les données précédentes sont conservées.");
  }
  return depuisBase(data);
}
