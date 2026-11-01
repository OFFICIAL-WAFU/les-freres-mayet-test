import { supabase } from "@/integrations/supabase/client";
import { dateParis } from "@/lib/echeances";
import { validerRapports, type BibliothequeRapports } from "@/lib/rapports";

async function cleCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder aux rapports d’intervention.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mayet-rapports", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("bibliotheques");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Stockage local des rapports indisponible."));
  });
}
export const RAPPORTS_VIDES: BibliothequeRapports = { version: 0, prochain: 1, rapports: [] };

export async function lireRapports(): Promise<BibliothequeRapports> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
      r.onsuccess = () => { try { resolve(r.result ? validerRapports(r.result, dateParis()) : RAPPORTS_VIDES); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error("Lecture des rapports impossible."));
    });
  } finally { db.close(); }
}

/** Applique une modification ; refuse sans rien écrire si un autre onglet a modifié les rapports entre-temps. */
export async function modifierRapports(version: number, appliquer: (b: BibliothequeRapports, aujourdHui: string) => BibliothequeRapports): Promise<BibliothequeRapports> {
  const cle = await cleCompte(), db = await ouvrir(), aujourdHui = dateParis();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("bibliotheques", "readwrite"), store = tx.objectStore("bibliotheques"), r = store.get(cle);
      let resultat: BibliothequeRapports; let erreur: unknown;
      r.onsuccess = () => {
        try {
          const b = r.result ? validerRapports(r.result, aujourdHui) : RAPPORTS_VIDES;
          if (b.version !== version) throw new Error("Les rapports ont été modifiés dans un autre onglet. Rechargez la page ; rien n’a été enregistré.");
          resultat = validerRapports({ ...appliquer(b, aujourdHui), version: version + 1 }, aujourdHui);
          store.put(resultat, cle);
        } catch (e) { erreur = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(resultat);
      tx.onabort = () => reject(erreur ?? new Error("Enregistrement interrompu. Les rapports précédents sont conservés."));
      tx.onerror = () => { erreur ??= new Error("Enregistrement impossible : stockage indisponible ou plein."); };
    });
  } finally { db.close(); }
}
