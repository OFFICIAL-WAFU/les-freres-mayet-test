import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
import pdfMake from 'pdfmake/build/pdfmake.js';import fonts from 'pdfmake/build/vfs_fonts.js';
const url=c=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(c,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const lib=url(fs.readFileSync('src/lib/rapports.ts','utf8'));
let code=fs.readFileSync('src/lib/rapportPdf.ts','utf8').replace(/^import type .*$/gm,'').replace('"@/lib/rapports"',JSON.stringify(lib));
const {definitionRapport,nomFichierRapport}=await import(url(code));
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PHOTO=fs.existsSync('/tmp/photo-jpeg.txt')?fs.readFileSync('/tmp/photo-jpeg.txt','utf8'):null;
const ent={raisonSociale:'Entreprise EXEMPLE',nomCommercial:'',activite:'Électricité',adresse:'1 rue Test',complement:'',codePostal:'85520',ville:'Jard-sur-Mer',telephone:'0600000000',email:'a@example.com',siret:'00000000000000'};
const r={id:'r',numero:'RI-2026-001',creeLe:'2026-10-31',date:'2026-10-31',client:{nom:'Client EXEMPLE',telephone:'0600000000',adresse:'2 rue Test'},chantier:'',objet:'Remplacement tableau',travaux:'Dépose.\nPose.',observations:'RAS',materiel:[{designation:'Disjoncteur 20A',quantite:400,unite:'u'}],minutes:150,intervenant:'Baptiste',photos:[{image:'data:image/jpeg;base64,'+PNG.split(',')[1],legende:'Avant'},{image:'data:image/jpeg;base64,'+PNG.split(',')[1],legende:''},{image:'data:image/jpeg;base64,'+PNG.split(',')[1],legende:'Après'}],signature:{image:PNG,nom:'Client EXEMPLE',signeLe:'2026-10-31'}};
assert.equal(nomFichierRapport('RI-2026-001'),'Rapport_RI-2026-001.pdf');
for(const rap of [r,{...r,signature:undefined,photos:[],materiel:[],observations:''}]){
  const buf=await new Promise(res=>pdfMake.createPdf(definitionRapport(rap,ent),undefined,undefined,fonts.pdfMake?.vfs??fonts).getBuffer(res));
  assert.ok(Buffer.from(buf).subarray(0,4).toString()==='%PDF'&&buf.length>2000);
}
if(PHOTO){const buf=await new Promise(res=>pdfMake.createPdf(definitionRapport({...r,photos:[{image:PHOTO,legende:'Vraie photo JPEG'},{image:PHOTO,legende:''},{image:PHOTO,legende:'3'}]},ent),undefined,undefined,fonts.pdfMake?.vfs??fonts).getBuffer(res));assert.ok(Buffer.from(buf).subarray(0,4).toString()==='%PDF'&&buf.length>20000,'PDF avec vraie photo');}
console.log('PDF de rapport généré avec le moteur de l’application, avec et sans signature ni matériel.');
