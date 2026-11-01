import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// Les migrations initiales clients/devis ne sont pas dans l'export Lovable.
// Leur structure est reconstruite à partir des types exportés. Les migrations
// de facturation testées ci-dessous restent celles de l'application, sans stub.
const db = new PGlite();
const uid='11111111-1111-4111-8111-111111111111', autre='22222222-2222-4222-8222-222222222222';
const client='33333333-3333-4333-8333-333333333333', clientAutre='44444444-4444-4444-8444-444444444444';
const id='55555555-5555-4555-8555-555555555555';
const types=fs.readFileSync('src/integrations/supabase/types.ts','utf8');
const resultats=[];
try {
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create function public.clients_horodatage() returns trigger language plpgsql as $$begin NEW.updated_at:=now();return NEW;end$$;`);
 for(const table of ['clients','articles','entreprises','devis','devis_lignes','compteurs_devis','compteurs_references']) {
  const row=types.match(new RegExp(`      ${table}: \\{\\s+Row: \\{([\\s\\S]*?)\\n        \\}`))[1];
  const colonnes=[...row.matchAll(/^          (\w+): (.+)$/gm)].filter(m=>m[1]!=='conditions_paiement').map(([,nom,type])=>{
   let sql,def;
   if(nom==='id'||nom.endsWith('_id')||nom==='finalise_par') {sql='uuid';def=nom==='id'?'gen_random_uuid()':nom==='owner_id'?'auth.uid()':undefined;}
   else if(type.includes('Json')) {sql='jsonb';def=nom==='ventilation_tva'?"'[]'::jsonb":undefined;}
   else if(type.includes('number')) {sql=nom==='capital'?'numeric(15,2)':'bigint';def=nom==='version'?'1':'0';}
   else if(type==='boolean') {sql='boolean';def='false';}
   else if(nom.endsWith('_at')||nom==='finalise_le') {sql='timestamptz';def=nom.endsWith('_at')?'now()':undefined;}
   else if(nom.startsWith('date_')) {sql='date';}
   else {sql='text';def=nom==='statut'?"'brouillon'":type.includes('null')?undefined:"''";}
   return `${nom} ${sql}${def?` default ${def}`:''}${nom==='id'||table==='compteurs_devis'&&nom==='owner_id'?' primary key':''}`;
  });
  if(table==='entreprises')colonnes.push('unique(owner_id)');
  if(table==='compteurs_references')colonnes.push('unique(owner_id,type_document,annee)');
  await db.exec(`create table public.${table}(${colonnes.join(',')});grant select,insert,update,delete on public.${table} to authenticated;`);
 }
 await db.exec(`create function public.lire_devis(p_id uuid) returns jsonb language sql as $$select to_jsonb(d) from public.devis d where id=p_id and owner_id=auth.uid()$$;`);
 for(const fichier of fs.readdirSync('supabase/migrations').filter(f=>f<'20261007160000'&&f.endsWith('.sql')).sort()) {
  try {await db.exec(fs.readFileSync(`supabase/migrations/${fichier}`,'utf8'));} catch(e){throw new Error(`${fichier}: ${e.message}`);}
 }
 await db.exec(fs.readFileSync('supabase/migrations/20261007170000_factures_directes.sql','utf8'));
 resultats.push('Migrations de facturation et extension directe installées dans PostgreSQL temporaire.');
 await db.exec(`insert into clients(id,owner_id,type,prenom,nom,adresse,code_postal,ville,pays) values('${client}','${uid}','particulier','Test','Client','1 rue Test','85000','Testville','France'),('${clientAutre}','${autre}','particulier','Autre','Compte','1 rue Test','85000','Testville','France');insert into entreprises(owner_id,raison_sociale,adresse,code_postal,ville,pays)values('${uid}','Entreprise TEST','2 rue Test','85000','Testville','France');set role authenticated;set app.user_id='${uid}';`);
 const payload={client_id:client,objet:'Facture directe TEST',date_facture:'2026-10-07',date_echeance:'2026-11-07',conditions_paiement:'Conditions TEST',prestation_debut:'2026-10-01',prestation_fin:'2026-10-07',notes:'INTERNE',lignes:[{id:'66666666-6666-4666-8666-666666666666',type:'prestation',designation:'Service TEST',unite:'heure',quantite_milliemes:1500,prix_ht_centimes:6050,taux_tva_milliemes:100},{id:'77777777-7777-4777-8777-777777777777',type:'materiel',designation:'Matériel TEST',unite:'piece',quantite_milliemes:1000,prix_ht_centimes:4550,taux_tva_milliemes:200}]};
 const creer=async (identifiant,p)=> (await db.query('select enregistrer_facture_directe($1::uuid,$2::jsonb) as d',[identifiant,JSON.stringify(p)])).rows[0].d;
 let f=await creer(id,payload);
 assert.equal(f.devis_source_id,null); assert.equal(f.total_ht_centimes,13625);assert.equal(f.total_tva_centimes,1818);assert.equal(f.total_ttc_centimes,15443);
 assert.equal(f.conditions_paiement,'Conditions TEST');assert.equal(f.client_copie.nom,'Test Client');
 resultats.push('Brouillon sans devis : client figé, 136,25 € HT, 18,18 € TVA, 154,43 € TTC, dates et conditions conservées.');
 const compteur=async()=> (await db.query('select dernier from compteurs_factures_brouillon where owner_id=auth.uid()')).rows[0].dernier;
 assert.equal(await compteur(),1);
 assert.equal((await db.query('select facture_directe_disponible() as disponible')).rows[0].disponible,true);
 assert.equal(await compteur(),1);
 assert.equal((await creer(id,payload)).id,id);assert.equal(await compteur(),1);
 resultats.push('Même tentative répétée : même brouillon, compteur inchangé.');
 await assert.rejects(creer('88888888-8888-4888-8888-888888888888',{...payload,client_id:clientAutre}),/client_non_autorise/);
 await assert.rejects(creer('88888888-8888-4888-8888-888888888888',{...payload,lignes:[]}),/lignes_requises/);
 assert.equal(await compteur(),1);resultats.push('Client d’un autre compte et lignes vides refusés ; transaction annulée sans consommer de numéro.');
 await assert.rejects(db.query('select enregistrer_facture($1::uuid,999,$2::jsonb)',[id,JSON.stringify(payload)]),/conflit_version/);
 await assert.rejects(db.query('update factures set client_id=$1 where id=$2',[clientAutre,id]),/rattachement_facture_immuable/);
 f=(await db.query('select finaliser_facture($1::uuid,$2::integer) as d',[id,f.version])).rows[0].d;
 assert.equal(f.statut,'finalise');assert.equal(f.deduction,null);assert.equal(f.entreprise_copie.raison_sociale,'Entreprise TEST');
 const ref=f.reference_definitive;
 assert.equal((await db.query('select finaliser_facture($1::uuid,$2::integer) as d',[id,1])).rows[0].d.reference_definitive,ref);
 await assert.rejects(db.query('update factures set objet=\'Changement\' where id=$1',[id]),/finalis|verrouill|immuable/);
 resultats.push('Finalisation avec numéro FAC et entreprise figée ; répétition sans nouveau numéro ; modifications refusées.');
 await db.query("select enregistrer_reglement('99999999-9999-4999-8999-999999999999',$1::uuid,5000,'2026-10-07','virement','TEST')",[id]);
 await assert.rejects(db.query("select enregistrer_reglement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$1::uuid,20000,'2026-10-07','virement','TEST')",[id]),/reglement_depasse/);
 const avoir=(await db.query("select preparer_avoir($1::uuid,'Annulation TEST') as d",[id])).rows[0].d;
 assert.equal(avoir.total_ttc_centimes,15443);
 const avFinal=(await db.query('select finaliser_avoir($1::uuid,$2::integer) as d',[avoir.id,avoir.version])).rows[0].d;
 assert.equal(avFinal.statut,'finalise');assert.equal(avFinal.total_ttc_centimes,15443);
 await assert.rejects(db.query("select enregistrer_reglement('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$1::uuid,1,'2026-10-07','virement','TEST')",[id]));
 resultats.push('Facture directe compatible avec règlement partiel et avoir total ; dépassement et paiement après avoir refusés.');
 await db.exec(`set app.user_id='${autre}';`);
 await assert.rejects(creer(id,{...payload,client_id:clientAutre}));
 assert.equal((await db.query('select count(*)::int as n from factures')).rows[0].n,0);
 resultats.push('Autre compte : facture invisible et reprise de son identifiant refusée.');
 await db.exec("reset role;set role anon;set app.user_id='';");
 await assert.rejects(db.query('select facture_directe_disponible()'),/permission denied/);
 await assert.rejects(creer(id,payload),/permission denied/);
 resultats.push('Compte anonyme : création et sonde de disponibilité interdites.');
 console.log(resultats.join('\n'));
 fs.mkdirSync('../outputs',{recursive:true});
 fs.writeFileSync('../outputs/Validation-factures-directes.txt',resultats.join('\n')+'\nLimites : PostgreSQL PGlite temporaire, schémas initiaux reconstruits à partir des types. Pas de connexion Cloud, ni de test de concurrence entre connexions ; migration distante non installée.\n');
} finally {await db.close();}
