import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/lib/suivi-devis.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validerSuivi,validerSuivis,marquerEnvoye,marquerRelance,noterReponse,etatSuiviDevis,joursEcoules}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const J='2026-10-31';
// Délais, y compris fin de mois et année bissextile.
assert.equal(joursEcoules('2026-10-28',J),3);assert.equal(joursEcoules('2028-02-28','2028-03-01'),2);assert.equal(joursEcoules('2026-10-31',J),0);
// États.
assert.equal(etatSuiviDevis(undefined,J).etat,'non-envoye');
assert.equal(etatSuiviDevis({reponse:'attente'},J).etat,'non-envoye');
assert.deepEqual(etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-31'},J),{etat:'en-attente',jours:0,libelle:'Envoyé aujourd’hui'});
assert.equal(etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-30'},J).libelle,'Envoyé il y a 1 jour');
assert.equal(etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-29'},J).etat,'en-attente');
const r3=etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-28'},J);assert.equal(r3.etat,'a-relancer');assert.equal(r3.libelle,'Envoyé il y a 3 jours · sans réponse');
assert.equal(etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-28'},J,5).etat,'en-attente');
// Une relance repart du jour de la relance.
const rel=etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-20',relanceLe:'2026-10-30'},J);assert.equal(rel.etat,'en-attente');assert.equal(rel.libelle,'Relancé il y a 1 jour');
assert.equal(etatSuiviDevis({reponse:'attente',envoyeLe:'2026-10-20',relanceLe:'2026-10-26'},J).etat,'a-relancer');
// Une réponse notée sort le devis des relances.
assert.equal(etatSuiviDevis({reponse:'accepte',envoyeLe:'2026-10-01'},J).etat,'accepte');
assert.equal(etatSuiviDevis({reponse:'refuse',envoyeLe:'2026-10-01'},J).etat,'refuse');
// Actions.
const e=marquerEnvoye(undefined,'2026-10-28',J);assert.deepEqual(e,{reponse:'attente',envoyeLe:'2026-10-28'});
const l=marquerRelance(e,'2026-10-31',J);assert.deepEqual(l,{reponse:'attente',envoyeLe:'2026-10-28',relanceLe:'2026-10-31'});
assert.deepEqual(e,{reponse:'attente',envoyeLe:'2026-10-28'},'l’ancien suivi n’est pas modifié');
assert.equal(marquerEnvoye(l,'2026-10-29',J).relanceLe,undefined,'nouvel envoi : relance remise à zéro');
assert.equal(marquerEnvoye({reponse:'refuse',envoyeLe:'2026-10-01'},'2026-10-30',J).reponse,'refuse');
assert.equal(noterReponse(l,'accepte',J).reponse,'accepte');
assert.throws(()=>marquerRelance(undefined,J,J),/date d’envoi/);
assert.throws(()=>marquerRelance({reponse:'attente'},J,J),/date d’envoi/);
// Refus : dates invalides, futures, incohérentes, champs inconnus.
for(const d of ['2026-02-30','2026-13-01','31/10/2026','','2026-10-32',null,20261031])assert.throws(()=>marquerEnvoye(undefined,d,J));
assert.throws(()=>marquerEnvoye(undefined,'2026-11-01',J),/futur/);
assert.throws(()=>marquerRelance(e,'2026-10-27',J),/précéder/);
for(const mauvais of [null,[],'x',{reponse:'signe'},{reponse:'attente',signature:'oui'},{reponse:'attente',relanceLe:'2026-10-30'}])assert.throws(()=>validerSuivi(mauvais,J));
// Bibliothèque.
const b={version:2,suivis:{'a1':e}};assert.deepEqual(validerSuivis(JSON.parse(JSON.stringify(b)),J),b);
for(const mauvais of [null,{},{version:-1,suivis:{}},{version:1.5,suivis:{}},{version:0,suivis:[]},{version:0,suivis:{'':e}},{version:0,suivis:{['x'.repeat(65)]:e}},{version:0,suivis:{a:{reponse:'zzz'}}}])assert.throws(()=>validerSuivis(mauvais,J));
assert.throws(()=>validerSuivis(JSON.parse('{"version":0,"suivis":{"__proto__":{"reponse":"attente"}}}'),J));
assert.equal(({}).polluted,undefined);
console.log('Suivi des devis : jours écoulés, seuil de relance réglable, relance repartant de sa date, réponse notée sortant des relances, dates invalides ou futures refusées, anciens suivis non modifiés, bibliothèque validée.');
