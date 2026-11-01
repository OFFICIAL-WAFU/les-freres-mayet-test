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

export async function lireTresorerie(): Promise<BibliothequeTresorerie> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
      r.onsuccess = () => { try { resolve(r.result ? validerTresorerie(r.result) : VIDE); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error("Lecture de la trésorerie impossible."));
    });
  } finally { db.close(); }
}

/** Modifie la trésorerie ; refuse si un autre onglet l'a modifiée entre-temps, sans rien écrire. */
export async function modifierTresorerie(version: number, appliquer: (b: BibliothequeTresorerie) => BibliothequeTresorerie): Promise<BibliothequeTresorerie> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("bibliotheques", "readwrite"), store = tx.objectStore("bibliotheques"), r = store.get(cle);
      let resultat: BibliothequeTresorerie; let erreur: unknown;
      r.onsuccess = () => {
        try {
          const b = r.result ? validerTresorerie(r.result) : VIDE;
          if (b.version !== version) throw new Error("La trésorerie a été modifiée dans un autre onglet. Rechargez la page ; rien n’a été enregistré.");
          resultat = validerTresorerie({ ...appliquer(b), version: version + 1 });
          store.put(resultat, cle);
        } catch (e) { erreur = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(resultat);
      tx.onabort = () => reject(erreur ?? new Error("Enregistrement interrompu. Les données précédentes sont conservées."));
      tx.onerror = () => { erreur ??= new Error("Enregistrement impossible : stockage indisponible ou plein."); };
    });
  } finally { db.close(); }
}
