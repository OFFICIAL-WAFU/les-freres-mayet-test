import fs from 'node:fs';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const q=(s,p)=>db.query(s,p);const rej=(s,p,re)=>assert.rejects(()=>q(s,p),re);
await db.exec(`create table public.entreprises(id uuid primary key default gen_random_uuid(),owner_id uuid not null unique,raison_sociale text not null,siret text not null default '',constraint entreprises_raison_sociale_requise check(btrim(raison_sociale)<>''));insert into public.entreprises(owner_id,raison_sociale,siret) values(gen_random_uuid(),'Existante','12345678901234');`);
await db.exec(fs.readFileSync('supabase/en-attente/20261101210000_entreprise_annexes.sql','utf8'));
const e=(await q('select * from public.entreprises')).rows[0];
for(const c of ['iban','bic','assureur','contrat_assurance','code_naf','regime_tva','bandeau','logo','cgv'])assert.equal(e[c],'');assert.equal(e.siret,'12345678901234');
const png='data:image/png;base64,iVBORw0KGgo=';
const ok=async set=>q(`update public.entreprises set ${set}`);
await ok(`iban='FR7615519390410002090360248',bic='CMCIFR2A',logo='${png}',cgv='texte'`);await ok(`bic='CMCIFR2AXXX'`);
for(const [s,re] of [[`iban='fr76 1551'`,/iban_format/],[`iban='FR76'`,/iban_format/],[`bic='cmcifr2a'`,/bic_format/],[`bic='ABC'`,/bic_format/],[`logo='http://x/y.png'`,/logo_format/],[`logo='data:image/svg+xml;base64,AAAA'`,/logo_format/],[`logo='data:image/png;base64,<script>'`,/logo_format/],[`assureur='${'x'.repeat(201)}'`,/assureur_long/],[`bandeau='${'x'.repeat(201)}'`,/bandeau_long/]])await rej(`update public.entreprises set ${s}`,[],re);
await rej(`update public.entreprises set logo='data:image/png;base64,${'A'.repeat(300000)}'`,[],/logo_format/);
await rej(`update public.entreprises set cgv='${'x'.repeat(60001)}'`,[],/cgv_long/);
await ok(`cgv='${'x'.repeat(60000)}'`);
// Rejouable sans casser : les colonnes existent déjà → ADD COLUMN IF NOT EXISTS passe, les contraintes déjà présentes échouent (la migration ne doit être appliquée qu'une fois)
console.log('Migration annexes entreprise : tous les contrôles réussis');
