import type { LigneSaisie } from '@/data/devis';

/** Les lots sont conservés dans la description publique déjà sauvegardée par SQL. */
export function lireLot(description: string): { lot: string; description: string } {
  const m=/^Lot : ([^\r\n]{1,100})(?:\r?\n|$)/.exec(description);
  return m ? {lot:m[1]!,description:description.slice(m[0].length)} : {lot:'',description};
}
export function ecrireLot(description:string,lot:string):string {
  const propre=lot.replace(/[\r\n]/g,' ').slice(0,100);
  const texte=lireLot(description).description;
  return propre.trim() ? `Lot : ${propre}\n${texte}` : texte;
}
export function presentationLigne(l:LigneSaisie) {
  const {lot,description}=lireLot(l.description);
  // Les unités historiques ne remplacent que leur équivalent natif exact.
  const m=/^Unité source : (Ens|U)(?:\r?\n|$)/.exec(description);
  const equivalent=!!lot&&!!m&&((m[1]==='Ens'&&l.unite==='forfait')||(m[1]==='U'&&l.unite==='piece'));
  return {lot:lot.trim(),description:equivalent?description.slice(m![0].length):description,uniteSource:equivalent?m![1]!:null};
}
export function debutLot(lignes:LigneSaisie[],index:number):string {
  const lot=lireLot(lignes[index]?.description??'').lot.trim();
  return lot&&(index===0||lireLot(lignes[index-1]!.description).lot.trim()!==lot)?lot:'';
}
export function deplacerLigne(lignes:LigneSaisie[],cle:string,sens:-1|1):LigneSaisie[] {
  const i=lignes.findIndex(l=>l.cle===cle),j=i+sens;
  if(i<0||j<0||j>=lignes.length)return lignes;
  const copie=[...lignes];[copie[i],copie[j]]=[copie[j]!,copie[i]!];return copie;
}
export function dupliquerLigne(lignes:LigneSaisie[],cle:string,nouvelleCle:string):LigneSaisie[] {
  const i=lignes.findIndex(l=>l.cle===cle);
  if(i<0||lignes.some(l=>l.cle===nouvelleCle))return lignes;
  return [...lignes.slice(0,i+1),{...lignes[i]!,cle:nouvelleCle},...lignes.slice(i+1)];
}
