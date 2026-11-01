import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/lib/rapports.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {validerPhotos,analyserQuantite,formaterQuantiteRapport,analyserHeures,formaterDuree,validerSaisie,validerSignature,validerRapports,creerRapport,modifierRapport,signerRapport,supprimerRapport}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const J='2026-10-31';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// Quantités et durées.
assert.equal(analyserQuantite('2,5'),250);assert.equal(analyserQuantite('2.50'),250);assert.equal(analyserQuantite('12'),1200);assert.equal(analyserQuantite('0,01'),1);
for(const q of ['0','0,00','-1','1,234','abc','','1e3','12345678'])assert.equal(analyserQuantite(q),null,q);
assert.equal(formaterQuantiteRapport(250),'2,5');assert.equal(formaterQuantiteRapport(1200),'12');assert.equal(formaterQuantiteRapport(105),'1,05');
assert.equal(analyserHeures('1,5'),90);assert.equal(analyserHeures('0,25'),15);assert.equal(analyserHeures(''),0);assert.equal(analyserHeures('2'),120);
for(const h of ['-1','1,555','x','99999'])assert.equal(analyserHeures(h),null,h);
assert.equal(formaterDuree(90),'1 h 30');assert.equal(formaterDuree(120),'2 h');assert.equal(formaterDuree(0),'0 h');
// Saisie.
const saisie={date:'2026-10-30',client:{nom:'Paul Testdurand',telephone:'0600000000',adresse:'1 rue Test, 85520 Jard-sur-Mer'},chantier:'',objet:'Remplacement du tableau électrique',travaux:'Dépose de l’ancien tableau.\nPose du nouveau tableau 3 rangées.',observations:'',materiel:[{designation:'Disjoncteur 20A',quantite:400,unite:'u'}],minutes:150,intervenant:'Baptiste'};
const s=validerSaisie(saisie,J);assert.equal(s.objet,'Remplacement du tableau électrique');assert.equal(s.travaux.includes('\n'),true,'les retours à la ligne du texte long sont conservés');
assert.throws(()=>validerSaisie({...saisie,date:'2026-11-01'},J),/futur/);
for(const d of ['2026-02-30','31/10/2026','',null])assert.throws(()=>validerSaisie({...saisie,date:d},J),/date/i);
assert.throws(()=>validerSaisie({...saisie,client:{...saisie.client,nom:'  '}},J),/nom du client/);
assert.throws(()=>validerSaisie({...saisie,objet:'a\nb'},J),/objet/i);
assert.throws(()=>validerSaisie({...saisie,objet:'x'.repeat(151)},J),/objet/i);
assert.throws(()=>validerSaisie({...saisie,travaux:''},J),/travaux/i);
assert.throws(()=>validerSaisie({...saisie,travaux:'a\u0000b'},J),/travaux/i);
assert.throws(()=>validerSaisie({...saisie,materiel:[{designation:'',quantite:100,unite:'u'}]},J),/désignation/);
assert.throws(()=>validerSaisie({...saisie,materiel:[{designation:'X',quantite:0,unite:'u'}]},J),/quantité/);
assert.throws(()=>validerSaisie({...saisie,materiel:[{designation:'X',quantite:1.5,unite:'u'}]},J),/quantité/);
assert.throws(()=>validerSaisie({...saisie,materiel:Array(101).fill(saisie.materiel[0])},J),/matériel/i);
assert.throws(()=>validerSaisie({...saisie,minutes:-1},J),/Durée/);assert.throws(()=>validerSaisie({...saisie,minutes:1.5},J),/Durée/);
// Signature.
assert.equal(validerSignature({image:PNG,nom:'M. Testdurand',signeLe:J},J).nom,'M. Testdurand');
for(const image of ['data:image/jpeg;base64,AAAA','data:image/png;base64,','<script>','data:image/png;base64,'+'A'.repeat(250001)])assert.throws(()=>validerSignature({image,nom:'X',signeLe:J},J),/image/);
assert.throws(()=>validerSignature({image:PNG,nom:'',signeLe:J},J),/nom/);
assert.throws(()=>validerSignature({image:PNG,nom:'X',signeLe:'2026-11-01'},J),/date/);
assert.throws(()=>validerSignature({image:PNG,nom:'X',signeLe:J,extra:1},J),/inconnu/);
// Photos.
const JPG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';
assert.deepEqual(validerPhotos([{image:JPG,legende:' Avant '}]),[{image:JPG,legende:'Avant'}]);assert.deepEqual(validerPhotos([]),[]);
assert.throws(()=>validerPhotos(Array(7).fill({image:JPG,legende:''})),/Photos/);
for(const image of ['data:image/png;base64,AAAA','data:image/jpeg;base64,','<script>','data:image/jpeg;base64,'+'A'.repeat(150001)])assert.throws(()=>validerPhotos([{image,legende:''}]),/image/);
assert.throws(()=>validerPhotos([{image:JPG,legende:'a\nb'}]),/légende/);assert.throws(()=>validerPhotos([{image:JPG,legende:'',x:1}]),/inconnu/);
assert.deepEqual(validerSaisie(saisie,J).photos,[],'sans photos : liste vide');
assert.equal(validerSaisie({...saisie,photos:[{image:JPG,legende:'x'}]},J).photos.length,1);
// Numérotation, modification, signature, suppression.
let b={version:0,prochain:1,rapports:[]};
const c1=creerRapport(b,saisie,'r1',J);assert.equal(c1.rapport.numero,'RI-2026-001');assert.equal(c1.bibliotheque.prochain,2);assert.equal(b.rapports.length,0,'bibliothèque d’origine non modifiée');
const c2=creerRapport(c1.bibliotheque,{...saisie,objet:'Second'},'r2',J);assert.equal(c2.rapport.numero,'RI-2026-002');
b=supprimerRapport(c2.bibliotheque,'r1');assert.equal(b.prochain,3,'un numéro supprimé n’est jamais réutilisé');
assert.equal(creerRapport(b,saisie,'r3',J).rapport.numero,'RI-2026-003');
const m=modifierRapport(c2.bibliotheque,'r1',{...saisie,objet:'Objet modifié'},J);assert.equal(m.rapports[0].objet,'Objet modifié');assert.equal(m.rapports[0].numero,'RI-2026-001');
const sg=signerRapport(m,'r1',{image:PNG,nom:'Client',signeLe:J},J);assert.equal(sg.rapports[0].signature.nom,'Client');
assert.throws(()=>modifierRapport(sg,'r1',saisie,J),/signé/);
assert.throws(()=>signerRapport(sg,'r1',{image:PNG,nom:'Autre',signeLe:J},J),/déjà signé/);
assert.throws(()=>signerRapport(m,'r1',{image:PNG,nom:'C',signeLe:'2026-10-29'},J),/précéder/);
assert.throws(()=>modifierRapport(m,'inconnu',saisie,J),/introuvable/);assert.throws(()=>supprimerRapport(m,'inconnu'),/introuvable/);
assert.equal(m.rapports[0].signature,undefined,'l’ancienne bibliothèque n’est pas modifiée');
// Limites et relecture.
assert.throws(()=>creerRapport({version:0,prochain:501,rapports:Array.from({length:500},(_,i)=>({...c1.rapport,id:'i'+i,numero:'RI-2026-'+String(i+1).padStart(3,'0')}))},saisie,'z',J),/Limite/);
assert.deepEqual(validerRapports(JSON.parse(JSON.stringify(sg)),J),sg);
for(const mauvais of [null,{},{version:0,prochain:0,rapports:[]},{version:0,prochain:1,rapports:'x'},{version:0,prochain:3,rapports:[c1.rapport,c1.rapport]},{version:0,prochain:3,rapports:[{...c1.rapport,numero:'X-1'}]},{version:0,prochain:3,rapports:[{...c1.rapport,id:'__proto__'}]}])assert.throws(()=>validerRapports(mauvais,J));
console.log('Rapports d’intervention : quantités et heures exactes, textes et dates validés, signature PNG contrôlée, numéros jamais réutilisés, rapport signé figé, anciennes données non modifiées, limites et relecture contrôlées.');
