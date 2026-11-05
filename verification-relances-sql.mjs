// Contrôle de la migration 20261106090000_relances_devis.sql dans une base temporaire (PGlite).
import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const q=(s,p)=>db.query(s,p);const rej=(s,p,re)=>assert.rejects(()=>q(s,p),re);
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
const DF='aaaaaaaa-0000-0000-0000-00000000000f',DB='aaaaaaaa-0000-0000-0000-00000000000b',DX='aaaaaaaa-0000-0000-0000-00000000000c';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
insert into auth.users values('${A}'),('${B}');
create table public.devis(id uuid primary key, owner_id uuid not null, statut text not null);
insert into public.devis values ('${DF}','${A}','finalise'),('${DB}','${A}','brouillon'),('${DX}','${B}','finalise');`);
await db.exec(fs.readFileSync('supabase/en-attente/20261106090000_relances_devis.sql','utf8'));
const as=u=>q(`select set_config('test.uid','${u}',false)`);
const mod=(v,m)=>q('select public.modifier_messages($1,$2::jsonb) r',[v,JSON.stringify(m)]).then(x=>x.rows[0].r);
const env=(id,d,nature,canal='gmail')=>q('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8) r',[id,d,nature,canal,' client@exemple.fr ','Suivi',true,true]).then(x=>x.rows[0].r);
const u=n=>`bbbbbbbb-0000-0000-0000-${String(n).padStart(12,'0')}`;
await as(A);
// Modèles : création, mise à jour, conflit, validation.
let r=await mod(0,{rappelDevis:{sujet:'S',texte:'T'}});assert.equal(r.version,1);
r=await mod(1,{rappelDevis:{sujet:'S2',texte:'T'}});assert.equal(r.version,2);assert.equal(r.modeles.rappelDevis.sujet,'S2');
await rej(`select public.modifier_messages(1,'{}')`,[],/conflit_version/);
await rej(`select public.modifier_messages(0,'{}')`,[],/conflit_version/);
await rej(`select public.modifier_messages(2,'[]')`,[],/donnees_invalides/);
await rej(`select public.modifier_messages(-1,'{}')`,[],/version_invalide/);
// Envois : idempotence, ordre des relances, unicité, devis finalisé et propriétaire.
let e=await env(u(1),DF,'envoi');assert.equal(e.destinataire,'client@exemple.fr');assert.equal(e.avec_pdf,true);
assert.equal((await env(u(1),DF,'envoi')).id,u(1));
await rej('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8)',[u(2),DF,'relance2','gmail','','',false,false],/relance1_requise/);
await env(u(3),DF,'relance1','aucun');
await rej('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8)',[u(4),DF,'relance1','gmail','','',false,false],/deja_relance/);
await env(u(5),DF,'relance2');
await env(u(6),DF,'envoi','messagerie'); // plusieurs envois du devis autorisés
await rej('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8)',[u(7),DB,'envoi','gmail','','',false,false],/devis_non_finalise/);
await rej('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8)',[u(8),DX,'envoi','gmail','','',false,false],/devis_non_finalise/);
await rej('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8)',[u(9),DF,'autre','gmail','','',false,false],/check/);
assert.equal(Number((await q('select count(*) n from public.envois_devis')).rows[0].n),4);
// Autre compte : ne relit pas l'envoi d'un autre (identifiant réutilisé refusé), modèles séparés.
await as(B);
await rej('select public.noter_envoi_devis($1,$2,$3,$4,$5,$6,$7,$8)',[u(1),DX,'envoi','gmail','','',false,false],/non_autorise/);
assert.equal((await mod(0,{})).version,1);
// Sans connexion : refus.
await q(`select set_config('test.uid','',false)`);
await rej(`select public.modifier_messages(0,'{}')`,[],/connexion_requise/);
console.log('Migration relances des devis : tous les contrôles réussis');
