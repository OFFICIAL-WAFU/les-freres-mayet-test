// Contrôles des règles de rentabilité (src/lib/rentabilite.ts) — chiffres de la maquette validée le 05/11/2026.
import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const tr=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url=c=>'data:text/javascript;base64,'+Buffer.from(c).toString('base64');
const devis=url(tr('src/data/devis.ts'));
const m=await import(url(tr('src/lib/rentabilite.ts').replace('"@/data/devis"',JSON.stringify(devis))));
const R=m.REGLAGES_DEFAUT;
assert.deepEqual(R,{coefMilliemes:1600,coutHoraireCentimes:2500,tauxHoraireCentimes:5000});
// Valeurs par défaut d'une nouvelle ligne.
assert.deepEqual(m.coutVide(R),{achat:'',coef:'1,6',temps:'',taux:'50,00',auto:true,coutHoraire:2500});
// Prix calculé : 20,29 × 1,5 = 30,435 → 30,44 ; + 1 h × 50 = 80,44.
const c=(achat,coef,temps,taux='50',auto=true)=>({achat,coef,temps,taux,auto,coutHoraire:2500});
assert.equal(m.prixCalcule(c('20,29','1,5','1')),8044n);
assert.equal(m.prixCalcule(c('32,59','1,5','1,5')),12389n);
assert.equal(m.prixCalcule(c('882,75','1,5','4')),152413n);
assert.equal(m.prixCalcule(c('','1,6','')),null);
assert.equal(m.prixCalcule(c('','1,6','0,5')),2500n); // prestation : temps seul
assert.equal(m.prixCalcule(c('10','1,6','')),1600n);
// Saisies invalides.
assert.ok(m.analyserCout(c('abc','1,6','')).erreurs.achat);assert.ok(m.analyserCout(c('1','','')).erreurs.coef);
assert.ok(m.analyserCout(c('1','1,6','1,555')).erreurs.temps);assert.ok(m.analyserCout(c('1,234','1,6','')).erreurs.achat);
assert.equal(m.analyserCout(c('20,29 €','1,6','')).valeur.achat,2029n);
// Temps : 0,33 h = 20 min ; 1,25 h = 75 min ; affichage retour.
assert.equal(m.analyserCout(c('','1','0,33')).valeur.minutes,20n);assert.equal(m.analyserCout(c('','1','1,25')).valeur.minutes,75n);
assert.equal(m.texteTemps(90),'1,5');assert.equal(m.texteTemps(20),'0,33');assert.equal(m.texteTemps(240),'4');
// Devis de la maquette.
const L=(designation,quantite,prix,cout)=>({cle:designation,articleId:null,type:'materiel',reference:'',designation,description:'',unite:'u',quantite,prix,taux:100,...(cout?{cout}:{})});
const lignes=[L('Prise',"6",'80,44',c('20,29','1,5','1')),L('Va-et-vient','4','123,89',c('32,59','1,5','1,5')),L('Tableau T4','1','1524,13',c('882,75','1,5','4')),L('Déchets','1','10,00')];
const a0=m.analyserLigne(lignes[0],R);
assert.deepEqual([a0.ht,a0.coutMateriel,a0.coutMainOeuvre,a0.venteMainOeuvre,a0.marge,a0.minutes],[48264n,12174n,15000n,30000n,21090n,360n]);
assert.equal(m.pourcentage(a0.marge,a0.ht),'43,7 %');
const r=m.rentabilite(lignes,R);
assert.deepEqual([r.coutMateriel,r.venteMateriel,r.coutMainOeuvre,r.venteMainOeuvre,r.cout,r.vente,r.marge,r.minutes],[113485n,170233n,40000n,80000n,153485n,250233n,96748n,960n]);
assert.equal(m.pourcentage(r.marge,r.vente),'38,7 %');assert.equal(m.pourcentage(r.venteMateriel-r.coutMateriel,r.venteMateriel),'33,3 %');
assert.deepEqual([r.lignesSansCout,r.htSansCout,r.lignesConnues],[1,1000n,3]);
// Prix manuel inférieur au coût : marge négative, pas de correction automatique.
const perte=m.analyserLigne(L('Remise','1','10,00',c('20','1,6','','50',false)),R);assert.equal(perte.marge,-1000n);assert.equal(m.pourcentage(-1000n,1000n),'-100,0 %');
// Vente de main-d'œuvre plafonnée au prix de la ligne.
const p2=m.analyserLigne(L('MO','1','10,00',c('','1','1','50',false)),R);assert.deepEqual([p2.venteMainOeuvre,p2.venteMateriel],[1000n,0n]);
// Le coût horaire figé sur la ligne prime sur le réglage actuel.
const fige=m.analyserLigne(L('X','1','100',{...c('','1','1'),coutHoraire:3000}),R);assert.equal(fige.coutMainOeuvre,3000n);
// modifierCout : le prix suit le calcul en mode automatique, pas en mode manuel.
let l=m.modifierCout(L('Prise','1','12,00'),{achat:'20,29',coef:'1,5',temps:'1'},R);assert.equal(l.prix,'80,44');
l=m.modifierCout({...l,cout:{...l.cout,auto:false}},{achat:'30'},R);assert.equal(l.prix,'80,44');
l=m.modifierCout(l,{auto:true},R);assert.equal(l.prix,'95,00');
// Catalogue : prix conservé tant que ni achat ni temps.
l=m.modifierCout(L('Article','1','42,00'),{coef:'2'},R);assert.equal(l.prix,'42,00');
// Aller-retour base de données.
const b=m.coutVersBase(c('20,29','1,5','1,5'),R);
assert.deepEqual(b,{prix_achat_centimes:'2029',coef_materiel_milliemes:'1500',temps_pose_minutes:'90',taux_horaire_centimes:'5000',cout_horaire_centimes:'2500',prix_calcule:true});
assert.deepEqual(m.coutDepuisBase({prix_achat_centimes:2029,coef_materiel_milliemes:1500,temps_pose_minutes:90,taux_horaire_centimes:5000,cout_horaire_centimes:2500,prix_calcule:true}),c('20,29','1,5','1,5','50,00'));
assert.equal(m.coutDepuisBase({prix_achat_centimes:null,coef_materiel_milliemes:null,temps_pose_minutes:null,taux_horaire_centimes:null,prix_calcule:false}),undefined);
assert.equal(m.coutDepuisBase({}),undefined);
assert.equal(m.coutVersBase(undefined,R).prix_achat_centimes,'');
assert.throws(()=>m.coutVersBase(c('x','1',''),R));
// Ligne créée depuis le catalogue (07/11/2026) : prix d'achat repris, prix de vente du catalogue conservé.
// Tableau REXEL : achat 47,12, vente 75,39 = 47,12 × 1,6 arrondi → le prix suit le calcul.
assert.deepEqual(m.coutDepuisCatalogue(4712,7539,R),{achat:'47,12',coef:'1,6',temps:'',taux:'50,00',auto:true,coutHoraire:2500});
// Ancien article Khosmos : achat 2,77, vente fixée 7,20 ≠ 4,43 → prix du catalogue conservé (auto faux), marge calculée dessus.
const k=m.coutDepuisCatalogue(278,720,R);assert.equal(k.achat,'2,78');assert.equal(k.auto,false);
const lk={cle:'k',articleId:'x',type:'materiel',reference:'',designation:'Prise',description:'',unite:'piece',quantite:'2',prix:'7,20',taux:100,cout:k};
const ak=m.analyserLigne(lk,R);assert.deepEqual([ak.connu,ak.ht,ak.coutMateriel,ak.marge],[true,1440n,556n,884n]);
// Prix d'achat inconnu : coût vide, rien n'est inventé.
assert.deepEqual(m.coutDepuisCatalogue(null,1000,R),m.coutVide(R));
// Fil au mètre : 0,23 × 1,6 = 0,368 → 0,37.
assert.equal(m.coutDepuisCatalogue(23,37,R).auto,true);
console.log('Rentabilité des devis : tous les contrôles réussis');
