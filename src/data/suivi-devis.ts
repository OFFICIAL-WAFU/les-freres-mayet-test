import { supabase } from "@/integrations/supabase/client";
import { dateParis } from "@/lib/echeances";
import { validerSuivis, type BibliothequeSuivis, type SuiviDevis } from "@/lib/suivi-devis";

async function cleCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder au suivi des devis.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mayet-suivi-devis", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("bibliotheques");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Stockage local du suivi des devis indisponible."));
  });
}
const VIDE: BibliothequeSuivis = { version: 0, suivis: {} };

export async function lireSuivisDevis(): Promise<BibliothequeSuivis> {
  const cle = await cleCompte(), db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
      r.onsuccess = () => { try { resolve(r.result ? validerSuivis(r.result, dateParis()) : VIDE); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error("Lecture du suivi des devis impossible."));
    });
  } finally { db.close(); }
}

/** Modifie le suivi d'un devis ; refuse si un autre onglet a modifié la bibliothèque entre-temps. */
export async function modifierSuiviDevis(devisId: string, version: number, appliquer: (ancien: SuiviDevis | undefined, aujourdHui: string) => SuiviDevis): Promise<BibliothequeSuivis> {
  const cle = await cleCompte(), db = await ouvrir(), aujourdHui = dateParis();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("bibliotheques", "readwrite"), store = tx.objectStore("bibliotheques"), r = store.get(cle);
      let resultat: BibliothequeSuivis; let erreur: unknown;
      r.onsuccess = () => {
        try {
          const b = r.result ? validerSuivis(r.result, aujourdHui) : VIDE;
          if (b.version !== version) throw new Error("Le suivi a été modifié dans un autre onglet. Rechargez la page ; rien n’a été enregistré.");
          const suivi = appliquer(b.suivis[devisId], aujourdHui);
          resultat = validerSuivis({ version: version + 1, suivis: { ...b.suivis, [devisId]: suivi } }, aujourdHui);
          store.put(resultat, cle);
        } catch (e) { erreur = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve(resultat);
      tx.onabort = () => reject(erreur ?? new Error("Enregistrement interrompu. Le suivi précédent est conservé."));
      tx.onerror = () => { erreur ??= new Error("Enregistrement impossible : stockage indisponible ou plein."); };
    });
  } finally { db.close(); }
}
