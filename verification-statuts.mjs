import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const url = code => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(code, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const regUrl = url(fs.readFileSync('src/data/reglements.ts','utf8').split('const MSG:')[0].replace(/^import .*supabase.*;\r?\n/m,''));
const echUrl = url(fs.readFileSync('src/lib/echeances.ts','utf8'));
const scUrl = url(fs.readFileSync('src/lib/suivi-clients.ts','utf8').replace('"@/data/reglements"',JSON.stringify(regUrl)).replace('"./echeances"',JSON.stringify(echUrl)));
const src = fs.readFileSync('src/lib/statuts.ts','utf8').replace('"@/data/reglements"',JSON.stringify(regUrl)).replace('"./echeances"',JSON.stringify(echUrl)).replace('"./suivi-clients"',JSON.stringify(scUrl));
const {statutAffiche, synthese, etatDevis} = await import(url(src));
const J = '2026-11-04';
const R = (montant, date, annuleLe=null) => ({montant, date, annuleLe});
const devis = (id, ttc, extra={}) => ({id, type:'devis', statut:'Finalisé', date:'10/10/2026', montantTTC:ttc/100, devis:{validite:'2026-12-01'}, ...extra});
const fac = (id, ttc, extra={}) => ({id, type:'facture', statut:'Finalisé', date:'15/10/2026', aRegler:ttc, reglements:[], credite:0n, devis:{validite:'2026-11-30'}, ...extra});
const docs = [
  devis('d-attente', 10000),
  devis('d-expire', 20000, {devis:{validite:'2026-10-20'}}),
  devis('d-refuse', 30000, {reponse:{etat:'refuse',le:'2026-10-12',mode:'manuelle'}}),
  devis('d-signe', 50000, {reponse:{etat:'accepte',le:'2026-11-02',mode:'signature_khosmos'}}),
  fac('acompte', 15000, {type:'acompte', devisSource:{id:'d-signe'}, reglements:[R(15000n,'2026-10-16')]}),
  fac('solde', 50000n - 15000n, {devisSource:{id:'d-signe'}, deduction:{statut:'finalise',ht:12500n,ttc:15000n}, reglements:[R(35000n,'2026-11-03')]}),
  fac('retard', 8000n, {devis:{validite:'2026-10-30'}}),
  fac('annulee', 9000n, {credite:9000n, reglements:[R(9000n,'2026-10-15','2026-10-20')]}),
  fac('partielle', 10000n, {reglements:[R(4000n,'2026-10-20')]}),
];
docs[4].aRegler = 15000n;
assert.equal(statutAffiche(docs[0], J), 'En attente de signature');
assert.equal(statutAffiche(docs[1], J), 'Expiré');
assert.equal(statutAffiche(docs[2], J), 'Refusé');
assert.equal(statutAffiche(docs[3], J), 'Signé');
assert.equal(statutAffiche(docs[4], J), 'Payé');
assert.equal(statutAffiche(docs[7], J), 'Annulée');
assert.equal(statutAffiche(docs[8], J), 'En attente de paiement');
assert.equal(etatDevis({...docs[0], statut:'Brouillon'}, J), 'brouillon');
const tout = synthese(docs, 'toutes', J);
assert.equal(tout.devis.attente, 10000n); assert.equal(tout.devis.expire, 20000n); assert.equal(tout.devis.refuse, 30000n); assert.equal(tout.devis.signe, 50000n);
assert.equal(tout.aFacturer, 0n);                       // 15 000 (acompte) + 50 000 (solde, TTC avant déduction) couvrent le devis
assert.equal(tout.factures.paye, 50000n + 4000n);        // solde payé : TTC complet acompte compris (comme Khosmos) + règlement partiel
assert.equal(tout.acomptes.paye, 15000n);
assert.equal(tout.factures.retard, 8000n);
assert.equal(tout.factures.attente, 6000n);              // reste de la facture partielle ; la facture annulée est exclue
assert.equal(tout.encaisse, 15000n + 35000n + 4000n);    // le règlement annulé ne compte pas
const oct = synthese(docs, 'mois', '2026-10-31');
assert.equal(oct.factures.paye, 4000n);                  // solde réglé en novembre : compté en novembre
assert.equal(oct.devis.signe, 0n);                       // signé le 02/11 : compté en novembre
assert.equal(oct.encaisse, 15000n + 4000n);
console.log('Statuts et synthèse vérifiés : signé/refusé/expiré/en attente, payé/annulé, payé à la date du règlement, devis à facturer, encaissé hors règlements annulés.');
