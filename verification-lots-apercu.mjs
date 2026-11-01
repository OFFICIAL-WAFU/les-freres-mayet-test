import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';import React from 'react';
import pdfMake from 'pdfmake/build/pdfmake.js';import fonts from 'pdfmake/build/vfs_fonts.js';
const require=createRequire(import.meta.url),reactURL=pathToFileURL(require.resolve('react')).href;
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}}).outputText).toString('base64');
const lire=p=>fs.readFileSync(p,'utf8');
function extraire(p,noms){const texte=lire(p),arbre=ts.createSourceFile(p,texte,ts.ScriptTarget.Latest,true);return arbre.statements.filter(s=>ts.isFunctionDeclaration(s)&&noms.includes(s.name?.text)||ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>noms.includes(d.name.getText(arbre)))).map(s=>s.getText(arbre)).join('\n');}
const imports={
 '@/data/catalogue':extraire('src/data/catalogue.ts',['TYPE_ARTICLE_LABELS','UNITE_LABELS']),
 '@/data/entreprise':extraire('src/data/entreprise.ts',['formaterCapital','formaterIban']),
 '@/data/devis':lire('src/data/devis.ts'),
 '@/data/deduction':lire('src/data/deduction.ts'),
 '@/lib/lots':lire('src/lib/lots.ts')};
function adapter(code){for(const [nom,source]of Object.entries(imports))code=code.replaceAll(JSON.stringify(nom),JSON.stringify(url(source))).replaceAll("'"+nom+"'",JSON.stringify(url(source)));return code.replaceAll("from 'react'",`from ${JSON.stringify(reactURL)}`);}
const {definitionDevis}=await import(url(adapter(lire('src/lib/devisPdf.ts'))));
const {DevisApercu}=await import(url(`import React from ${JSON.stringify(reactURL)};\n`+adapter(lire('src/components/DevisApercu.tsx'))));
const ent={raisonSociale:'Entreprise TEST',nomCommercial:'',activite:'',adresse:'2 rue TEST',complement:'',codePostal:'85000',ville:'Testville',pays:'France',telephone:'',email:'',site:'',formeJuridique:'SARL',capital:'',siret:'',tva:'',immatriculation:'',iban:'',bic:'',assureur:'',contratAssurance:'',codeNaf:'',regimeTva:'',bandeau:'',logo:'',cgv:''};
const ligne=(cle,lot,prix,unite='forfait')=>({cle,type:'prestation',reference:'',designation:'Service TEST '+cle,description:`Lot : ${lot}\nUnité source : ${unite==='forfait'?'Ens':'U'}\nDescription publique ${cle}`,unite,quantite:'1',prix,taux:100});
const d={clientId:'TEST',client:{nom:'Client TEST',telephone:'',email:'',adresse:['1 rue TEST','85000 Testville']},objet:'Devis avec lots TEST',date:'2026-10-08',validite:'2026-11-08',remarques:'Remarque publique TEST',conditions:'Conditions TEST',lignes:[ligne('1','CUISINE','100.00'),ligne('2','CUISINE','50.00'),ligne('3','VENTILATION','582.76'),ligne('4','DIVERS','79.97','piece')]};
const html=renderToStaticMarkup(React.createElement(DevisApercu,{devis:d,numero:'BROUILLON-TEST',entreprise:ent}));
assert.equal((html.match(/colSpan="6"/gi)||[]).length,3);assert(!html.includes('Lot :'));assert(!html.includes('Unité source :'));assert(html.includes('Ens'));assert(html.includes('U'));assert(html.includes('812,73'));assert(html.includes('894,01'));
const definition=definitionDevis({...d,notes:'SECRET-INTERNE'},'BROUILLON-TEST',ent);
const corps=definition.content.find(c=>c.table?.headerRows===1).table.body;
assert.equal(corps.filter(row=>row[0]?.colSpan===6).length,3);
const texte=JSON.stringify(definition);assert(!texte.includes('SECRET-INTERNE'));assert(!texte.includes('Lot :'));assert(!texte.includes('Unité source :'));assert(texte.includes('894,01'));
const sansLot={...d,lignes:[{...d.lignes[0],description:'Description normale'}]};assert(!renderToStaticMarkup(React.createElement(DevisApercu,{devis:sansLot,numero:'TEST',entreprise:ent})).includes('colSpan="6"'));
const buffer=await new Promise(resolve=>pdfMake.createPdf(definition,undefined,undefined,fonts.pdfMake?.vfs??fonts).getBuffer(resolve));
assert(Buffer.from(buffer).subarray(0,5).toString()==='%PDF-');fs.writeFileSync('../outputs/Devis-lots-validation-TEST.pdf',buffer);
console.log('Aperçu ordinateur/téléphone rendu et PDF généré : 3 lots, 4 lignes, unités Ens/U, descriptions nettoyées, total 894,01 €, aucun texte interne ; document sans lot inchangé.');

