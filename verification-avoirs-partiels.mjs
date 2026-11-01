import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/lib/avoirs-partiels.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {resteParLigne,calculerAvoirPartiel,quantiteEnMilliemes,milliemesEnTexte,resteACrediterTtc}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
// Même scénario que verification-avoirs-partiels-sql.mjs (facture F1).
const h=(q,p)=>Math.trunc((q*p*2+1000)/2000),t=(ht,x)=>Math.trunc((ht*x*2+1000)/2000);
const mk=(id,des,q,p,x)=>{const ht=h(q,p);return{id,designation:des,quantiteMilliemes:q,prixCentimes:p,taux:x,htCentimes:ht,tvaCentimes:t(ht,x)}};
const L=[mk('l1','Tableau',2000,10000,200),mk('l2','Câble',3000,3333,100),mk('l3','Main d’œuvre',1000,5000,200)];
const total=L.reduce((s,l)=>s+l.htCentimes+l.tvaCentimes,0);
const r1=calculerAvoirPartiel(L,[],[{id:'l1',quantiteMilliemes:1000}],total,0);
assert.ok(r1.ok);assert.deepEqual([r1.ht,r1.tva,r1.ttc],[10000,2000,12000]);assert.deepEqual(r1.ventilation,[{taux:200,base:10000,tva:2000}]);
let cred=[{id:'l1',quantiteMilliemes:1000,htCentimes:10000,tvaCentimes:2000}];let deja=12000;
// Câble en 3 fois : 1,5 + 1 + reste → 5000 + 3333 + 1666 = 9999 (aucun écart d'arrondi)
let somme=0;
for(const q of [1500,1000,500]){const r=calculerAvoirPartiel(L,cred,[{id:'l2',quantiteMilliemes:q}],total,deja);assert.ok(r.ok,JSON.stringify(r));somme+=r.ht;cred=[...cred,{id:'l2',quantiteMilliemes:q,htCentimes:r.lignes[0].htCentimes,tvaCentimes:r.lignes[0].tvaCentimes}];deja+=r.ttc;}
assert.equal(somme,L[1].htCentimes);
assert.equal(calculerAvoirPartiel(L,cred,[{id:'l2',quantiteMilliemes:1}],total,deja).erreur,'quantite_depassee');
assert.equal(calculerAvoirPartiel(L,cred,[{id:'l1',quantiteMilliemes:1001}],total,deja).erreur,'quantite_depassee');
const rest=calculerAvoirPartiel(L,cred,[{id:'l1',quantiteMilliemes:1000},{id:'l3',quantiteMilliemes:1000}],total,deja);
assert.ok(rest.ok);assert.equal(deja+rest.ttc,total);
assert.equal(resteACrediterTtc(total,deja+rest.ttc),0);
// Refus
const c=(d,tot=total,dj=0)=>calculerAvoirPartiel(L,[],d,tot,dj).erreur;
assert.equal(c([]),'aucune_ligne');assert.equal(c([{id:'zz',quantiteMilliemes:1}]),'ligne_inconnue');
assert.equal(c([{id:'l1',quantiteMilliemes:0}]),'quantite_invalide');assert.equal(c([{id:'l1',quantiteMilliemes:1.5}]),'quantite_invalide');
assert.equal(c([{id:'l1',quantiteMilliemes:100},{id:'l1',quantiteMilliemes:100}]),'quantite_invalide');
assert.equal(c([{id:'l1',quantiteMilliemes:1000}],1000),'depasse_facture');
assert.equal(c([{id:'l1',quantiteMilliemes:1000}],total,total),'depasse_facture');
const zero=[mk('z','Offert',1000,0,200)];assert.equal(calculerAvoirPartiel(zero,[],[{id:'z',quantiteMilliemes:1000}],1000,0).erreur,'montant_nul');
// Lignes dans l'ordre de la facture, quel que soit l'ordre de saisie
const o=calculerAvoirPartiel(L,[],[{id:'l3',quantiteMilliemes:500},{id:'l1',quantiteMilliemes:500}],total,0);assert.deepEqual(o.lignes.map(x=>x.id),['l1','l3']);
// Reste par ligne
const rl=resteParLigne(L,[{id:'l1',quantiteMilliemes:1000,htCentimes:10000,tvaCentimes:2000}]);assert.equal(rl[0].reste,1000);assert.equal(rl[0].resteHt,10000);assert.equal(rl[1].reste,3000);
// Saisie des quantités
for(const [s,v] of [['1',1000],['1,5',1500],['1.5',1500],['0,001',1],[' 2 ',2000],['12,345',12345]])assert.equal(quantiteEnMilliemes(s),v,s);
for(const s of ['','0','0,000','-1','1,2345','abc','1,','1e3','1 000 000 000'])assert.equal(quantiteEnMilliemes(s),null,s);
assert.equal(milliemesEnTexte(1500),'1,5');assert.equal(milliemesEnTexte(2000),'2');assert.equal(milliemesEnTexte(1),'0,001');
console.log('Avoirs partiels (calcul d’aperçu) : tous les contrôles réussis');
