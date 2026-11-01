import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/lib/import-clients.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {lireCsv,analyserImportClients,MAX_LIGNES}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
let n=0;const id=()=>'id'+(++n);
// CSV : séparateurs, guillemets, BOM, CRLF, champs multi-lignes
assert.deepEqual(lireCsv('﻿a;b\r\n"x;y";"he said ""hi"""\r\n'),[['a','b'],['x;y','he said "hi"']]);
assert.deepEqual(lireCsv('a,b\n1,2'),[['a','b'],['1','2']]);assert.deepEqual(lireCsv('a;b\n"l1\nl2";z'),[['a','b'],['l1\nl2','z']]);assert.deepEqual(lireCsv('a;b\n\n;\n1;2'),[['a','b'],['1','2']]);
const ex=[{id:'e1',type:'particulier',prenom:'Léa',nom:'Testmartin',raisonSociale:'',email:'lea@test.fr',telephone:'06 11 22 33 44'}];
const H='type;prenom;nom;raison_sociale;telephone;email;siret;tva;adresse;complement;code_postal;ville;pays;notes;documents\n';
const csv=H+[
 'particulier;Alain;DUBOIS;;06 24 33 18 42;alain@x.fr;;;95 Chemin de la Plaine;;85440;Talmont;France;Importé;3',
 'entreprise;;;NATEA;01 02 03 04 05;n@x.fr;10830586300012;FR96108305863;140 Av;;49100;Angers;France;;1',
 'particulier;Léa;TESTMARTIN;;;;;;;;;;;;',            // doublon nom (accents/casse/ordre) avec existant
 'particulier;Autre;Personne;;+33 6 11 22 33 44;;;;;;;;;;',   // doublon téléphone existant
 'particulier;Zoé;Neuve;;;lea@test.fr;;;;;;;;;',        // doublon e-mail existant
 'particulier;Alain;DUBOIS;;;alain@x.fr;;;;;;;;;',       // doublon dans le fichier
 'particulier;;;;;;;;;;;;;;',                             // sans nom (ligne vide ignorée par le CSV si tout vide)
 'particulier;X;;;;;;;;;;;;;',                            // nom manquant
 'entreprise;;;;;;;;;;;;;;x',                             // raison sociale manquante
 'particulier;A;B;;;pasunmail;;;;;;;;;',                  // e-mail invalide
 'entreprise;;;SOC;;;123;;;;;;;;',                        // SIRET invalide
 'societe;;;;;;;;;;;;;;',                                 // type inconnu
 'particulier;'+'x'.repeat(101)+';Long;;;;;;;;;;;;',      // trop long
].join('\n');
const r=analyserImportClients(csv,ex,id);
const s=r.lignes.map(l=>l.statut);
assert.deepEqual(s,['nouveau','nouveau','doublon','doublon','doublon','doublon','invalide','invalide','invalide','invalide','invalide','invalide','invalide']);
assert.equal(r.lignes[0].client.pays,'France');assert.equal(r.lignes[0].documents,3);assert.equal(r.lignes[1].client.siret,'10830586300012');assert.equal(r.lignes[1].client.type,'entreprise');
assert.equal(r.lignes[2].doublonDe,'e1');assert.equal(r.lignes[3].doublonDe,'e1');assert.equal(r.lignes[4].doublonDe,'e1');assert.ok(r.lignes[5].avertissements.some(a=>/ligne 2 du fichier/.test(a)));
assert.ok(r.lignes[6].erreurs.some(e=>/Nom manquant/.test(e)));assert.ok(r.lignes[7].erreurs.some(e=>/Nom manquant/.test(e)));assert.ok(r.lignes[8].erreurs.some(e=>/Raison sociale/.test(e)));assert.ok(r.lignes[9].erreurs.some(e=>/E-mail invalide/.test(e)));assert.ok(r.lignes[10].erreurs.some(e=>/SIRET/.test(e)));assert.ok(r.lignes[11].erreurs.some(e=>/Type/.test(e)));assert.ok(r.lignes[12].erreurs.some(e=>/trop long/.test(e)));
assert.equal(new Set(r.lignes.map(l=>l.id)).size,r.lignes.length);
// Fichiers refusés
assert.match(analyserImportClients('',[]).erreur,/aucune ligne/);assert.match(analyserImportClients('foo;bar\n1;2',[]).erreur,/Colonnes non reconnues/);
assert.match(analyserImportClients(H+Array(MAX_LIGNES+1).fill('particulier;A;B;;;;;;;;;;;;').join('\n'),[]).erreur,/Trop de lignes/);
assert.match(analyserImportClients('x'.repeat(2_100_000),[]).erreur,/volumineux/);
// Colonnes inconnues signalées, ignorées ; injection de formule CSV non interprétée (donnée texte conservée telle quelle)
const k=analyserImportClients('type;nom;inconnu\nparticulier;=1+1;zzz',[],id);assert.deepEqual(k.colonnesIgnorees,['inconnu']);assert.equal(k.lignes[0].client.nom,'=1+1');
// Le vrai fichier préparé depuis l'export Khosmos
const p='/tmp/claude-0/-home-claude/adef9ac5-9661-554b-a334-06245cb74904/scratchpad/clients-khosmos.csv';
if(fs.existsSync(p)){const f=analyserImportClients(fs.readFileSync(p,'utf8'),[],id);assert.equal(f.lignes.length,99);assert.equal(f.lignes.filter(l=>l.statut==='invalide').length,0,JSON.stringify(f.lignes.filter(l=>l.statut==='invalide').map(l=>[l.numero,l.erreurs])));console.log('Fichier Khosmos préparé :',f.lignes.length,'clients,',f.lignes.filter(l=>l.statut==='doublon').length,'doublons probables dans le fichier');}
console.log('Import de clients : tous les contrôles réussis');
