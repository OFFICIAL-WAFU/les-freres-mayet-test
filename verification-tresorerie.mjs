import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/lib/tresorerie.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validerCharge,validerTresorerie,ajouterMois,occurrencesDansMois,preparerPrevision,libelleMois,dateReelle}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const J='2026-10-31';
// Calendrier.
assert.equal(ajouterMois('2026-11',2),'2027-01');assert.equal(ajouterMois('2026-01',-1),'2025-12');assert.equal(ajouterMois('2026-12',1),'2027-01');
assert.equal(libelleMois('2026-11'),'novembre 2026');
assert.equal(dateReelle('2028-02-29'),true);assert.equal(dateReelle('2027-02-29'),false);assert.equal(dateReelle('2026-04-31'),false);
// Charges : validation.
const ok={id:'a',libelle:'Loyer atelier',date:'2026-10-05',montant:45000,repetition:'mensuelle'};
assert.deepEqual(validerCharge({...ok,libelle:'  Loyer atelier  '}),ok);
for(const m of [0,-5,1.5,'450',NaN,Infinity,2e12,null])assert.throws(()=>validerCharge({...ok,montant:m}),/montant/i);
for(const l of ['','   ','a\nb','x'.repeat(121),null,12])assert.throws(()=>validerCharge({...ok,libelle:l}),/libellé/);
for(const d of ['2026-02-30','31/10/2026','',null])assert.throws(()=>validerCharge({...ok,date:d}),/date/);
assert.throws(()=>validerCharge({...ok,repetition:'annuelle'}),/Répétition/);
assert.throws(()=>validerCharge({...ok,secret:'x'}),/inconnu/);
assert.throws(()=>validerCharge({...ok,id:'__proto__'}),/Identifiant/);
// Bibliothèque.
const bib={version:1,solde:{date:J,montant:-12000},charges:[ok]};
assert.deepEqual(validerTresorerie(JSON.parse(JSON.stringify(bib))),bib);
assert.throws(()=>validerTresorerie({version:0,charges:[ok,ok]}),/double/);
assert.throws(()=>validerTresorerie({version:-1,charges:[]}));
assert.throws(()=>validerTresorerie({version:0,charges:[],solde:{date:J,montant:1.5}}),/Solde/);
assert.throws(()=>validerTresorerie({version:0,charges:'x'}));
// Récurrence : fin de mois et année bissextile.
const fin={...ok,date:'2026-01-31'};
assert.deepEqual(occurrencesDansMois(fin,'2026-02'),['2026-02-28']);assert.deepEqual(occurrencesDansMois(fin,'2028-02'),['2028-02-29']);assert.deepEqual(occurrencesDansMois(fin,'2026-04'),['2026-04-30']);
assert.deepEqual(occurrencesDansMois(fin,'2025-12'),[],'pas avant la première date');
assert.deepEqual(occurrencesDansMois({...ok,repetition:'aucune'},'2026-10'),['2026-10-05']);assert.deepEqual(occurrencesDansMois({...ok,repetition:'aucune'},'2026-11'),[]);
// Prévision.
const entrees=[{date:'2026-10-15',montant:100000n},{date:'2026-10-31',montant:20000n},{date:'2026-11-10',montant:300000n},{date:'2027-03-01',montant:999n},{date:'2027-05-01',montant:555n},{montant:7000n},{date:'2026-11-20',montant:0n}];
const charges=[{...ok,date:'2026-11-05'},{id:'b',libelle:'Assurance',date:'2026-12-20',montant:10000,repetition:'aucune'}];
let p=preparerPrevision({entrees,charges,aujourdHui:J});
assert.equal(p.retard,100000n,'échéance dépassée à part');assert.equal(p.sansDate,7000n,'sans échéance à part');
assert.equal(p.mois.length,6);assert.equal(p.mois[0].mois,'2026-10');
assert.equal(p.mois[0].entrees,20000n,'le jour même compte dans le mois courant');
assert.equal(p.mois[1].entrees,300000n);assert.equal(p.mois[1].sorties,45000n);assert.equal(p.mois[1].net,255000n);
assert.equal(p.mois[2].sorties,55000n,'loyer + assurance en décembre');
assert.equal(p.mois[5].mois,'2027-03');assert.equal(p.mois[5].entrees,999n);
assert.ok(p.mois.every(l=>l.cumul===null),'sans solde de départ : pas de cumul affiché');
assert.equal(p.mois.reduce((s,l)=>s+l.entrees,0n),20000n+300000n+999n,'rien au-delà de l’horizon ni de montant nul');
// Avec solde de départ : cumul exact, charges antérieures au solde ignorées.
p=preparerPrevision({entrees,charges:[{...ok,date:'2026-10-05'}],solde:{date:J,montant:-12000},aujourdHui:J});
assert.equal(p.mois[0].sorties,0n,'loyer du 5 octobre déjà compris dans le solde du 31');
assert.equal(p.mois[0].cumul,8000n);assert.equal(p.mois[1].sorties,45000n);assert.equal(p.mois[1].cumul,8000n+300000n-45000n);
// Aucune mutation, bornes.
const copie=JSON.stringify(charges);preparerPrevision({entrees:[],charges,aujourdHui:J});assert.equal(JSON.stringify(charges),copie);
assert.equal(preparerPrevision({entrees:[],charges:[],aujourdHui:'2026-12-31',nombreMois:2}).mois[1].mois,'2027-01');
for(const n of [0,25,1.5])assert.throws(()=>preparerPrevision({entrees:[],charges:[],aujourdHui:J,nombreMois:n}));
assert.throws(()=>preparerPrevision({entrees:[],charges:[],aujourdHui:'2026-02-30'}));
console.log('Trésorerie : retards et sans échéance séparés, jour même inclus, horizon respecté, charges mensuelles en fin de mois et années bissextiles, charges antérieures au solde ignorées, cumul exact, validation stricte, données non modifiées.');
