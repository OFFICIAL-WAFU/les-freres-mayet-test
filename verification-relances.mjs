// Contrôles des relances de devis : règles (src/lib/relances-devis.ts), e-mail MIME (src/lib/mime.ts),
// variable facultative {lien_signature} (src/lib/messages.ts).
import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
const tr=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url=c=>'data:text/javascript;base64,'+Buffer.from(c).toString('base64');
const suivi=url(tr('src/lib/suivi-devis.ts'));
const R=await import(url(tr('src/lib/relances-devis.ts').replace('"@/lib/suivi-devis"',JSON.stringify(suivi))));
const M=await import(url(tr('src/lib/mime.ts')));
const G=await import(url(tr('src/lib/messages.ts')));

// --- Règles de relance ---
const D=(id,o={})=>({id,finalise:true,reponse:'attente',signe:false,facture:false,dateDevis:'2026-11-01',validite:'2026-12-01',montantHTCentimes:100000n,...o});
const E=(devis_id,nature,le,canal='gmail')=>({id:`${devis_id}-${nature}-${le}`,devis_id,nature,canal,destinataire:'',sujet:'',avec_pdf:true,avec_lien:true,le});
const J='2026-11-06';
assert.deepEqual(R.relanceDue(D('a'),[],J),{devisId:'a',rang:1,depuis:'2026-11-01',jours:5,montantHTCentimes:100000n}); // sans envoi noté : date du devis
assert.equal(R.relanceDue(D('a'),[E('a','envoi','2026-11-04T10:00:00Z')],J),null); // envoyé il y a 2 jours
assert.equal(R.relanceDue(D('a'),[E('a','envoi','2026-11-03T10:00:00Z')],J).rang,1); // 3 jours pile
assert.equal(R.relanceDue(D('a'),[E('a','envoi','2026-11-02T08:00:00Z'),E('a','envoi','2026-11-05T08:00:00Z')],J),null); // le dernier envoi compte
assert.equal(R.relanceDue(D('a'),[E('a','relance1','2026-10-30T09:00:00Z')],J),null); // 7 jours après la 1re relance
assert.equal(R.relanceDue(D('a',{validite:'2026-12-31'}),[E('a','relance1','2026-10-27T09:00:00Z')],J).rang,2); // 10 jours
assert.equal(R.relanceDue(D('a'),[E('a','relance1','2026-10-01T09:00:00Z','aucun')],J).rang,2); // relance écartée = faite
assert.equal(R.relanceDue(D('a'),[E('a','relance1','2026-10-01T09:00:00Z'),E('a','relance2','2026-10-20T09:00:00Z')],J),null); // fini
for(const o of [{reponse:'accepte'},{reponse:'refuse'},{signe:true},{facture:true},{finalise:false},{validite:'2026-11-05'}]) assert.equal(R.relanceDue(D('a',o),[],J),null,JSON.stringify(o));
assert.equal(R.relanceDue(D('a',{validite:''}),[],J).rang,1); // sans validité : relance possible
assert.equal(R.relanceDue(D('a',{validite:J}),[],J).rang,1); // valable jusqu'à aujourd'hui inclus
assert.equal(R.relanceDue(D('b'),[E('a','envoi','2026-11-05T08:00:00Z')],J).devisId,'b'); // les envois d'un autre devis ne comptent pas
// Fuseau : 23 h 30 UTC le 2 = 3 novembre à Paris.
assert.equal(R.jourParis('2026-11-02T23:30:00Z'),'2026-11-03');
assert.equal(R.relanceDue(D('a'),[E('a','envoi','2026-11-02T23:30:00Z')],J).depuis,'2026-11-03');
// Ordre : plus gros montant d'abord, puis le plus ancien.
const liste=R.relancesDuJour([D('p',{montantHTCentimes:50000n}),D('g',{montantHTCentimes:900000n}),D('m',{montantHTCentimes:50000n,dateDevis:'2026-10-20',validite:''})],[],J);
assert.deepEqual(liste.map(r=>r.devisId),['g','m','p']);
assert.equal(R.emailValide('client@exemple.fr'),true);for(const x of ['','a@b','a b@c.fr','a@b.fr,c@d.fr','<a@b.fr>']) assert.equal(R.emailValide(x),false,x);
assert.equal(R.libelleDepuis({rang:1,jours:5},true),'Envoyé il y a 5 jours');assert.equal(R.libelleDepuis({rang:2,jours:1},true),'1re relance il y a 1 jour');

// --- E-mail MIME ---
const mime=M.construireMime({a:'client@exemple.fr',sujet:'Suivi de votre devis n°219 — Les Frères Mayet',texte:'Bonjour Mme Dupré,\nVoici le lien : https://x/signer/abc\n\nCordialement',pdf:{nom:'Devis_219 (v1).pdf',base64:Buffer.from('%PDF-1.4 essai').toString('base64')}},'FRONT');
assert.match(mime,/^To: client@exemple\.fr\r\n/);
assert.match(mime,/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=\r\n/);
const sujet=Buffer.from(mime.match(/=\?UTF-8\?B\?([^?]+)\?=/)[1],'base64').toString('utf8');assert.equal(sujet,'Suivi de votre devis n°219 — Les Frères Mayet');
assert.ok(mime.includes('Content-Type: multipart/mixed; boundary="FRONT"'));assert.ok(mime.includes('filename="Devis_219_v1_.pdf"'));assert.ok(mime.trimEnd().endsWith('--FRONT--'));
const corps=mime.split('--FRONT')[1].split('\r\n\r\n')[1].replace(/\r\n/g,'');assert.equal(Buffer.from(corps,'base64').toString('utf8'),'Bonjour Mme Dupré,\r\nVoici le lien : https://x/signer/abc\r\n\r\nCordialement');
assert.ok(mime.split('\r\n').every(l=>l.length<=998)); // longueur de ligne SMTP
// Pas d'injection d'en-tête par l'objet ou le destinataire.
const inj=M.construireMime({a:'a@b.fr\r\nBcc: pirate@x.fr',sujet:'Objet\r\nBcc: pirate@x.fr',texte:'t'},'F');
assert.ok(!/\r\nBcc:/i.test(inj));assert.equal(inj.split('\r\n').filter(l=>/^Subject:/.test(l)).length,1);
assert.ok(!M.construireMime({a:'a@b.fr',sujet:'Simple',texte:'t'},'F').includes('multipart'));
assert.match(M.versBase64Url(mime),/^[A-Za-z0-9_-]+$/);
assert.equal(Buffer.from(M.versBase64Url('é?>~'),'base64url').toString('utf8'),'é?>~');
assert.equal(M.nomFichierSur('../../etc/passwd'),'.._.._etc_passwd');assert.equal(M.nomFichierSur('é'),'document');

// --- Modèles : {lien_signature} facultatif, deux relances ---
const ctx={client:'Mme Dupré',numero:'219',objet:'Clim',entreprise:'Les Frères Mayet',montant:'',reste:'',echeance:'30/11/2026'};
const avec=G.rendreMessage(G.MODELES_MESSAGES.rappelDevis,{...ctx,lien_signature:'https://x/signer/abc'});
assert.ok(avec.texte.includes('https://x/signer/abc'));assert.ok(!avec.texte.includes('Non renseigné'));
const sans=G.rendreMessage(G.MODELES_MESSAGES.rappelDevis,{...ctx,lien_signature:''});
assert.ok(!sans.texte.includes('signer en ligne'));assert.ok(!sans.texte.includes('Non renseigné'));assert.ok(sans.texte.includes('Bonjour Mme Dupré'));
const r2=G.rendreMessage(G.MODELES_MESSAGES.rappelDevis2,{...ctx,lien_signature:'L'});assert.ok(r2.texte.includes('30/11/2026')&&r2.texte.includes(': L'));
assert.ok(!G.rendreMessage(G.MODELES_MESSAGES.devis,{...ctx,lien_signature:''}).texte.includes('signer'));
// Un texte du client contenant « {lien_signature} » n'est jamais interprété (remplacement en une passe).
assert.equal(G.rendreMessage({sujet:'S',texte:'{client}'},{...ctx,client:'{lien_signature}',lien_signature:'L'}).texte,'{lien_signature}');
assert.equal(G.TYPES_MESSAGES.rappelDevis2,'Relance d’un devis (2e)');
assert.doesNotThrow(()=>G.validerModele({sujet:'S',texte:'Lien : {lien_signature}'}));
console.log('Relances des devis : tous les contrôles réussis');
