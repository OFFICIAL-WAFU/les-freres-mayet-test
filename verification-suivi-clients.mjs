import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const url = code => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(code, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
// Les calculs existants sont chargés sans le connecteur réseau pour cette recette.
const reglements = fs.readFileSync('src/data/reglements.ts','utf8').split('const MSG:')[0].replace(/^import .*supabase.*;\r?\n/m,'');
const regUrl = url(reglements);
const echUrl = url(fs.readFileSync('src/lib/echeances.ts','utf8'));
const monUrl = url(fs.readFileSync('src/lib/montants.ts','utf8'));
const helper = fs.readFileSync('src/lib/suivi-clients.ts','utf8').replace('"@/data/reglements"',JSON.stringify(regUrl)).replace('"./echeances"',JSON.stringify(echUrl)).replace('"./montants"',JSON.stringify(monUrl));
const {syntheseClient,dansPeriode,dateDocumentIso,correspondSuiviClient} = await import(url(helper));
const paiement = (montant,annuleLe=null) => ({montant,annuleLe});
const doc = (id,montant,extra={}) => ({id,clientId:'client-a',date:'01/10/2026',type:'facture',statut:'Finalisé',aRegler:montant,devis:{validite:'2026-10-20'},reglements:[],...extra});
const liste = [
  doc('acompte',4323n,{type:'acompte',reglements:[paiement(4323n)]}),
  doc('solde',30677n,{reglements:[paiement(20677n),paiement(4000n,'2026-10-06')]}),
  doc('retard',12000n,{devis:{validite:'2026-10-01'},reglements:[paiement(4000n)]}),
  doc('avoir',18000n,{credite:18000n,reglements:[paiement(18000n)]}),
  doc('sans-echeance',6000n,{devis:{}}),
  doc('brouillon',999999n,{statut:'Brouillon'}),
  doc('demo',999999n,{fictif:true}),
  doc('devis',999999n,{type:'devis'}),
  doc('autre-client',999999n,{clientId:'client-b'}),
  doc('ancien',5000n,{date:'31/12/2025'}),
];
const s=syntheseClient(liste,'client-a','annee','2026-10-07');
assert.deepEqual(s,{facture:71000n,credite:18000n,attente:16000n,retard:8000n,paye:47000n,creditClient:18000n});
assert.equal(s.facture-s.credite-s.paye+s.creditClient,s.attente+s.retard);
assert.equal(syntheseClient(liste.slice(0,2),'client-a','toutes','2026-10-07').facture,35000n);
assert.equal(syntheseClient(liste,'client-a','toutes','2026-10-07').facture,76000n);
assert.equal(syntheseClient(liste,'absent','annee','2026-10-07').facture,0n);
assert.equal(dateDocumentIso('31/02/2026'),null);
assert.equal(dateDocumentIso('07/10/2026'),'2026-10-07');
assert.equal(dansPeriode('08/09/2026','30jours','2026-10-07'),true);
assert.equal(dansPeriode('07/09/2026','30jours','2026-10-07'),false);
assert.equal(dansPeriode('08/10/2026','annee','2026-10-07'),false);
assert.equal(dansPeriode('30/09/2026','mois','2026-10-07'),false);
assert.equal(dansPeriode('29/02/2024','mois','2024-02-29'),true);
assert.equal(correspondSuiviClient(liste[1],'attente','2026-10-07'),true);
assert.equal(correspondSuiviClient(liste[2],'attente','2026-10-07'),false);
assert.equal(correspondSuiviClient(liste[2],'retard','2026-10-07'),true);
assert.equal(correspondSuiviClient(liste[1],'paye','2026-10-07'),true);
assert.equal(correspondSuiviClient(liste[5],'paye','2026-10-07'),false);
console.log('Suivi client vérifié : acompte + solde, paiements partiels/annulés, avoir/crédit, retard, échéance absente, périodes inclusives, années bissextiles, exclusion brouillons/démo/autres clients.');
const annuelSource = fs.readFileSync('src/lib/activite-annuelle.ts','utf8').replace('"./suivi-clients"',JSON.stringify(url(helper))).replace('"./echeances"',JSON.stringify(echUrl)).replace('"./montants"',JSON.stringify(monUrl));
const {activiteAnnuelle} = await import(url(annuelSource));
const annuels = [
  doc('acompte',4323n,{type:'acompte',montantHTCentimes:3705n}),
  doc('solde',30677n,{montantHTCentimes:26295n,deduction:{statut:'finalise',ht:3705n,ttc:4323n}}),
  doc('avoir',12000n,{type:'avoir',date:'02/09/2026',montantHTCentimes:10000n,factureSource:{id:'solde'}}),
  doc('avoir-acompte',4323n,{type:'avoir',date:'02/09/2026',montantHTCentimes:3705n,factureSource:{id:'acompte'}}),
  doc('autre-annee',100n,{date:'01/01/2025',montantHTCentimes:100n}),
  doc('futur',100n,{date:'08/10/2026',montantHTCentimes:100n}),
  doc('draft',100n,{statut:'Brouillon',montantHTCentimes:100n}),
];
const annuel = activiteAnnuelle(annuels,'2026-10-07');
assert.equal(annuel.total,20000n);assert.equal(annuel.mois[8],-10000n);assert.equal(annuel.mois[9],30000n);assert.equal(annuel.incomplets,0);
assert.equal(activiteAnnuelle([...annuels,doc('ht-manquant',100n)],'2026-10-07').incomplets,1);
console.log('Graphique annuel vérifié (calcul Khosmos) : facture de solde au HT complet, acomptes exclus, avoir de facture au mois d’émission, avoir d’acompte ignoré, mois négatif, exclusion autres années/futurs/brouillons, refus de total incomplet.');
