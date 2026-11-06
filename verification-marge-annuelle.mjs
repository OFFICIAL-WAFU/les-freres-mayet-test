import assert from 'node:assert/strict';
import {createServer} from 'vite';
const srv=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',configFile:'vite.config.ts'});
const {margeAnnuelle}=await srv.ssrLoadModule('/src/lib/activite-annuelle.ts');
const cout=(achat,temps)=>({achat,coef:'1,6',temps,taux:'50,00',auto:true,coutHoraire:2500});
const devis={id:'D1',type:'devis',statut:'Finalisé',devis:{lignes:[
 {cle:'a',type:'article',designation:'Tableau',unite:'piece',quantite:'1',prix:'160,00',taux:200,cout:cout('100,00','')},
 {cle:'b',type:'article',designation:'Pose',unite:'heure',quantite:'2',prix:'50,00',taux:200,cout:cout('','1')},
 {cle:'c',type:'article',designation:'Divers',unite:'piece',quantite:'1',prix:'40,00',taux:200}]}};
const fac={id:'F1',type:'facture',statut:'Finalisé',date:'15/10/2026',devisSource:{id:'D1',reference:'x'},montantHTCentimes:30000n};
const r=margeAnnuelle([devis,fac],'2026-11-06');
// ligne a : vente 160, coût 100 → 60 ; ligne b : 2 h × (vente 50, coût 25) → vente 100, coût 50 → 50 ; ligne c sans coût 40
assert.equal(r.totalMarge,11000n);assert.equal(r.totalVentes,26000n);assert.equal(r.totalSansCout,4000n);assert.equal(r.couverture,86);assert.equal(r.marge[9],11000n);
assert.equal(margeAnnuelle([devis,{...fac,devisSource:undefined}],'2026-11-06').totalVentes,0n);
assert.equal(margeAnnuelle([devis,{...fac,date:'15/10/2025'}],'2026-11-06').totalMarge,0n);
console.log('Marge annuelle : contrôles réussis');await srv.close();
