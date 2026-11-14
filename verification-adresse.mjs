// Contrôles de la recherche d'adresse (src/lib/adresse.ts).
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const out=await build({entryPoints:['src/lib/adresse.ts'],bundle:true,write:false,format:'esm',platform:'node',alias:{'@':'./src'},logLevel:'silent'});
const {texteRecherche,urlRechercheAdresse,lireSuggestions}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
assert.equal(texteRecherche('12'),null);assert.equal(texteRecherche(' 12  rue '),'12 rue');assert.equal(texteRecherche('a'.repeat(200)).length,120);
const u=new URL(urlRechercheAdresse('12 rue des pins jard'));assert.equal(u.origin+u.pathname,'https://data.geopf.fr/geocodage/search');
assert.equal(u.searchParams.get('q'),'12 rue des pins jard');assert.equal(u.searchParams.get('autocomplete'),'1');assert.ok(u.searchParams.get('lat'));
assert.equal(urlRechercheAdresse('  '),null);
const f=(p)=>({properties:p});
const s=lireSuggestions({features:[
 f({type:'housenumber',name:'12 Rue des Pins',postcode:'85520',city:'Jard-sur-Mer',label:'12 Rue des Pins 85520 Jard-sur-Mer',context:'85, Vendée, Pays de la Loire'}),
 f({type:'municipality',name:'Jard-sur-Mer',postcode:'85520',city:'Jard-sur-Mer',label:'Jard-sur-Mer'}),
 f({type:'street',name:'Rue des Pins',postcode:'8552',city:'X',label:'bad'}),
 f({type:'housenumber',name:'12 Rue des Pins',postcode:'85520',city:'Jard-sur-Mer',label:'12 Rue des Pins 85520 Jard-sur-Mer'}),
]});
assert.equal(s.length,1,'commune seule, code postal faux et doublon écartés');assert.deepEqual([s[0].adresse,s[0].codePostal,s[0].ville],['12 Rue des Pins','85520','Jard-sur-Mer']);
assert.deepEqual(lireSuggestions(null),[]);assert.deepEqual(lireSuggestions({features:'x'}),[]);
console.log('Recherche d’adresse : tous les contrôles réussis');
