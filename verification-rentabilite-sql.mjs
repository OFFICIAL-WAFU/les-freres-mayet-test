// Contrôle de la migration 20261105200000_rentabilite_devis.sql dans une base temporaire (PGlite).
// Reproduit les tables et fonctions utiles de la base TEST (définitions relues le 05/11/2026), applique la migration,
// puis vérifie : rétrocompatibilité, enregistrement des coûts, montants inchangés, verrou des devis finalisés,
// projection de signature sans coût, réglages par défaut 1,6 / 25 € / 50 €.
import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const q=(s,p)=>db.query(s,p);
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
insert into auth.users values('${A}'),('${B}');
create table public.articles(id uuid primary key, owner_id uuid not null);
create table public.compteurs_devis(owner_id uuid primary key, dernier integer not null);
create table public.devis(id uuid primary key, owner_id uuid not null default auth.uid(), reference text not null, statut text not null default 'brouillon',
 client_id uuid, client_copie jsonb, objet text, date_devis date, date_validite date, remarques text default '', notes text default '',
 total_ht_centimes bigint default 0, total_tva_centimes bigint default 0, total_ttc_centimes bigint default 0, ventilation_tva jsonb default '[]',
 version integer not null default 1, conditions_paiement text default '', reference_definitive text, entreprise_copie jsonb);
create table public.devis_lignes(id uuid primary key, owner_id uuid not null, devis_id uuid not null references public.devis(id), position integer not null,
 type text not null, article_id uuid, reference text not null, designation text not null, description text not null, unite text not null,
 quantite_milliemes bigint not null, prix_ht_centimes bigint not null, taux_tva_milliemes integer not null, ht_centimes bigint not null,
 tva_centimes bigint not null, ttc_centimes bigint not null);
create table public.habitudes_documents(owner_id uuid primary key default auth.uid(), validite_devis_jours integer not null default 30,
 echeance_facture_jours integer not null default 7, remarques_devis text not null default '', remarques_facture text not null default '', updated_at timestamptz not null default now());
create function public.devis_lignes_calculer() returns trigger language plpgsql as $f$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.devis d WHERE d.id = NEW.devis_id AND d.owner_id = NEW.owner_id) THEN RAISE EXCEPTION 'devis_non_autorise'; END IF;
  NEW.ht_centimes := (NEW.quantite_milliemes * NEW.prix_ht_centimes * 2 + 1000) / 2000;
  NEW.tva_centimes := (NEW.ht_centimes * NEW.taux_tva_milliemes * 2 + 1000) / 2000;
  NEW.ttc_centimes := NEW.ht_centimes + NEW.tva_centimes; RETURN NEW; END $f$;
create trigger devis_lignes_calculer before insert or update on public.devis_lignes for each row execute function public.devis_lignes_calculer();
create function public.devis_lignes_verrouiller() returns trigger language plpgsql as $f$ DECLARE did uuid := COALESCE(NEW.devis_id, OLD.devis_id); BEGIN
  IF EXISTS (SELECT 1 FROM public.devis d WHERE d.id = did AND d.statut <> 'brouillon') THEN RAISE EXCEPTION 'devis_finalise_verrouille'; END IF;
  RETURN COALESCE(NEW, OLD); END $f$;
create trigger devis_lignes_verrouiller before insert or delete or update on public.devis_lignes for each row execute function public.devis_lignes_verrouiller();
create function public.lire_devis(p_id uuid) returns jsonb language sql stable as $f$
  SELECT to_jsonb(d) || jsonb_build_object('lignes', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position) FROM public.devis_lignes l WHERE l.devis_id = d.id), '[]'::jsonb))
  FROM public.devis d WHERE d.id = p_id; $f$;
create function public.signature_projection(p_devis_id uuid) returns jsonb language sql stable as $f$
  select jsonb_build_object('lignes', coalesce((select jsonb_agg(jsonb_build_object('designation', l.designation, 'quantite_milliemes', l.quantite_milliemes,
    'prix_ht_centimes', l.prix_ht_centimes, 'ht_centimes', l.ht_centimes) order by l.position) from public.devis_lignes l where l.devis_id = d.id), '[]'::jsonb))
  from public.devis d where d.id = p_devis_id; $f$;
insert into public.habitudes_documents(owner_id) values ('${A}');`);
await db.exec(fs.readFileSync('supabase/en-attente/20261105200000_rentabilite_devis.sql','utf8'));
const as=u=>q(`select set_config('test.uid','${u}',false)`);
const D='aaaaaaaa-0000-0000-0000-000000000001',L1='bbbbbbbb-0000-0000-0000-000000000001',L2='bbbbbbbb-0000-0000-0000-000000000002';
const base={client_id:null,client_copie:{nom:'X',adresse:['a']},objet:'Essai',date_devis:'2026-11-05',date_validite:'',remarques:'',notes:''};
const ligne=(id,extra={})=>({id,type:'materiel',article_id:'',reference:'',designation:'Prise',description:'',unite:'u',quantite_milliemes:'6000',prix_ht_centimes:'8044',taux_tva_milliemes:100,...extra});
const enr=(v,lignes)=>q('select public.enregistrer_brouillon($1,$2,$3::jsonb) r',[D,v,JSON.stringify({...base,lignes})]).then(x=>x.rows[0].r);
await as(A);
// 1. Réglages par défaut.
const h=(await q('select coef_materiel_milliemes c, cout_horaire_centimes k, taux_horaire_centimes t from public.habitudes_documents')).rows[0];
assert.deepEqual([h.c,Number(h.k),Number(h.t)],[1600,2500,5000]);
// 2. Ancien format (sans coût) : accepté, colonnes nulles, prix_calcule = false.
let r=await enr(null,[ligne(L1)]);
assert.equal(r.lignes[0].prix_achat_centimes,null);assert.equal(r.lignes[0].prix_calcule,false);assert.equal(Number(r.total_ht_centimes),48264);
// 3. Nouveau format : coûts enregistrés, montants identiques (le prix de vente reste la seule source).
const cout={prix_achat_centimes:'2029',coef_materiel_milliemes:'1500',temps_pose_minutes:'60',taux_horaire_centimes:'5000',cout_horaire_centimes:'2500',prix_calcule:true};
r=await enr(r.version,[ligne(L1,cout),ligne(L2,{designation:'Déchets',type:'prestation',quantite_milliemes:'1000',prix_ht_centimes:'1000'})]);
const l1=r.lignes[0];
assert.deepEqual([Number(l1.prix_achat_centimes),l1.coef_materiel_milliemes,l1.temps_pose_minutes,Number(l1.taux_horaire_centimes),Number(l1.cout_horaire_centimes),l1.prix_calcule],[2029,1500,60,5000,2500,true]);
assert.equal(Number(l1.ht_centimes),48264);assert.equal(Number(r.total_ht_centimes),49264);assert.equal(r.lignes[1].prix_achat_centimes,null);
// 4. Modification puis effacement d'un coût (valeur vide = NULL).
r=await enr(r.version,[ligne(L1,{...cout,prix_achat_centimes:'',prix_calcule:false})]);
assert.equal(r.lignes[0].prix_achat_centimes,null);assert.equal(r.lignes[0].temps_pose_minutes,60);assert.equal(r.lignes.length,1);
// 5. Valeurs hors bornes refusées par les contraintes.
await assert.rejects(()=>enr(r.version,[ligne(L1,{prix_achat_centimes:'-1'})]),/check/i);
await assert.rejects(()=>enr(r.version,[ligne(L1,{coef_materiel_milliemes:'100001'})]),/check/i);
// 6. Conflit de version toujours détecté.
await assert.rejects(()=>enr(r.version-1,[ligne(L1)]),/conflit_version/);
// 7. Projection publique de signature : aucun coût.
const proj=(await q('select public.signature_projection($1) p',[D])).rows[0].p;
assert.ok(!JSON.stringify(proj).includes('achat')&&!JSON.stringify(proj).includes('horaire'));
// 8. Devis finalisé : lignes (et coûts) verrouillés.
r=await enr(r.version,[ligne(L1,cout)]);
await q(`update public.devis set statut='finalise' where id=$1`,[D]);
await assert.rejects(()=>q('update public.devis_lignes set prix_achat_centimes=1 where id=$1',[L1]),/devis_finalise_verrouille/);
// 9. Un autre compte ne peut pas écrire dans ces lignes.
await as(B);await assert.rejects(()=>enr(null,[ligne(L1,cout)]),/./);
console.log('Migration rentabilité des devis : 9 contrôles réussis');
