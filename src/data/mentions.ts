import { supabase } from "@/integrations/supabase/client";
import { fusionnerMentions, validerBibliotheque, validerMention, type BibliothequeMentions, type Mention } from "@/lib/mentions";

async function cleCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder à vos mentions.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("mayet-mentions", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("bibliotheques");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Le stockage local est indisponible. Rien n’a été enregistré."));
  });
}
export async function lireMentions(): Promise<BibliothequeMentions> {
  const cle = await cleCompte(); const db = await ouvrir();
  try { return await new Promise((resolve, reject) => {
    const r = db.transaction("bibliotheques", "readonly").objectStore("bibliotheques").get(cle);
    r.onsuccess = () => { try { resolve(r.result ? validerBibliotheque(r.result) : {version: 0, mentions: []}); } catch (e) { reject(e); } };
    r.onerror = () => reject(new Error("Lecture des mentions impossible."));
  }); } finally { db.close(); }
}
/** Une transaction relit la version avant l’écriture : aucune perte entre onglets. */
async function modifier(version: number, appliquer: (b: BibliothequeMentions) => BibliothequeMentions): Promise<BibliothequeMentions> {
  const cle = await cleCompte(); const db = await ouvrir();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction("bibliotheques", "readwrite"); const store = tx.objectStore("bibliotheques"); const r = store.get(cle);
    let resultat: BibliothequeMentions; let erreur: unknown;
    r.onsuccess = () => {
      try {
        const b = r.result ? validerBibliotheque(r.result) : {version: 0, mentions: []};
        if (b.version !== version) throw new Error("La bibliothèque a été modifiée dans un autre onglet. Rechargez-la ; vos saisies restent affichées.");
        resultat = validerBibliotheque({...appliquer(b), version: version + 1});
        store.put(resultat, cle);
      } catch (e) { erreur = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(resultat);
    tx.onabort = () => reject(erreur ?? new Error("Enregistrement interrompu. Votre bibliothèque précédente est conservée."));
    tx.onerror = () => { erreur ??= new Error("Enregistrement local impossible : espace insuffisant ou stockage indisponible."); };
  }); } finally { db.close(); }
}
export async function enregistrerMention(v: Mention, version: number) {
  const m = validerMention(v);
  return modifier(version, b => ({...b, mentions: b.mentions.some(a => a.id === m.id) ? b.mentions.map(a => a.id === m.id ? m : a) : [...b.mentions, m]}));
}
export async function importerMentions(mentions: Mention[], version: number) {
  return modifier(version, b => fusionnerMentions(b, mentions));
}
