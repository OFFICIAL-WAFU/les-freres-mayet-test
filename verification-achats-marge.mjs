import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';
const srv = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', configFile: 'vite.config.ts' });
const { selectionMarge, totalMarge, tauxMarge, filtrerAchats, totalAchats } = await srv.ssrLoadModule('/src/lib/achats-marge.ts');
const mois = [{mois:'2026-03',ca:999n,achats:0n,marge:999n},{mois:'2026-04',ca:10000n,achats:3000n,marge:7000n},{mois:'2026-11',ca:2000n,achats:4000n,marge:-2000n},{mois:'2027-01',ca:999n,achats:0n,marge:999n}];
assert.deepEqual(totalMarge(selectionMarge(mois,'depuis-avril','2026-11-06')), {ca:12000n,achats:7000n,marge:5000n});
assert.equal(selectionMarge(mois,'annee','2026-11-06').length,3);
assert.equal(selectionMarge(mois,'mois','2026-11-06')[0].ca,2000n);
assert.equal(tauxMarge(7000n,10000n),70);
assert.equal(tauxMarge(-2000n,2000n),-100);
assert.equal(tauxMarge(-100n,0n),null);
const achats = [{date_achat:'2026-04-15',fournisseur:'F1',num_facture:'001',chantier_texte:'Cèdre',reference:'R1',designation:'Tube',metier:'plomberie',total_ht_centimes:3000},{date_achat:'2026-05-15',fournisseur:'F2',num_facture:'002',chantier_texte:'Autre',reference:'R2',designation:'Fil',metier:'electricite',total_ht_centimes:4000}];
for (const filtre of [{mois:'2026-04'}, {fournisseur:'F1'}, {metier:'plomberie'}, {recherche:'cedre'}]) assert.equal(totalAchats(filtrerAchats(achats,{mois:'',fournisseur:'',metier:'',recherche:'',...filtre})),3000n);
const db = new PGlite();
try {
await db.exec(`CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE clients(id uuid PRIMARY KEY,owner_id uuid); CREATE TABLE lots_import(id uuid PRIMARY KEY,owner_id uuid);
CREATE TABLE factures(id uuid PRIMARY KEY,owner_id uuid,date_facture date,nature text,statut text,total_ht_centimes bigint,deduction jsonb);
CREATE TABLE avoirs(owner_id uuid,date_avoir date,statut text,total_ht_centimes bigint);
GRANT SELECT ON clients,lots_import,factures,avoirs TO authenticated;
ALTER TABLE factures ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON factures USING(owner_id=auth.uid());
ALTER TABLE avoirs ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON avoirs USING(owner_id=auth.uid());`);
await db.exec(await readFile('drizzle/migrations/0000_achats_et_marge_mensuelle.sql','utf8'));
const o='00000000-0000-0000-0000-000000000001', other='00000000-0000-0000-0000-000000000002';
await db.exec(`INSERT INTO factures VALUES
('10000000-0000-0000-0000-000000000001','${o}','2026-04-01','facture','finalise',35000,'{"ht":3705}'),
('10000000-0000-0000-0000-000000000002','${o}','2026-04-01','acompte','finalise',3705,null),
('10000000-0000-0000-0000-000000000003','${o}','2026-04-01','facture','brouillon',99999,null),
('10000000-0000-0000-0000-000000000004','${other}','2026-04-01','facture','finalise',99999,null),
('10000000-0000-0000-0000-000000000005','${o}','2026-06-01','facture','finalise',10000,null);
INSERT INTO avoirs VALUES('${o}','2026-04-15','finalise',5000),('${o}','2026-04-15','brouillon',99999);
INSERT INTO achats_lignes(owner_id,date_achat,total_ht_centimes) VALUES('${o}','2026-04-20',10000),('${o}','2026-05-20',2000),('${other}','2026-04-20',99999);
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${o}',false);`);
const r = (await db.query('SELECT * FROM marge_mensuelle ORDER BY mois')).rows;
assert.equal(r.length,3);
assert.equal(Number(r[0].ca_ht_centimes),30000); // 35000 - 3705 + 3705 - 5000; no drafts or other owners
assert.equal(Number(r[0].achats_ht_centimes),10000);
assert.equal(Number(r[0].marge_centimes),20000); // no labour costs deducted
assert.equal(Number(r[1].ca_ht_centimes),0); // purchase-only month
assert.equal(Number(r[1].marge_centimes),-2000);
assert.equal(Number(r[2].achats_ht_centimes),0); // sales-only month
assert.equal((await db.query('SELECT * FROM achats_lignes')).rows.length,2);
const created=(await db.query("INSERT INTO achats_lignes(date_achat) VALUES('2026-07-01') RETURNING owner_id,statut_affectation")).rows[0];
assert.equal(created.owner_id,o); assert.equal(created.statut_affectation,'a_rapprocher');
await assert.rejects(db.query(`INSERT INTO achats_lignes(owner_id,date_achat) VALUES('${other}','2026-07-01')`));
await db.exec('RESET ROLE; SET ROLE anon;');
await assert.rejects(db.query('SELECT * FROM marge_mensuelle'));
await assert.rejects(db.query('SELECT * FROM achats_lignes'));
console.log('Achats/marge : calculs, périodes, filtres, mois isolés, brouillons, acomptes, avoirs et accès propriétaire validés localement.');
} finally { await db.close(); await srv.close(); }