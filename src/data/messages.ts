// Seul accès à la bibliothèque des modèles de messages.
// Depuis la migration 20261106090000 : table messages_modeles (une ligne par compte, version + contrôle de concurrence),
// identique sur tous les appareils. Les modèles enregistrés auparavant sur l'appareil (IndexedDB « mayet-messages »)
// sont recopiés en base à la première lecture, si la base est encore vide ; la copie locale n'est jamais effacée.
// Si la migration n'est pas installée, l'ancien stockage sur l'appareil reste utilisé.
import { supabase } from "@/integrations/supabase/client";
import { fusionnerMessages, validerMessages, validerModele, type BibliothequeMessages, type ModeleMessage, type TypeMessage } from "@/lib/messages";

type Rep = { data: unknown; error: { code?: string; message: string } | null };
const cloud = supabase as unknown as {
  rpc: (nom: string, args?: Record<string, unknown>) => Promise<Rep>;
  from: (t: string) => { select: (c: string) => { maybeSingle: () => Promise<Rep> } };
};
const absent = (e: { code?: string; message: string }) => e.code === "PGRST202" || e.code === "42P01" || e.code === "PGRST205";
const VIDE: BibliothequeMessages = { version: 0, modeles: {} };

// --- Ancien stockage sur l'appareil (lecture pour la reprise, et repli si la migration manque) -------------------------
async function cleCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder à vos messages.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mayet-messages", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("bibliotheques");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Stockage local des messages indisponible."));
  });
}
async function lireLocal(): Promise<BibliothequeMessages> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
      r.onsuccess = () => { try { resolve(r.result ? validerMessages(r.result) : VIDE); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error("Lecture des messages impossible."));
    });
  } finally { db.close(); }
}
async function modifierLocal(version: number, appliquer: (b: BibliothequeMessages) => BibliothequeMessages): Promise<BibliothequeMessages> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("bibliotheques", "readwrite"), store = tx.objectStore("bibliotheques"), r = store.get(cle);
      let resultat: BibliothequeMessages; let erreur: unknown;
      r.onsuccess = () => {
        try {
          const b = r.result ? validerMessages(r.result) : VIDE;
          if (b.version !== version) throw new Error("Les messages ont été modifiés dans un autre onglet. Rechargez la bibliothèque ; votre saisie reste affichée.");
          resultat = validerMessages({ ...appliquer(b), version: version + 1 }); store.put(resultat, cle);
        } catch (e) { erreur = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(resultat);
      tx.onabort = () => reject(erreur ?? new Error("Enregistrement interrompu. Les anciens messages sont conservés."));
      tx.onerror = () => { erreur ??= new Error("Enregistrement impossible : stockage indisponible ou plein."); };
    });
  } finally { db.close(); }
}

// --- Base de données ----------------------------------------------------------------------------------------------
async function ecrireBase(version: number, b: BibliothequeMessages): Promise<BibliothequeMessages> {
  const propre = validerMessages({ ...b, version: 0 });
  const { data, error } = await cloud.rpc("modifier_messages", { p_version: version, p_modeles: propre.modeles });
  if (error) {
    if (error.code === "PT409" || error.message.includes("conflit_version")) throw new Error("Les messages ont été modifiés sur un autre appareil. Rechargez la bibliothèque ; votre saisie reste affichée.");
    throw new Error("Enregistrement des messages impossible pour le moment.");
  }
  return validerMessages(data);
}

/** null si la table n'est pas installée (on reste alors sur l'appareil). */
async function lireBase(): Promise<BibliothequeMessages | null> {
  const { data, error } = await cloud.from("messages_modeles").select("version,modeles").maybeSingle();
  if (error) { if (absent(error)) return null; throw new Error("Lecture des messages impossible."); }
  return data ? validerMessages(data) : VIDE;
}

export async function lireMessages(): Promise<BibliothequeMessages> {
  const base = await lireBase();
  if (base === null) return lireLocal();
  if (base.version > 0) return base;
  // Base vide : reprise unique des modèles enregistrés sur cet appareil.
  const local = await lireLocal().catch(() => VIDE);
  if (Object.keys(local.modeles).length === 0) return base;
  try { return await ecrireBase(0, local); } catch { return (await lireBase()) ?? local; }
}

async function modifier(version: number, appliquer: (b: BibliothequeMessages) => BibliothequeMessages): Promise<BibliothequeMessages> {
  const base = await lireBase();
  if (base === null) return modifierLocal(version, appliquer);
  if (base.version !== version) throw new Error("Les messages ont été modifiés sur un autre appareil. Rechargez la bibliothèque ; votre saisie reste affichée.");
  return ecrireBase(version, appliquer(base));
}

export async function enregistrerMessage(type: TypeMessage, modele: ModeleMessage, version: number) {
  const m = validerModele(modele); return modifier(version, b => ({ ...b, modeles: { ...b.modeles, [type]: m } }));
}
export async function importerMessages(modeles: BibliothequeMessages["modeles"], version: number) { return modifier(version, b => fusionnerMessages(b, modeles)); }
