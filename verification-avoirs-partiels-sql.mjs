import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
// Vérifie la migration supabase/en-attente/20261101200000_avoirs_partiels.sql dans une base temporaire qui reproduit
// la structure RÉELLE de la base TEST (lue le 01/11/2026) : contraintes, déclencheur, politiques, compteurs.
const db=new PGlite();
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const F0='f0000000-0000-4000-8000-000000000000',F1='f1000000-0000-4000-8000-000000000001',F2='f2000000-0000-4000-8000-000000000002',F3='f3000000-0000-4000-8000-000000000003',FB='fb000000-0000-4000-8000-00000000000b',FD='fd000000-0000-4000-8000-00000000000d';
const L=(f,n)=>`c${n}${f.slice(0,2)}0000-0000-4000-8000-000000000000`;
const an=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Paris',year:'numeric'}).format(new Date()));
const rap=[];const ok=m=>rap.push(m);
const q=(s,p)=>db.query(s,p);
const rej=(s,p,re)=>assert.rejects(()=>q(s,p),re);
const as=async u=>db.exec(`reset role;set role authenticated;set app.user_id='${u}';`);
const root=async()=>db.exec('reset role');
const J=v=>JSON.stringify(v);
try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(`
  create table public.entreprises(id uuid primary key default gen_random_uuid(),owner_id uuid unique not null,raison_sociale text not null,created_at timestamptz default now(),updated_at timestamptz default now());
  create table public.factures(id uuid primary key,owner_id uuid not null,statut text not null,nature text not null default 'facture',deduction jsonb,acompte_deduit_id uuid,reference_definitive text,client_id uuid not null,client_copie jsonb not null default '{}',objet text not null default '',total_ht_centimes bigint not null default 0,total_tva_centimes bigint not null default 0,total_ttc_centimes bigint not null default 0,ventilation_tva jsonb not null default '[]');
  create table public.factures_lignes(id uuid primary key,owner_id uuid not null,facture_id uuid not null references public.factures(id),position int not null,type text not null default 'article',article_id uuid,reference text not null default '',designation text not null,description text not null default '',unite text not null default 'u',quantite_milliemes bigint not null,prix_ht_centimes bigint not null,taux_tva_milliemes int not null,ht_centimes bigint not null,tva_centimes bigint not null,ttc_centimes bigint not null);
  create table public.compteurs_references(owner_id uuid not null,type_document text not null,annee int not null,dernier int not null,primary key(owner_id,type_document,annee));
  create table public.compteurs_factures_brouillon(owner_id uuid primary key,dernier_avoir int not null default 0);
  create table public.avoirs(id uuid primary key default gen_random_uuid(),owner_id uuid not null,reference text not null,statut text not null default 'brouillon',facture_source_id uuid not null,facture_source_reference text not null,client_id uuid not null,client_copie jsonb not null,objet text not null,lignes jsonb not null,total_ht_centimes bigint not null,total_tva_centimes bigint not null,total_ttc_centimes bigint not null,ventilation_tva jsonb not null,date_avoir date not null,motif text not null,remarques text not null default '',version int not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reference_definitive text,entreprise_copie jsonb,finalise_le timestamptz,finalise_par uuid,
   constraint avoirs_facture_source_id_fkey foreign key(facture_source_id) references public.factures(id),constraint avoirs_facture_source_id_key unique(facture_source_id),constraint avoirs_motif_check check(btrim(motif)<>''),constraint avoirs_owner_id_reference_key unique(owner_id,reference),constraint avoirs_statut_check check(statut=any(array['brouillon','finalise'])));
  create function public.facture_credite(p_facture_id uuid) returns bigint language sql stable set search_path to 'public' as $$ select coalesce(sum(total_ttc_centimes),0)::bigint from public.avoirs where facture_source_id=p_facture_id and statut='finalise'; $$;
  create function public.avoirs_garde() returns trigger language plpgsql set search_path to 'public' as $f$ begin
   if current_setting('app.avoir',true) is distinct from new.id::text then raise exception 'avoir_via_operation' using errcode='42501'; end if;
   if tg_op='INSERT' and (new.statut<>'brouillon' or new.reference_definitive is not null or new.finalise_le is not null) then raise exception 'avoir_contenu_immuable' using errcode='42501'; end if;
   if tg_op='UPDATE' then
    if old.statut='finalise' then raise exception 'avoir_finalise' using errcode='42501'; end if;
    if (new.reference,new.facture_source_id,new.facture_source_reference,new.client_id,new.client_copie,new.objet,new.lignes,new.total_ht_centimes,new.total_tva_centimes,new.total_ttc_centimes,new.ventilation_tva) is distinct from (old.reference,old.facture_source_id,old.facture_source_reference,old.client_id,old.client_copie,old.objet,old.lignes,old.total_ht_centimes,old.total_tva_centimes,old.total_ttc_centimes,old.ventilation_tva) then raise exception 'avoir_contenu_immuable' using errcode='42501'; end if;
    if (new.statut,new.reference_definitive,new.entreprise_copie,new.finalise_le,new.finalise_par) is distinct from (old.statut,old.reference_definitive,old.entreprise_copie,old.finalise_le,old.finalise_par) and current_setting('app.avoir_finalisation',true) is distinct from new.id::text then raise exception 'avoir_contenu_immuable' using errcode='42501'; end if;
   end if; return new; end $f$;
  create trigger avoirs_garde before insert or update on public.avoirs for each row execute function public.avoirs_garde();
  alter table public.avoirs enable row level security;
  create policy avoirs_insert on public.avoirs for insert to authenticated with check (owner_id=auth.uid());
  create policy avoirs_select on public.avoirs for select to authenticated using (owner_id=auth.uid());
  create policy avoirs_update on public.avoirs for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
  grant select,insert,update on public.avoirs to authenticated;
  grant select on public.factures_lignes,public.entreprises to authenticated;grant select,update on public.factures to authenticated;
  grant select,insert,update on public.compteurs_references,public.compteurs_factures_brouillon to authenticated;`);
 // Données : F0 déjà avoirée (avoir total finalisé AV-…-00001 existant avant migration) ; F1 : lignes avec arrondis ; F2 : pour le total ; F3 : ligne à prix 0 ; FB : autre compte ; FD : brouillon ; acompte.
 const fact=(id,own,st,ref)=>`insert into public.factures(id,owner_id,statut,reference_definitive,client_id,client_copie,objet) values('${id}','${own}','${st}',${ref?`'${ref}'`:'null'},'${B}','{"nom":"Client EXEMPLE"}','Chantier');`;
 const lig=(f,n,pos,des,qte,prix,taux)=>`insert into public.factures_lignes(id,owner_id,facture_id,position,designation,quantite_milliemes,prix_ht_centimes,taux_tva_milliemes,ht_centimes,tva_centimes,ttc_centimes) select '${L(f,n)}','${A}','${f}',${pos},'${des}',${qte},${prix},${taux},h,t,h+t from (select h,(h*${taux}*2+1000)/2000 t from (select (${qte}*${prix}*2+1000)/2000 h) a) b;`;
 const totaux=f=>`update public.factures set total_ht_centimes=(select sum(ht_centimes) from public.factures_lignes where facture_id='${f}'),total_tva_centimes=(select sum(tva_centimes) from public.factures_lignes where facture_id='${f}'),total_ttc_centimes=(select sum(ttc_centimes) from public.factures_lignes where facture_id='${f}'),ventilation_tva=(select coalesce(jsonb_agg(jsonb_build_object('taux',taux,'base',base,'tva',tva) order by taux),'[]') from (select taux_tva_milliemes taux,sum(ht_centimes) base,sum(tva_centimes) tva from public.factures_lignes where facture_id='${f}' group by 1) s) where id='${f}';`;
 await db.exec(fact(F0,A,'finalise','FAC-LFM-2026-00000')+fact(F1,A,'finalise','FAC-LFM-2026-00001')+fact(F2,A,'finalise','FAC-LFM-2026-00002')+fact(F3,A,'finalise','FAC-LFM-2026-00003')+fact(FB,B,'finalise','FAC-LFM-2026-00009')+fact(FD,A,'brouillon',null)
  +lig(F0,1,1,'Ancienne',1000,10000,200)
  +lig(F1,1,1,'Tableau',2000,10000,200)+lig(F1,2,2,'Câble',3000,3333,100)+lig(F1,3,3,'Main d’œuvre',1000,5000,200)
  +lig(F2,1,1,'Pose',1000,20000,200)+lig(F2,2,2,'Matériel',1000,1000,200)
  +lig(F3,1,1,'Offert',1000,0,200)+lig(F3,2,2,'Payant',1000,1000,200)
  +lig(FB,1,1,'Autre compte',1000,1000,200)+lig(FD,1,1,'Brouillon',1000,1000,200)
  +[F0,F1,F2,F3,FB,FD].map(totaux).join('')
  +`insert into public.entreprises(owner_id,raison_sociale) values('${A}','Entreprise EXEMPLE');
  insert into public.compteurs_factures_brouillon values('${A}',1);
  insert into public.compteurs_references values('${A}','avoir',${an},1);
  alter table public.avoirs disable trigger avoirs_garde;
  insert into public.avoirs(id,owner_id,reference,statut,facture_source_id,facture_source_reference,client_id,client_copie,objet,lignes,total_ht_centimes,total_tva_centimes,total_ttc_centimes,ventilation_tva,date_avoir,motif,reference_definitive,finalise_le)
   select 'a0000000-0000-4000-8000-000000000001','${A}','BROUILLON-AV-001','finalise',f.id,f.reference_definitive,f.client_id,f.client_copie,f.objet,(select jsonb_agg(to_jsonb(l)-'owner_id'-'facture_id') from public.factures_lignes l where l.facture_id=f.id),f.total_ht_centimes,f.total_tva_centimes,f.total_ttc_centimes,f.ventilation_tva,'2026-10-01','Ancien avoir total','AV-LFM-${an}-00001',now() from public.factures f where f.id='${F0}';
  alter table public.avoirs enable trigger avoirs_garde;`);
 const lg=async f=>(await q('select id,quantite_milliemes qte,ht_centimes ht,tva_centimes tva,ttc_centimes ttc from public.factures_lignes where facture_id=$1 order by position',[f])).rows.map(r=>({...r,qte:Number(r.qte),ht:Number(r.ht),tva:Number(r.tva),ttc:Number(r.ttc)}));
 await db.exec("select set_config('app.avoir','',false)");
 const mig=fs.readFileSync('supabase/en-attente/20261101200000_avoirs_partiels.sql','utf8');
 await db.exec(mig);ok('Migration installée sans erreur sur une base reproduisant la structure réelle, avec un avoir total déjà finalisé');
 await root();
 assert.equal((await q("select type_avoir,statut from public.avoirs")).rows[0].type_avoir,'total');ok('Avoir existant conservé et marqué « total »');

 const F1l=await lg(F1);const [l1,l2,l3]=F1l;
 const prep=(f,lignes,motif='Remise accordée')=>q('select public.preparer_avoir_partiel($1,$2,$3::jsonb) r',[f,motif,J(lignes)]).then(r=>r.rows[0].r);
 const fin=(id,v)=>q('select public.finaliser_avoir($1,$2) r',[id,v]).then(r=>r.rows[0].r);

 // --- Préparation partielle
 await as(A);
 const d1=await prep(F1,[{ligne_id:l1.id,quantite_milliemes:1000}]);
 assert.equal(d1.type_avoir,'partiel');assert.equal(d1.statut,'brouillon');assert.equal(d1.total_ht_centimes,10000);assert.equal(d1.total_tva_centimes,2000);assert.equal(d1.total_ttc_centimes,12000);
 assert.equal(d1.lignes.length,1);assert.equal(d1.lignes[0].id,l1.id);assert.equal(d1.lignes[0].quantite_milliemes,1000);assert.deepEqual(d1.ventilation_tva,[{taux:200,base:10000,tva:2000}]);assert.match(d1.reference,/^BROUILLON-AV-/);
 ok('Avoir partiel : 1 unité sur 2 de la ligne « Tableau » → 100,00 HT / 120,00 TTC ; ventilation TVA correcte');
 const d1b=await prep(F1,[{ligne_id:l3.id,quantite_milliemes:1000}],'Autre');assert.equal(d1b.id,d1.id);
 const d1c=(await q('select public.preparer_avoir($1,$2) r',[F1,'Total']) ).rows[0].r;assert.equal(d1c.id,d1.id);
 assert.equal((await q("select count(*)::int n from public.avoirs where facture_source_id=$1",[F1])).rows[0].n,1);
 ok('Un seul brouillon ouvert par facture : une nouvelle demande (partielle ou totale) retrouve le brouillon existant, sans doublon');

 // --- Finalisation
 const f1=await fin(d1.id,d1.version);
 assert.equal(f1.statut,'finalise');assert.equal(f1.reference_definitive,`AV-LFM-${an}-00002`);
 assert.equal((await fin(d1.id,d1.version)).reference_definitive,f1.reference_definitive);
 ok('Finalisation : numéro AV continu après l’avoir existant (…00002), idempotente (même numéro si on renvoie)');
 await root();assert.equal(Number((await q("select public.facture_credite($1) c",[F1])).rows[0].c),12000);
 await as(A);

 // --- Refus de quantités et lignes invalides
 const e=(lignes,re,f=F1)=>rej('select public.preparer_avoir_partiel($1,$2,$3::jsonb)',[f,'Motif',J(lignes)],re);
 await e([{ligne_id:l1.id,quantite_milliemes:1001}],/quantite_depassee/);
 await e([{ligne_id:l1.id,quantite_milliemes:0}],/lignes_invalides/);
 await e([{ligne_id:l1.id,quantite_milliemes:-5}],/lignes_invalides/);
 await e([],/lignes_invalides/);
 await e([{ligne_id:l1.id,quantite_milliemes:100},{ligne_id:l1.id,quantite_milliemes:100}],/lignes_invalides/);
 await e([{ligne_id:'pas-un-uuid',quantite_milliemes:100}],/lignes_invalides/);
 await e([{quantite_milliemes:100}],/lignes_invalides/);
 await e([{ligne_id:(await lg(F2))[0].id,quantite_milliemes:100}],/ligne_inconnue/);
 await rej('select public.preparer_avoir_partiel($1,$2,$3::jsonb)',[F1,'  ',J([{ligne_id:l1.id,quantite_milliemes:100}])],/motif_requis/);
 await rej('select public.preparer_avoir_partiel($1,$2,$3::jsonb)',[F1,'M','{"a":1}'],/lignes_invalides/);
 await rej('select public.preparer_avoir_partiel($1,$2,$3::jsonb)',[FD,'M',J([{ligne_id:(await lg(FD))[0].id,quantite_milliemes:100}])],/avoir_facture_non_finalisee/);
 ok('Refus : quantité au-delà du restant (1 unité déjà créditée sur 2), nulle, négative, doublon, ligne inconnue ou d’une autre facture, motif vide, facture brouillon');
 await e([{ligne_id:(await lg(F3))[0].id,quantite_milliemes:1000}],/avoir_montant_nul/,F3);
 ok('Refus d’un avoir à montant nul (ligne offerte à 0 €)');

 // --- Arrondis : une ligne créditée en plusieurs fois ne dépasse jamais le montant facturé
 let reste=l2.ht;let somme=0;
 for(const [qte,att] of [[1500,null],[1000,null],[500,'reste']]){
  const d=await prep(F1,[{ligne_id:l2.id,quantite_milliemes:qte}]);
  const fz=await fin(d.id,d.version);somme+=fz.total_ht_centimes;
 }
 assert.equal(somme,l2.ht,'somme des HT créditée = HT de la ligne (aucun écart d’arrondi)');
 const tvaCred=Number((await q(`select sum((x->>'tva_centimes')::bigint) s from public.avoirs a, jsonb_array_elements(a.lignes) x where a.facture_source_id=$1 and a.statut='finalise' and x->>'id'=$2`,[F1,l2.id])).rows[0].s);
 assert.equal(tvaCred,l2.tva);
 await e([{ligne_id:l2.id,quantite_milliemes:1}],/quantite_depassee/);
 ok('Ligne créditée en 3 fois (1,5 + 1 + 0,5) : HT et TVA cumulés = exactement ceux de la ligne ; plus rien à créditer ensuite');

 // --- Total refusé quand un partiel est finalisé ; total possible sinon
 await rej('select public.preparer_avoir($1,$2)',[F1,'Total'],/avoir_deja_partiel/);
 ok('Avoir total refusé sur une facture déjà partiellement créditée');
 const t2=(await q('select public.preparer_avoir($1,$2) r',[F2,'Annulation'])).rows[0].r;assert.equal(t2.type_avoir,'total');assert.equal(t2.total_ttc_centimes,25200);
 const t2f=await fin(t2.id,t2.version);assert.match(t2f.reference_definitive,/-00006$/);
 assert.equal((await q('select public.preparer_avoir($1,$2) r',[F2,'Encore'])).rows[0].r.id,t2.id);
 await e([{ligne_id:(await lg(F2))[0].id,quantite_milliemes:1}],/quantite_depassee/,F2);
 ok('Avoir total : comportement inchangé (idempotent, numéro continu) ; ensuite plus rien à créditer en partiel');

 // --- Reste de la facture F1 : on solde la ligne 1 et la ligne 3 ; le total créditée = total facture
 const dRest=await prep(F1,[{ligne_id:l1.id,quantite_milliemes:1000},{ligne_id:l3.id,quantite_milliemes:1000}]);
 const rf=await fin(dRest.id,dRest.version);
 await root();
 const tot=(await q('select total_ttc_centimes t from public.factures where id=$1',[F1])).rows[0].t;
 assert.equal(Number((await q("select public.facture_credite($1) c",[F1])).rows[0].c),Number(tot));
 ok('Facture entièrement créditée en 4 avoirs partiels : total crédité = total TTC de la facture, au centime près');
 await as(A);

 // --- Plafond (défense en profondeur) : facture rabaissée après préparation d’un brouillon
 await root();
 await as(A);
 const dP=await prep(F3,[{ligne_id:(await lg(F3))[1].id,quantite_milliemes:1000}]);
 await root();await db.exec(`update public.factures set total_ttc_centimes=1000 where id='${F3}'`);await as(A);
 await rej('select public.finaliser_avoir($1,$2)',[dP.id,dP.version],/avoir_depasse_facture/);
 await root();await db.exec(`update public.factures set total_ttc_centimes=1200 where id='${F3}'`);await as(A);
 assert.equal((await fin(dP.id,dP.version)).statut,'finalise');
 ok('Plafond : finalisation refusée si les avoirs cumulés dépasseraient le total de la facture, acceptée au montant exact');

 // --- Abandon : aucun numéro consommé, trace conservée
 const dA=await prep(FB,[{ligne_id:L(FB,1),quantite_milliemes:100}]).catch(x=>x);
 assert.match(String(dA.message),/introuvable/);
 ok('Un autre compte ne peut pas préparer un avoir sur ma facture (« introuvable »)');
 await root();
 const F4='f4000000-0000-4000-8000-000000000004';
 await db.exec(fact(F4,A,'finalise','FAC-LFM-2026-00004')+lig(F4,1,1,'Abandon',4000,2500,200)+totaux(F4));await as(A);
 const l4=(await lg(F4))[0];
 const a1=await prep(F4,[{ligne_id:l4.id,quantite_milliemes:1000}]);
 const avant=(await q("select dernier from public.compteurs_references where type_document='avoir'")).rows[0].dernier;
 const ab=(await q('select public.abandonner_avoir($1,$2) r',[a1.id,a1.version])).rows[0].r;
 assert.equal(ab.statut,'abandonne');assert.equal(ab.reference_definitive,null);
 assert.equal((await q("select dernier from public.compteurs_references where type_document='avoir'")).rows[0].dernier,avant);
 assert.equal((await q('select public.abandonner_avoir($1,$2) r',[a1.id,a1.version])).rows[0].r.statut,'abandonne');
 await rej('select public.finaliser_avoir($1,$2)',[a1.id,ab.version],/avoir_abandonne/);
 await rej('update public.avoirs set remarques=$1 where id=$2',['x',a1.id],/avoir_via_operation|avoir_finalise/);
 ok('Brouillon abandonné : statut « abandonné », aucun numéro AV consommé, abandon répété sans effet, finalisation impossible, modification impossible');
 const a2=await prep(F4,[{ligne_id:l4.id,quantite_milliemes:2000}]);assert.notEqual(a2.id,a1.id);assert.equal(a2.total_ht_centimes,5000);
 await rej('select public.abandonner_avoir($1,$2)',[a2.id,a2.version+5],/conflit_version/);
 await rej('select public.finaliser_avoir($1,$2)',[a2.id,a2.version+5],/conflit_version/);
 const a2f=await fin(a2.id,a2.version);
 await rej('select public.abandonner_avoir($1,$2)',[a2.id,a2f.version],/avoir_finalise/);
 const nums=(await q("select reference_definitive r from public.avoirs where statut='finalise' order by reference_definitive")).rows.map(r=>r.r);
 const suite=nums.map(n=>Number(n.slice(-5)));assert.deepEqual(suite,suite.map((_,i)=>i+1),'numérotation continue sans trou');
 ok(`Nouveau brouillon possible après abandon ; conflit de version détecté ; avoir finalisé non abandonnable ; numérotation AV continue sans trou (${nums.length} avoirs : 1 à ${nums.length})`);

 // --- Sécurité
 await as(B);
 await rej('select public.preparer_avoir_partiel($1,$2,$3::jsonb)',[F4,'M',J([{ligne_id:l4.id,quantite_milliemes:100}])],/introuvable/);
 await rej('select public.finaliser_avoir($1,$2)',[a2.id,1],/introuvable/);
 await rej('select public.abandonner_avoir($1,$2)',[a2.id,1],/introuvable/);
 assert.equal((await q('select count(*)::int n from public.avoirs')).rows[0].n,0);
 await db.exec("reset role;set role anon;set app.user_id='';");
 await rej('select public.preparer_avoir_partiel($1,$2,$3::jsonb)',[F4,'M','[]'],/permission denied/);
 await rej('select public.abandonner_avoir($1,$2)',[a2.id,1],/permission denied/);
 await rej('select public.avoir_calculer_lignes($1,$2::jsonb)',[F4,'[]'],/permission denied/);
 await as(A);
 await rej("update public.avoirs set total_ttc_centimes=1 where id=$1",[a2.id],/avoir_via_operation/);
 await rej("insert into public.avoirs(id,owner_id,reference,facture_source_id,facture_source_reference,client_id,client_copie,objet,lignes,total_ht_centimes,total_tva_centimes,total_ttc_centimes,ventilation_tva,date_avoir,motif,type_avoir) values(gen_random_uuid(),$1,'X',$2,'X',$3,'{}','x','[]',0,0,0,'[]','2026-01-01','m','partiel')",[A,F4,B],/avoir_via_operation/);
 ok('Sécurité : autre compte = « introuvable » et aucune ligne visible ; anonyme sans droit d’exécution ; écriture directe dans la table refusée');

 // --- Deux brouillons simultanés impossibles même en contournant les fonctions
 await root();
 const F5='f5000000-0000-4000-8000-000000000005';
 await db.exec(fact(F5,A,'finalise','FAC-LFM-2026-00005')+lig(F5,1,1,'Concurrence',1000,1000,200)+totaux(F5));
 await db.exec(`select set_config('app.avoir','c0000000-0000-4000-8000-000000000001',false);insert into public.avoirs(id,owner_id,reference,facture_source_id,facture_source_reference,client_id,client_copie,objet,lignes,total_ht_centimes,total_tva_centimes,total_ttc_centimes,ventilation_tva,date_avoir,motif) values('c0000000-0000-4000-8000-000000000001','${A}','T1','${F5}','x','${B}','{}','x','[]',0,0,0,'[]','2026-01-01','m');`);
 await db.exec(`select set_config('app.avoir','c0000000-0000-4000-8000-000000000002',false);`);
 await rej(`insert into public.avoirs(id,owner_id,reference,facture_source_id,facture_source_reference,client_id,client_copie,objet,lignes,total_ht_centimes,total_tva_centimes,total_ttc_centimes,ventilation_tva,date_avoir,motif) values('c0000000-0000-4000-8000-000000000002','${A}','T2','${F5}','x','${B}','{}','x','[]',0,0,0,'[]','2026-01-01','m')`,[],/avoirs_un_brouillon_par_facture/);
 ok('Un second brouillon sur la même facture est refusé par la base elle-même (index unique partiel)');

 console.log(rap.map((m,i)=>`${i+1}. ${m}`).join('\n'));console.log(`\n${rap.length} contrôles réussis.`);
}catch(err){console.error('ÉCHEC :',err);if(rap.length)console.error('Réussis avant échec :\n'+rap.join('\n'));process.exit(1);}
