import { supabase } from "@/integrations/supabase/client";
import { fusionnerMessages, validerMessages, validerModele, type BibliothequeMessages, type ModeleMessage, type TypeMessage } from "@/lib/messages";
async function cleCompte() {
  const {data,error} = await supabase.auth.getSession();
  if (error || !data.session?.user) throw new Error("Reconnectez-vous pour accéder à vos messages.");
  return `${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}:${data.session.user.id}`;
}
function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open("mayet-messages",1);
    r.onupgradeneeded=()=>r.result.createObjectStore("bibliotheques");
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(new Error("Stockage local des messages indisponible."));
  });
}
export async function lireMessages(): Promise<BibliothequeMessages> {
  const cle=await cleCompte(), db=await ouvrir();
  try {return await new Promise((resolve,reject)=>{
    const r=db.transaction("bibliotheques","readonly").objectStore("bibliotheques").get(cle);
    r.onsuccess=()=>{try {resolve(r.result ? validerMessages(r.result) : {version:0,modeles:{}});}catch(e){reject(e);}};
    r.onerror=()=>reject(new Error("Lecture des messages impossible."));
  });}finally{db.close();}
}
async function modifier(version:number, appliquer:(b:BibliothequeMessages)=>BibliothequeMessages):Promise<BibliothequeMessages>{
  const cle=await cleCompte(), db=await ouvrir();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction("bibliotheques","readwrite"), store=tx.objectStore("bibliotheques"), r=store.get(cle);
    let resultat:BibliothequeMessages; let erreur:unknown;
    r.onsuccess=()=>{try{
      const b=r.result ? validerMessages(r.result) : {version:0,modeles:{}};
      if(b.version!==version)throw new Error("Les messages ont été modifiés dans un autre onglet. Rechargez la bibliothèque ; votre saisie reste affichée.");
      resultat=validerMessages({...appliquer(b),version:version+1});store.put(resultat,cle);
    }catch(e){erreur=e;tx.abort();}};
    tx.oncomplete=()=>resolve(resultat);
    tx.onabort=()=>reject(erreur ?? new Error("Enregistrement interrompu. Les anciens messages sont conservés."));
    tx.onerror=()=>{erreur ??= new Error("Enregistrement impossible : stockage indisponible ou plein.");};
  });}finally{db.close();}
}
export async function enregistrerMessage(type:TypeMessage, modele:ModeleMessage, version:number){
  const m=validerModele(modele);return modifier(version,b=>({...b,modeles:{...b.modeles,[type]:m}}));
}
export async function importerMessages(modeles:BibliothequeMessages["modeles"],version:number){return modifier(version,b=>fusionnerMessages(b,modeles));}
