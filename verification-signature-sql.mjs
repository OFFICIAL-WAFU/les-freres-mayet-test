import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const D1='aaaaaaaa-0000-4000-8000-000000000001',D2='aaaaaaaa-0000-4000-8000-000000000002',D3='aaaaaaaa-0000-4000-8000-000000000003';
const T1='A'.repeat(43),T2='B'.repeat(43),T3='C'.repeat(43);
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const rap=[];const ok=m=>rap.push(m);
const q=(s,p)=>db.query(s,p);
const rej=(s,p,re)=>assert.rejects(()=>q(s,p),re);
try {
 await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${A}'),('${B}');`);
 // Reproduction minimale des tables du devis (les vraies sont dans Lovable).
 await db.exec(`create table public.devis(id uuid primary key,owner_id uuid not null,reference text not null,reference_definitive text,statut text not null,client_id uuid,client_copie jsonb not null default '{}',objet text not null,date_devis date not null,date_validite date,remarques text not null default '',conditions_paiement text not null default '',total_ht_centimes bigint not null,total_tva_centimes bigint not null,total_ttc_centimes bigint not null,ventilation_tva jsonb not null default '[]',entreprise_copie jsonb);
  create table public.devis_lignes(id uuid primary key default gen_random_uuid(),owner_id uuid,devis_id uuid not null references public.devis(id),position int,type text,article_id uuid,reference text,designation text,description text,unite text,quantite_milliemes bigint,prix_ht_centimes bigint,taux_tva_milliemes int,ht_centimes bigint,tva_centimes bigint,ttc_centimes bigint);
  insert into public.devis(id,owner_id,reference,reference_definitive,statut,client_id,client_copie,objet,date_devis,total_ht_centimes,total_tva_centimes,total_ttc_centimes,entreprise_copie) values
   ('${D1}','${A}','BROUILLON-1','DEV-LFM-2026-00001','finalise','${B}','{"nom":"Client EXEMPLE","adresse":["1 rue Test"]}','Pose tableau','2026-10-30',10000,2000,12000,'{"raison_sociale":"Entreprise EXEMPLE"}'),
   ('${D2}','${A}','BROUILLON-2',null,'brouillon',null,'{}','Brouillon','2026-10-30',0,0,0,null),
   ('${D3}','${B}','BROUILLON-3','DEV-LFM-2026-00002','finalise',null,'{}','Autre compte','2026-10-30',0,0,0,'{}');
  insert into public.devis_lignes(devis_id,position,type,designation,quantite_milliemes,prix_ht_centimes,taux_tva_milliemes,ht_centimes,tva_centimes,ttc_centimes) values('${D1}',1,'article','Tableau 3 rangées',1000,10000,200,10000,2000,12000);
  grant select on public.devis, public.devis_lignes to authenticated;`);
 await db.exec(fs.readFileSync('supabase/en-attente/20261101150000_signature_devis_distante.sql','utf8'));ok('Migration installée sans erreur dans une base temporaire');
 const owner=async u=>db.exec(`reset role;set role authenticated;set app.user_id='${u}';`);
 const anon=async()=>db.exec(`reset role;set role anon;set app.user_id='';`);
 const root=async()=>db.exec('reset role');

 // Création de lien par le propriétaire.
 await owner(A);
 const c=(await q('select public.creer_lien_signature($1,$2,30) as r',[D1,T1])).rows[0].r;assert.ok(c.id&&c.expire_le);
 await root();
 const stock=(await q('select to_jsonb(s)::text as t from public.signatures_devis s')).rows[0].t;
 assert.ok(!stock.includes(T1),'le jeton n’est jamais stocké');assert.match(JSON.stringify(stock),/jeton_hash/);ok('Lien créé ; seule l’empreinte SHA-256 du jeton est stockée');
 await owner(A);
 await rej('select public.creer_lien_signature($1,$2,30)',[D2,T2],/devis_non_finalise/);
 await rej('select public.creer_lien_signature($1,$2,30)',[D3,T2],/devis_introuvable/);
 await rej('select public.creer_lien_signature($1,$2,30)',[D1,'court'],/jeton_invalide/);
 await rej('select public.creer_lien_signature($1,$2,0)',[D1,T2],/validite_invalide/);
 await rej('select public.creer_lien_signature($1,$2,91)',[D1,T2],/validite_invalide/);
 await owner(B);await rej('select public.creer_lien_signature($1,$2,30)',[D1,T2],/devis_introuvable/);
 await anon();await rej('select public.creer_lien_signature($1,$2,30)',[D1,T2],/permission denied/);
 ok('Création refusée : brouillon, devis d’un autre compte, jeton ou durée invalides, compte anonyme');

 // Lecture par le client (anonyme).
 await anon();
 const lu=(await q('select public.lire_devis_pour_signature($1) as r',[T1])).rows[0].r;
 assert.equal(lu.etat,'ouvert');assert.equal(lu.devis.reference,'DEV-LFM-2026-00001');assert.equal(lu.devis.total_ttc_centimes,12000);assert.equal(lu.devis.lignes.length,1);
 const txt=JSON.stringify(lu);for(const interdit of ['owner_id',A,B,'client_id','jeton','article_id'])assert.ok(!txt.includes(interdit),`fuite : ${interdit}`);
 for(const t of [T2,'x','', ' '.repeat(50)])assert.equal((await q('select public.lire_devis_pour_signature($1) as r',[t])).rows[0].r.etat,'introuvable');
 assert.equal((await q('select public.lire_devis_pour_signature(null) as r')).rows[0].r.etat,'introuvable');
 ok('Client anonyme : lit uniquement le contenu du devis (aucun identifiant interne) ; jeton inconnu ou malformé = « introuvable »');
 await rej('select * from public.signatures_devis',[],/permission denied/);await rej('select * from public.devis',[],/permission denied/);
 await owner(A);await rej('select jeton_hash from public.signatures_devis',[],/permission denied/);
 assert.equal((await q('select count(*)::int n from public.signatures_devis')).rows[0].n,1);
 await owner(B);assert.equal((await q('select count(*)::int n from public.signatures_devis')).rows[0].n,0);
 ok('Anonyme : aucun accès aux tables ; empreinte du jeton illisible même pour le propriétaire ; autre compte : aucune ligne');

 // Signature.
 await anon();
 const s=(a=[T1,'Paul Testdurand',PNG,true,'Mozilla'])=>q('select public.signer_devis_distant($1,$2,$3,$4,$5) as r',a);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'Paul',PNG,false,''],/accord_requis/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'Paul',PNG,null,''],/accord_requis/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'P',PNG,true,''],/nom_invalide/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'  ',PNG,true,''],/nom_invalide/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'Paul',"data:image/jpeg;base64,AAAA",true,''],/image_invalide/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'Paul','<script>',true,''],/image_invalide/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'Paul','data:image/png;base64,'+'A'.repeat(250000),true,''],/image_invalide/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T2,'Paul',PNG,true,''],/lien_invalide/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',['x',  'Paul',PNG,true,''],/lien_invalide/);
 ok('Signature refusée sans « bon pour accord », avec nom ou image invalide, ou avec un jeton inconnu');
 const r=(await s()).rows[0].r;assert.equal(r.etat,'signe');assert.match(r.empreinte,/^[0-9a-f]{64}$/);
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1,'Autre',PNG,true,''],/deja_signe/);
 const apres=(await q('select public.lire_devis_pour_signature($1) as r',[T1])).rows[0].r;assert.equal(apres.etat,'signe');assert.equal(apres.signataire_nom,'Paul Testdurand');assert.equal(apres.empreinte,r.empreinte);
 await root();
 const calc=(await q('select public.signature_empreinte(public.signature_projection($1)) e',[D1])).rows[0].e;assert.equal(calc,r.empreinte,'l’empreinte correspond au contenu du devis');
 ok('Signature enregistrée une seule fois, avec l’empreinte exacte du contenu du devis ; seconde tentative refusée');

 // Figée.
 await rej('update public.signatures_devis set signataire_nom=$1',['Pirate'],/signature_figee/);
 await rej('delete from public.signatures_devis',[],/signature_figee/);
 await owner(A);
 await rej('select public.creer_lien_signature($1,$2,30)',[D1,T3],/deja_signe/);
 const id=(await q('select id from public.signatures_devis')).rows[0].id;
 await rej('select public.revoquer_lien_signature($1)',[id],/signature_figee/);
 await rej('update public.signatures_devis set signataire_nom=$1',['x'],/permission denied/);
 ok('Signature figée : modification, suppression, nouveau lien et révocation impossibles, même en administrateur');

 // Révocation, remplacement, expiration (devis 3 de l'autre compte).
 await db.exec(`reset role;update public.devis set statut='finalise' where id='${D3}'`);
 await owner(B);
 const l1=(await q('select public.creer_lien_signature($1,$2,30) r',[D3,T2])).rows[0].r;
 const l2=(await q('select public.creer_lien_signature($1,$2,30) r',[D3,T3])).rows[0].r;
 await anon();
 assert.equal((await q('select public.lire_devis_pour_signature($1) r',[T2])).rows[0].r.etat,'revoque');
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T2,'Paul',PNG,true,''],/lien_revoque/);
 assert.equal((await q('select public.lire_devis_pour_signature($1) r',[T3])).rows[0].r.etat,'ouvert');
 ok('Un nouveau lien révoque automatiquement l’ancien ; le lien révoqué ne peut ni être lu ni signer');
 await owner(A);await rej('select public.revoquer_lien_signature($1)',[l2.id],/lien_introuvable/);
 await owner(B);await q('select public.revoquer_lien_signature($1)',[l2.id]);
 await anon();assert.equal((await q('select public.lire_devis_pour_signature($1) r',[T3])).rows[0].r.etat,'revoque');
 await owner(B);const l3=(await q('select public.creer_lien_signature($1,$2,1) r',[D3,T1+'x'])).rows[0].r;
 await db.exec(`reset role;update public.signatures_devis set expire_le=now()-interval '1 minute' where id='${l3.id}'`);
 await anon();assert.equal((await q('select public.lire_devis_pour_signature($1) r',[T1+'x'])).rows[0].r.etat,'expire');
 await rej('select public.signer_devis_distant($1,$2,$3,$4,$5)',[T1+'x','Paul',PNG,true,''],/lien_expire/);
 ok('Révocation par le seul propriétaire ; lien expiré refusé en lecture et en signature');

 // Le devis reste intact.
 await root();
 assert.equal((await q("select count(*)::int n from public.devis where id=$1 and statut='finalise' and total_ttc_centimes=12000",[D1])).rows[0].n,1);
 const fonctions=(await q("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('signature_projection','signature_empreinte')")).rows.length;assert.equal(fonctions,2);
 await anon();await rej('select public.signature_projection($1)',[D1],/permission denied/);
 ok('Le devis signé n’est pas modifié ; les fonctions internes ne sont pas appelables par un client anonyme');
 console.log(rap.join('\n'));
} catch(e){console.error(e.message,e.code||'');process.exitCode=1;} finally {await db.close();}
