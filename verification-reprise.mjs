import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
// Règles pures de la reprise Khosmos (src/lib/reprise.ts) : affichage figé, modèles, connaissances transmises à l'IA.
const code=ts.transpileModule(fs.readFileSync('src/lib/reprise.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const m=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const doc={id:'1',type:'facture',reference:'8',date_document:'2026-05-14',client_id:null,client_nom:'Client',objet:'',total_ht_centimes:164576,total_tva_centimes:16458,total_ttc_centimes:181034,statut_source:'payed',date_echeance:null,reference_liee:'15',deja_regle_centimes:126724,lignes:[],source:{net_a_payer_centimes:126724}};
assert.equal(m.titreImporte(doc),'Facture n°8');
assert.equal(m.netAPayer(doc),126724,'facture avec acompte : net à payer conservé');
assert.equal(m.netAPayer({...doc,source:{}}),181034);
assert.equal(m.statutKhosmos('marked-as-signed'),'Signé');assert.equal(m.statutKhosmos('inconnu'),'inconnu');
assert.equal(m.dateFr('2026-05-14'),'14/05/2026');assert.equal(m.dateFr(null),'—');
assert.equal(m.quantiteFr(21.5),'21,5','une quantité décimale n’est jamais arrondie');
const docs=[doc,{...doc,id:'2',type:'devis',reference:'218',client_nom:'Christian Dugué'}];
assert.equal(m.filtrerImportes(docs,'dugue','tous').length,1,'recherche sans accents');
assert.equal(m.filtrerImportes(docs,'','facture').length,1);
const modele={id:'x',nom:'Chauffe-eau',metier:'plomberie',type_travaux:'',objet:'Remplacement',remarques:'',conditions_paiement:'',notes_usage:'',updated_at:'',
  lignes:[{articleId:'a',type:'materiel',reference:'KH-1',designation:'CHAUFFE-EAU',description:'200L',unite:'piece',quantite:'21.5',prix:'439.46',taux:100},
          {articleId:null,type:'materiel',reference:'',designation:'UNITÉ (à choisir)',description:'indication',unite:'piece',quantite:'1',prix:'',taux:null},
          {articleId:null,type:'prestation',reference:'',designation:'X',description:'',unite:'',quantite:'1',prix:'1',taux:77}]};
let n=0;const d=m.devisDepuisModeleTravaux(modele,'2026-11-04',()=>`c${++n}`);
assert.equal(d.clientId,'');assert.equal(d.date,'2026-11-04');assert.equal(d.validite,'');assert.equal(d.objet,'Remplacement');
assert.equal(d.lignes[0].prix,'439,46');assert.equal(d.lignes[0].quantite,'21,5');assert.equal(d.lignes[0].taux,100);assert.equal(d.lignes[0].cle,'c1');
assert.equal(d.lignes[1].prix,'');assert.equal(d.lignes[1].taux,null);assert.equal(d.lignes[2].taux,null,'taux inconnu jamais transmis');
const c=(statut,i,contenu='texte')=>({id:String(i),categorie:'tarif',metier:'general',titre:`T${i}`,contenu,statut,source:'',updated_at:''});
const ia=m.connaissancesPourIA([c('valide',1),c('a_valider',2),c('rejete',3),c('valide',4,'x'.repeat(5000))]);
assert.deepEqual(ia.map(x=>x.titre),['T1','T4'],'seules les fiches validées partent à l’IA');
assert.equal(ia[1].contenu.length,m.LIMITES_CONNAISSANCES_IA.contenu);
console.log('verification-reprise : 22 contrôles réussis');
