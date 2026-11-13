// Contrôles de la remise sur facture (src/lib/remise.ts, règles de src/data/devis.ts et src/lib/rentabilite.ts).
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const out=await build({stdin:{contents:"export * from './src/lib/remise.ts'; export {validerLigne,recapituler,estLigneRemise,formaterPrixSaisi,analyserPrixCentimes} from './src/data/devis.ts'; export {rentabilite} from './src/lib/rentabilite.ts';",resolveDir:'.',loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',alias:{'@':'./src'},logLevel:'silent'});
const M=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
const {calculerRemise,appliquerRemise,retirerRemise,erreurRemise,analyserValeurRemise,validerLigne,recapituler,estLigneRemise,formaterPrixSaisi,rentabilite}=M;
let n=0;const cle=()=>`k${++n}`;
const L=(prix,taux,q='1',d='ARTICLE')=>({cle:cle(),articleId:null,type:'materiel',reference:'',designation:d,description:'',unite:'piece',quantite:q,prix,taux});
const base=[L('100,00',100,'2'),L('300,00',55)]; // 200 € HT à 10 %, 300 € HT à 5,5 %

// Saisie
assert.equal(analyserValeurRemise('10'),1000n);assert.equal(analyserValeurRemise('10,5 %'),1050n);assert.equal(analyserValeurRemise('50,00 €'),5000n);
assert.equal(analyserValeurRemise('-5'),null);assert.equal(analyserValeurRemise('1,234'),null);assert.equal(analyserValeurRemise('abc'),null);

// Pourcentage : une ligne par taux
const p=calculerRemise(base,'pourcent',1000n);
assert.deepEqual(p.parts.map(x=>[x.taux,x.remiseHt]),[[55,3000n],[100,2000n]]);assert.equal(p.remiseHt,5000n);assert.equal(p.netHt,45000n);
const lp=appliquerRemise(base,p,'pourcent',1000n,'Geste commercial',cle);
assert.equal(lp.length,4);assert.ok(lp.slice(2).every(estLigneRemise));assert.equal(lp[2].prix,'-30,00');assert.equal(lp[2].designation,'REMISE 10 %');
assert.match(lp[2].description,/Geste commercial — Remise de 10 % sur 300,00 € HT — Part à TVA 5,5 %/);
const r=recapituler(lp);assert.equal(r.complet,true);assert.equal(r.ht,45000n);
assert.deepEqual(r.parTaux.map(x=>[x.taux,x.base,x.tva]),[[55,27000n,1485n],[100,18000n,1800n]]);
assert.equal(erreurRemise(lp,true),null);assert.match(erreurRemise(lp,false),/uniquement sur une facture|ne peut être ajoutée que sur une facture/);

// Remplacer = pas d'empilement ; retirer
const p2=calculerRemise(lp,'pourcent',500n);assert.equal(p2.baseHt,50000n,'les anciennes remises sont ignorées');
assert.equal(appliquerRemise(lp,p2,'pourcent',500n,'',cle).filter(estLigneRemise).length,2);
assert.equal(retirerRemise(lp).length,2);

// Montant HT réparti au prorata, total exact
const h=calculerRemise(base,'ht',3333n);assert.equal(h.remiseHt,3333n);assert.deepEqual(h.parts.map(x=>x.remiseHt),[2000n,1333n]);
// Montant TTC : le client paie ~ le montant demandé en moins (à 1 centime près par taux)
const t=calculerRemise(base,'ttc',5000n);assert.ok(Math.abs(Number(t.remiseTtc-5000n))<=t.parts.length,`ttc ${t.remiseTtc}`);
assert.equal(t.netTtc,t.baseTtc-t.remiseTtc);
// Un seul taux : une seule ligne, sans mention de part
const un=calculerRemise([L('99,99',200)],'pourcent',1000n);assert.equal(un.parts.length,1);assert.equal(un.remiseHt,1000n);
assert.equal(appliquerRemise([L('99,99',200)],un,'pourcent',1000n,'',cle)[1].description,'Remise de 10 % sur 99,99 € HT');

// Refus
assert.match(calculerRemise(base,'pourcent',10000n),/inférieure à 100/);assert.match(calculerRemise(base,'ht',50000n),/inférieure au total HT/);
assert.match(calculerRemise(base,'ttc',999999n),/inférieure au total TTC/);assert.match(calculerRemise([],'pourcent',1000n),/Ajoutez/);
assert.match(calculerRemise([L('',100)],'pourcent',1000n),/Complétez/);assert.match(calculerRemise(base,'pourcent',0n),/supérieure à zéro/);

// Lignes négatives : seulement une vraie ligne de remise
const remise={...lp[3]};assert.equal(validerLigne(remise).calcul.ht,-2000n);
assert.ok(validerLigne({...remise,designation:'CABLE'}).erreurs.prix,'négatif hors remise refusé');
assert.ok(validerLigne({...remise,quantite:'2'}).erreurs.prix,'remise : quantité 1 seulement');
assert.ok(validerLigne({...remise,articleId:'a1'}).erreurs.prix,'remise : pas un article du catalogue');
assert.ok(validerLigne(L('-5,00',100)).erreurs.prix);
// Arrondi symétrique, identique à la base (arrondi_millieme : -1001 → TVA 10 % = -100)
assert.equal(validerLigne({...remise,prix:'-10,01'}).calcul.tva,-100n);assert.equal(validerLigne({...remise,prix:'-0,05',taux:100}).calcul.tva,-1n);
assert.equal(validerLigne({...remise,prix:'-0,04',taux:100}).calcul.tva,0n);
assert.equal(validerLigne(L('0,05',100)).calcul.tva,1n,'positifs inchangés');
// Remise plus forte que les lignes d'un taux
assert.match(erreurRemise([L('10,00',100),{...remise,prix:'-20,00',taux:100}],true),/dépasse le montant des lignes à TVA 10 %/);
// Affichage
assert.equal(formaterPrixSaisi('-30,00'),'-30,00 €');
// Marge : la remise diminue vente et marge du même montant
const R={coefMilliemes:1600,coutHoraireCentimes:2500,tauxHoraireCentimes:5000};
const sans=rentabilite(base,R),avec=rentabilite(lp,R);assert.equal(avec.vente-sans.vente,-5000n);assert.equal(avec.marge-sans.marge,-5000n);
console.log('Remise sur facture : tous les contrôles réussis');
