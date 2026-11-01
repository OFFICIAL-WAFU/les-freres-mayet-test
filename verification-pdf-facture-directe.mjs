import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import pdfMake from 'pdfmake/build/pdfmake.js';
import fonts from 'pdfmake/build/vfs_fonts.js';
const url=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const lire=p=>fs.readFileSync(p,'utf8');
// Extraction AST des vrais libellés et du vrai formateur, sans initialiser
// les abonnements React ni le connecteur Cloud pendant cette vérification.
function extraire(p,noms) {
 const texte=lire(p),arbre=ts.createSourceFile(p,texte,ts.ScriptTarget.Latest,true);
 return arbre.statements.filter(s=>ts.isFunctionDeclaration(s)&&noms.includes(s.name?.text)||ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>noms.includes(d.name.getText(arbre)))).map(s=>s.getText(arbre)).join('\n');
}
let code=lire('src/lib/devisPdf.ts');
for(const [nom,source] of Object.entries({
 '@\/data/catalogue':extraire('src/data/catalogue.ts',['TYPE_ARTICLE_LABELS','UNITE_LABELS']),
 '@\/data/entreprise':extraire('src/data/entreprise.ts',['formaterCapital']),
 '@\/data/devis':lire('src/data/devis.ts'),
 '@\/data/deduction':lire('src/data/deduction.ts'),
 '@\/lib/lots':lire('src/lib/lots.ts'),
})){const n=nom.replaceAll('\\/','/'),u=JSON.stringify(url(source));code=code.replace(JSON.stringify(n),u).replace("'"+n+"'",u);}
const {definitionDevis}=await import(url(code));
const ent={raisonSociale:'Entreprise TEST',nomCommercial:'',activite:'',adresse:'2 rue TEST',complement:'',codePostal:'85000',ville:'Testville',pays:'France',telephone:'',email:'',site:'',formeJuridique:'SARL',capital:'',siret:'',tva:'',immatriculation:''};
const d={clientId:'TEST',client:{nom:'Client TEST',telephone:'',email:'',adresse:['1 rue TEST','85000 Testville']},objet:'Facture directe TEST',date:'2026-10-07',validite:'2026-11-07',remarques:'Remarque publique TEST',conditions:'Conditions TEST',prestationDebut:'2026-10-01',prestationFin:'2026-10-07',lignes:[{cle:'1',type:'prestation',reference:'',designation:'Service TEST',description:'',unite:'heure',quantite:'1.5',prix:'60.50',taux:100},{cle:'2',type:'materiel',reference:'',designation:'Matériel TEST',description:'',unite:'piece',quantite:'1',prix:'45.50',taux:200}]};
const definition=definitionDevis(d,'FAC-LFM-2026-TEST',ent,false,{sourceRef:'',finalisee:true});
const avecNoteInterne=definitionDevis({...d,notes:'SECRET-INTERNE-NE-PAS-IMPRIMER'},'FAC-LFM-2026-TEST',ent,false,{sourceRef:'',finalisee:true});
assert(!JSON.stringify(avecNoteInterne).includes('SECRET-INTERNE-NE-PAS-IMPRIMER'));
const texte=JSON.stringify(definition);
assert(!texte.includes("Devis d'origine"));assert(!texte.includes('BROUILLON'));assert(texte.includes('Conditions TEST'));assert(texte.includes('154,43'));
const source=definitionDevis(d,'FAC-LFM-2026-TEST',ent,false,{sourceRef:'DEV-TEST',finalisee:true});
assert(JSON.stringify(source).includes("Devis d'origine"));assert(JSON.stringify(source).includes('DEV-TEST'));
const vfs=fonts.pdfMake?.vfs??fonts;
const buffer=await new Promise(resolve=>pdfMake.createPdf(definition,undefined,undefined,vfs).getBuffer(resolve));
assert(Buffer.from(buffer).subarray(0,5).toString()==='%PDF-');
fs.mkdirSync('../outputs',{recursive:true});
fs.writeFileSync('../outputs/Facture-directe-validation-TEST.pdf',buffer);
console.log('PDF fictif généré avec le moteur de l’application : total 154,43 €, dates et conditions ; aucun devis source vide ni mention brouillon. Document avec devis source toujours correctement référencé.');
