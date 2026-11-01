import { supabase } from '@/integrations/supabase/client';
import { validerLigne, type DevisBrouillon } from '@/data/devis';
import { UNITE_LABELS } from '@/data/catalogue';

export interface RepriseDevis { format: 'mayet-reprise-devis'; version: 1; referenceSource: string; devis: DevisBrouillon; pdfOriginal: string; pdfRevu: string; remiseHT: number; totauxSource: { ht: number; tva: number; ttc: number }; sha256Original: string }
export function verifierReprise(v: unknown): RepriseDevis {
  const r=v as RepriseDevis;
  if (!r || r.format!=='mayet-reprise-devis' || r.version!==1 || typeof r.referenceSource!=='string' || r.referenceSource.length>100 || !r.devis || !Array.isArray(r.devis.lignes) || !r.devis.lignes.length || r.devis.lignes.length>500) throw new Error('Fichier de reprise invalide.');
  const d=r.devis;
  if (![d.objet,d.date,d.validite,d.remarques,d.notes,d.conditions??''].every(x=>typeof x==='string'&&x.length<=20000) || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error('Informations du devis invalides.');
  const cles=new Set<string>();
  for (const l of d.lignes) {
    if (!l || ![l.cle,l.reference,l.designation,l.description,l.quantite,l.prix].every(x=>typeof x==='string'&&x.length<=5000) || !/^[a-f0-9-]{36}$/i.test(l.cle) || cles.has(l.cle) || !['materiel','prestation'].includes(l.type) || !Object.hasOwn(UNITE_LABELS,l.unite) || ![0,55,100,200].includes(l.taux as number) || Object.keys(validerLigne(l).erreurs).length) throw new Error('Une ligne du devis est invalide.');
    cles.add(l.cle);
  }
  if (![r.pdfOriginal,r.pdfRevu].every(x=>typeof x==='string'&&x.length<15_000_000&&/^JVBERi0[A-Za-z0-9+/=\r\n]+$/.test(x)) || !Number.isSafeInteger(r.remiseHT) || r.remiseHT<0 || !r.totauxSource || ![r.totauxSource.ht,r.totauxSource.tva,r.totauxSource.ttc].every(x=>Number.isSafeInteger(x)&&x>=0) || r.totauxSource.ht+r.totauxSource.tva!==r.totauxSource.ttc || !/^[a-f0-9]{64}$/.test(r.sha256Original)) throw new Error('PDF ou totaux source invalides.');
  return r;
}
async function cle(id:string) { const {data,error}=await supabase.auth.getSession(); if(error||!data.session) throw new Error('Reconnectez-vous.'); return `${import.meta.env['VITE_SUPABASE_PROJECT_ID']}:${data.session.user.id}:${id}`; }
function ouvrir():Promise<IDBDatabase> { return new Promise((resolve,reject)=>{const q=indexedDB.open('mayet-reprises-devis',1); q.onupgradeneeded=()=>q.result.createObjectStore('sources'); q.onsuccess=()=>resolve(q.result); q.onerror=()=>reject(new Error('Stockage local indisponible.'));}); }
export async function conserverReprise(id:string,r:RepriseDevis) {
  verifierReprise(r); const bytes=Uint8Array.from(atob(r.pdfOriginal),x=>x.charCodeAt(0)); const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join(''); if(hash!==r.sha256Original) throw new Error('Le PDF original ne correspond pas à son empreinte.');
  const key=await cle(id),db=await ouvrir(); try { await new Promise<void>((resolve,reject)=>{ const t=db.transaction('sources','readwrite'),s=t.objectStore('sources'),q=s.get(key); q.onsuccess=()=>{if(q.result&&q.result.sha256Original!==r.sha256Original) {t.abort();return;} s.put(r,key);}; t.oncomplete=()=>resolve(); t.onabort=t.onerror=()=>reject(new Error('La source n’a pas été sauvegardée ; aucun original différent n’est remplacé.'));}); } finally {db.close();}
}
export async function lireReprise(id:string):Promise<RepriseDevis|null> {const key=await cle(id),db=await ouvrir();try{return await new Promise((resolve,reject)=>{const q=db.transaction('sources').objectStore('sources').get(key);q.onsuccess=()=>resolve(q.result?verifierReprise(q.result):null);q.onerror=()=>reject(new Error('Source illisible.'));});}finally{db.close();}}
export function telechargerSource(r:RepriseDevis,original:boolean) {const b=Uint8Array.from(atob(original?r.pdfOriginal:r.pdfRevu),x=>x.charCodeAt(0)),url=URL.createObjectURL(new Blob([b],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=`Devis_${r.referenceSource}_${original?'original':'remise'}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
