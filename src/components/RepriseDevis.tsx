import { useEffect, useState } from 'react';
import { conserverReprise, lireReprise, telechargerSource, verifierReprise, type RepriseDevis } from '@/data/reprises-devis';
import { formaterCentimes, recapituler } from '@/data/devis';
import { Button } from '@/components/ui/button';
import { LecteurPdfOriginal } from '@/components/LecteurPdfOriginal';

export function ImporterReprise({onCharger}:{onCharger:(r:RepriseDevis)=>void}) {
  const [erreur,setErreur]=useState('');
  return <details className="mb-4 rounded-xl border bg-card p-4"><summary className="cursor-pointer font-semibold">Reprendre un devis préparé (fichier JSON)</summary><p className="my-2 text-sm text-muted-foreground">Chargez le fichier de reprise vérifié, puis choisissez le client. L’original et la copie avec remise seront conservés localement avec le brouillon. Aucun document n’est finalisé.</p><label className="text-sm font-medium">Fichier de reprise JSON<input className="mt-2 block" type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>22_000_000)throw new Error('Fichier trop volumineux.');const r=verifierReprise(JSON.parse(await f.text()));setErreur('');onCharger(r);}catch(x){setErreur(x instanceof Error?x.message:'Import impossible.');}e.target.value='';}}/></label>{erreur&&<p role="alert" className="mt-2 text-destructive">{erreur}</p>}</details>;
}
export { conserverReprise };
export function SourceReprise({id,ouverte=false}:{id:string;ouverte?:boolean}) {
  const [r,setR]=useState<RepriseDevis|null>(null),[erreur,setErreur]=useState('');
  const [vue,setVue]=useState(false),[url,setUrl]=useState('');
  useEffect(()=>{setVue(ouverte);if(!r){setUrl('');return;}const b=Uint8Array.from(atob(r.pdfRevu),x=>x.charCodeAt(0));const u=URL.createObjectURL(new Blob([b],{type:'application/pdf'}));setUrl(u);return()=>URL.revokeObjectURL(u);},[r,ouverte]);
  useEffect(()=>{let actif=true;setR(null);void lireReprise(id).then(v=>{if(actif)setR(v);}).catch(()=>{if(actif)setErreur('La copie source locale ne peut pas être consultée.');});return()=>{actif=false;};},[id]);
  if(!r)return erreur?<p role="alert">{erreur}</p>:null;
  const calcul=recapituler(r.devis.lignes);
  return <section className="rounded-xl border bg-secondary/30 p-4"><h2 className="font-semibold">Reprise du devis source {r.referenceSource}</h2><p className="mt-2">Remise répercutée au client : {formaterCentimes(BigInt(r.remiseHT))} HT.</p><p>Copie source après remise : {formaterCentimes(BigInt(r.totauxSource.ht))} HT · {formaterCentimes(BigInt(r.totauxSource.ttc))} TTC.</p>{calcul.ttc!==BigInt(r.totauxSource.ttc)&&<p className="mt-2">Arrondi TVA : la source arrondit sur le total, l’éditeur par ligne ({formaterCentimes(calcul.ttc)} TTC). Les prix HT sont identiques.</p>}<p className="my-2 text-xs text-muted-foreground">Les PDF conservés reproduisent la source au moment de la reprise : ils ne sont pas régénérés par les modifications ultérieures du brouillon. La référence source ne remplace pas la numérotation de l’application. Copies locales dans ce navigateur ; conservez aussi le fichier de reprise pour leur sauvegarde.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>telechargerSource(r,true)}>PDF original</Button><Button onClick={()=>telechargerSource(r,false)}>PDF source avec remise</Button><Button variant="outline" onClick={()=>setVue(!vue)}>{vue?'Masquer la copie':'Voir la copie avec remise'}</Button></div>{vue&&url&&<div className="mt-4"><LecteurPdfOriginal url={url}/></div>}</section>;
}

