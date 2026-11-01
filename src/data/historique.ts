import { supabase } from "@/integrations/supabase/client";
import type { AnalyseKhosmos } from "@/lib/khosmos";

export function verifierHistorique(valeur: unknown): AnalyseKhosmos {
  if (!valeur || typeof valeur !== "object") throw new Error("Analyse Khosmos invalide.");
  const a = valeur as AnalyseKhosmos;
  if (!Array.isArray(a.documents) || !a.documents.length || a.documents.length > 10000 || !Array.isArray(a.erreurs) || !Array.isArray(a.annexes) || !Array.isArray(a.copies) || typeof a.genereLe !== "string") throw new Error("Le fichier doit être une analyse Khosmos complète.");
  const refs = new Set<string>();
  for (const d of a.documents) {
    if (!d || typeof d.ref !== "string" || !/^[FDA]\d{4}-\d{5}$/.test(d.ref) || refs.has(d.ref) || !["Devis", "Facture", "Acompte", "Avoir"].includes(d.type) || typeof d.client !== "string" || typeof d.date !== "string" || typeof d.statut !== "string" || typeof d.echeance !== "string" || ![d.sources, d.liens, d.alertes, d.infos].every(x => Array.isArray(x) && x.every(v => typeof v === "string")) || ![d.ht, d.tva, d.ttc, d.pdfHt, d.pdfTva, d.pdfTtc, d.net].every(x => x === null || Number.isSafeInteger(x))) throw new Error("Document invalide ou référence en double : rien n’a été enregistré.");
    refs.add(d.ref);
  }
  return a;
}

// Signatures de la migration préparée : isolées ici jusqu'à la génération des types Cloud.
const cloud = supabase as unknown as { rpc: (nom: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message: string } | null }> };
export async function lireEtatHistorique(): Promise<{ analyse: AnalyseKhosmos | null; stockage: "local" | "cloud"; disponible: boolean; avertissement?: string }> {
  const { data, error } = await cloud.rpc("lire_historique_khosmos");
  if (error) {
    if (error.code === "PGRST202") return { analyse: await lireHistorique(), stockage: "local", disponible: false };
    return { analyse: await lireHistorique(), stockage: "local", disponible: false, avertissement: "Le stockage Cloud n’a pas pu être consulté. Voici votre copie locale ; aucun transfert n’est proposé tant que la connexion n’est pas rétablie." };
  }
  if (data) return { analyse: verifierHistorique(data), stockage: "cloud", disponible: true };
  return { analyse: await lireHistorique(), stockage: "local", disponible: true };
}

export async function transfererHistoriqueTest(analyse: AnalyseKhosmos): Promise<AnalyseKhosmos> {
  if (import.meta.env["VITE_SUPABASE_PROJECT_ID"] !== "azulrjtrntkophlvdaio" || import.meta.env["VITE_SUPABASE_URL"] !== "https://azulrjtrntkophlvdaio.supabase.co") throw new Error("Le transfert est autorisé uniquement vers la base TEST vérifiée.");
  verifierHistorique(analyse);
  const { data, error } = await cloud.rpc("enregistrer_historique_khosmos", { p_analyse: analyse });
  if (error) {
    if (error.code === "PGRST202") throw new Error("La migration de stockage doit d’abord être installée dans Lovable TEST.");
    if (error.message.includes("historique_different")) throw new Error("La base contient déjà un autre historique : rien n’a été remplacé.");
    throw new Error("Le transfert n’a pas été confirmé. Votre copie locale est conservée ; vous pouvez réessayer sans créer de doublon.");
  }
  return verifierHistorique(data);
}

async function cleProprietaire() {
  // Copie locale uniquement : aucune requête réseau nécessaire pour retrouver la clé du compte.
  // Les opérations Cloud restent soumises à l'authentification et aux règles serveur.
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder à votre historique.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const demande = indexedDB.open("mayet-historique-khosmos", 2);
    demande.onupgradeneeded = () => {
      if (!demande.result.objectStoreNames.contains("dossiers")) demande.result.createObjectStore("dossiers");
      if (!demande.result.objectStoreNames.contains("archives")) demande.result.createObjectStore("archives");
    };
    demande.onsuccess = () => resolve(demande.result);
    demande.onerror = () => reject(new Error("Le stockage du navigateur est indisponible."));
  });
}

export interface ArchiveLocale { nom: string; hash: string; taille: number; fichiers: number; zip: Blob }
export async function lireArchiveLocale(): Promise<ArchiveLocale | null> {
  const cle = await cleProprietaire(); const db = await ouvrir();
  try { return await new Promise((resolve, reject) => {
    const r = db.transaction("archives", "readonly").objectStore("archives").get(cle);
    r.onsuccess = () => resolve(r.result ?? null); r.onerror = () => reject(new Error("Lecture du ZIP local impossible."));
  }); } finally { db.close(); }
}

export async function enregistrerArchiveLocale(fichier: File, analyse: AnalyseKhosmos): Promise<ArchiveLocale> {
  verifierHistorique(analyse);
  if (!/\.zip$/i.test(fichier.name) || fichier.size > 200 * 1024 * 1024) throw new Error("Choisissez le ZIP original (200 Mo maximum).");
  const bytes = new Uint8Array(await fichier.arrayBuffer());
  const { unzip } = await import("fflate"); const chemins = new Set<string>(); let volume = 0; let refus = false;
  await new Promise<void>((resolve, reject) => unzip(bytes, { filter: info => {
    if (!info.name.endsWith("/")) { chemins.add(info.name); volume += info.originalSize; if (info.originalSize > 64 * 1024 * 1024 || volume > 750 * 1024 * 1024 || chemins.size > 3000) refus = true; }
    return false; // Inspection du répertoire ZIP sans décompresser les PDF.
  } }, err => err ? reject(new Error("Archive ZIP illisible.")) : resolve()));
  if (refus) throw new Error("Archive trop volumineuse après décompression.");
  const attendus = [...new Set(analyse.documents.flatMap(d => d.sources).filter(s => /\.pdf$/i.test(s)))];
  if (!attendus.length || attendus.some(s => !chemins.has(s))) throw new Error("Ce ZIP ne contient pas tous les PDF de cet historique. Aucun fichier remplacé.");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
  const archive: ArchiveLocale = { nom: fichier.name, hash, taille: fichier.size, fichiers: chemins.size, zip: fichier };
  const cle = await cleProprietaire(); const db = await ouvrir();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("archives", "readwrite"); const store = tx.objectStore("archives"); const r = store.get(cle);
    r.onsuccess = () => { if (r.result && r.result.hash !== hash) tx.abort(); else store.put(archive, cle); };
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(new Error("Un autre ZIP est déjà conservé. Il n’a pas été remplacé."));
    tx.onerror = () => reject(new Error("Le navigateur ne dispose pas d’assez d’espace pour conserver ce ZIP. Votre sauvegarde sur disque reste intacte."));
  }); return archive; } finally { db.close(); }
}

export async function lirePdfHistorique(chemin: string): Promise<Blob> {
  const archive = await lireArchiveLocale(); if (!archive) throw new Error("Ajoutez d’abord le ZIP original à l’historique.");
  if (!/\.pdf$/i.test(chemin)) throw new Error("Un fichier PDF est requis.");
  const { unzip } = await import("fflate"); let tropGrand = false;
  const bytes = new Uint8Array(await archive.zip.arrayBuffer());
  const fichiers = await new Promise<Record<string, Uint8Array>>((resolve, reject) => unzip(bytes, { filter: info => {
    if (info.name !== chemin) return false; tropGrand = info.originalSize > 64 * 1024 * 1024; return !tropGrand;
  } }, (err, data) => err ? reject(new Error("Extraction du PDF impossible.")) : resolve(data)));
  const pdf = fichiers[chemin];
  if (tropGrand || !pdf || !new TextDecoder().decode(pdf.slice(0, 1024)).includes("%PDF-")) throw new Error("PDF absent, trop volumineux ou illisible.");
  return new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}

export async function lireHistorique(): Promise<AnalyseKhosmos | null> {
  const cle = await cleProprietaire(); const db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("dossiers", "readonly"); const r = tx.objectStore("dossiers").get(cle);
      r.onsuccess = () => { try { resolve(r.result ? verifierHistorique(r.result) : null); } catch (e) { reject(e); } };
      r.onerror = () => reject(new Error("Lecture de l’historique impossible."));
    });
  } finally { db.close(); }
}

export async function enregistrerHistorique(valeur: unknown): Promise<AnalyseKhosmos> {
  const analyse = verifierHistorique(valeur); const cle = await cleProprietaire(); const db = await ouvrir();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("dossiers", "readwrite"); const store = tx.objectStore("dossiers");
      // Une reprise identique est idempotente ; un autre dossier nécessite un futur parcours de fusion.
      const r = store.get(cle);
      r.onsuccess = () => {
        if (r.result && JSON.stringify(r.result.documents) !== JSON.stringify(analyse.documents)) { tx.abort(); return; }
        store.put(analyse, cle);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(new Error("Un autre historique existe déjà. Il est conservé ; aucun remplacement effectué."));
      tx.onerror = () => reject(new Error("Enregistrement impossible : espace du navigateur insuffisant ou indisponible."));
    });
    return analyse;
  } finally { db.close(); }
}
