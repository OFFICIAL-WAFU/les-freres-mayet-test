import { supabase } from "@/integrations/supabase/client";
import { validerPlanning, type BibliothequePlanning } from "@/lib/planning";

async function cleCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder aux planning.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mayet-planning", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("bibliotheques");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Stockage local du planning indisponible."));
  });
}
export const PLANNING_VIDE: BibliothequePlanning = { version: 0, interventions: [] };

export async function lirePlanning(): Promise<BibliothequePlanning> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
      r.onsuccess = () => { try { resolve(r.result ? validerPlanning(r.result) : PLANNING_VIDE); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error("Lecture du planning impossible."));
    });
  } finally { db.close(); }
}

/** Applique une modification ; refuse sans rien écrire si un autre onglet a modifié le planning entre-temps. */
export async function modifierPlanning(version: number, appliquer: (b: BibliothequePlanning) => BibliothequePlanning): Promise<BibliothequePlanning> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("bibliotheques", "readwrite"), store = tx.objectStore("bibliotheques"), r = store.get(cle);
      let resultat: BibliothequePlanning; let erreur: unknown;
      r.onsuccess = () => {
        try {
          const b = r.result ? validerPlanning(r.result) : PLANNING_VIDE;
          if (b.version !== version) throw new Error("Le planning a été modifiés dans un autre onglet. Rechargez la page ; rien n’a été enregistré.");
          resultat = validerPlanning({ ...appliquer(b), version: version + 1 });
          store.put(resultat, cle);
        } catch (e) { erreur = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(resultat);
      tx.onabort = () => reject(erreur ?? new Error("Enregistrement interrompu. Le planning précédent est conservé."));
      tx.onerror = () => { erreur ??= new Error("Enregistrement impossible : stockage indisponible ou plein."); };
    });
  } finally { db.close(); }
}
