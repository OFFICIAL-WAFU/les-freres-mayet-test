-- Contrôles exécutés dans la MÊME transaction que la migration, puis annulation forcée (raise exception) :
-- rien n'est conservé dans la base TEST.
do $t$
declare
  U uuid := 'fa34a626-2fd6-4d1a-a4b3-3be457f3dc4a'; X uuid := '00000000-0000-4000-8000-0000000000aa';
  rap text := ''; lot uuid; d record; res jsonb; cl uuid; di uuid; n int; e text;
  procedure_ok boolean;
begin
  -- 1. Numérotation remplacée dans les trois fonctions
  select count(*) into n from pg_proc where pronamespace='public'::regnamespace and proname in ('finaliser_devis','finaliser_facture','finaliser_avoir')
    and pg_get_functiondef(oid) like '%reference_document(%' and pg_get_functiondef(oid) not like '%-LFM-%';
  rap := rap || format('[1] fonctions au nouveau format : %s/3 ; ', n);
  rap := rap || format('[2] format : %s %s %s ; ', public.reference_document('D',2026,13), public.reference_document('F',2026,412), public.reference_document('A',2026,7));

  -- Données d'essai : un lot, un client importé, un historique
  insert into lots_import(owner_id,nature,description) values(U,'documents','essai') returning id into lot;
  select id into cl from clients where owner_id=U limit 1;
  insert into documents_importes(owner_id,lot_import,type,reference,date_document,client_nom,total_ht_centimes,total_tva_centimes,total_ttc_centimes)
    values(U,lot,'devis','D2026-00013','2026-03-01','Essai',10000,2000,12000) returning id into di;
  insert into documents_importes(owner_id,lot_import,type,reference,date_document,total_ht_centimes,total_tva_centimes,total_ttc_centimes)
    values(U,lot,'facture','F2026-00412','2026-03-02',10000,1000,11000),(U,lot,'acompte','F2025-00950','2025-12-01',5000,500,5500),(U,lot,'avoir','A2026-00007','2026-04-01',100,20,120);
  begin insert into documents_importes(owner_id,lot_import,type,reference,date_document,total_ht_centimes,total_tva_centimes,total_ttc_centimes) values(U,lot,'devis','F2026-00001','2026-01-01',0,0,0); rap:=rap||'[3] ÉCHEC préfixe accepté ; ';
  exception when others then rap:=rap||'[3] préfixe incohérent refusé ; '; end;
  begin insert into documents_importes(owner_id,lot_import,type,reference,date_document,total_ht_centimes,total_tva_centimes,total_ttc_centimes) values(U,lot,'devis','D2026-00013','2026-01-01',0,0,0); rap:=rap||'[4] ÉCHEC doublon accepté ; ';
  exception when unique_violation then rap:=rap||'[4] doublon de numéro refusé ; '; end;
  begin update documents_importes set total_ttc_centimes=1 where id=di; rap:=rap||'[5] ÉCHEC montant modifiable ; ';
  exception when others then rap:=rap||'[5] montants figés ; '; end;
  begin delete from documents_importes where id=di; rap:=rap||'[6] ÉCHEC suppression ; ';
  exception when others then rap:=rap||'[6] suppression refusée ; '; end;
  update documents_importes set client_id=cl where id=di;
  rap:=rap||'[7] rattachement client possible ; ';
  begin update documents_importes set client_id=null where id=di; rap:=rap||'[8] ÉCHEC rattachement réécrit ; ';
  exception when others then rap:=rap||'[8] rattachement définitif ; '; end;

  -- 9. Finalisation d'un vrai brouillon : le numéro D2026-00013 est dans l'historique → refus
  select id, version into d from devis where owner_id=U and statut='brouillon' order by updated_at desc limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  begin res := finaliser_devis(d.id, d.version); rap:=rap||'[9] ÉCHEC numéro historique réattribué : '||coalesce(res->>'reference_definitive',res::text)||' ; ';
  exception when others then get stacked diagnostics e = message_text; rap:=rap||'[9] refus attendu : '||e||' ; '; end;
  perform set_config('role','postgres', true);

  -- 10. Calage des compteurs puis nouvelle finalisation → D2026-00014
  res := caler_compteurs_historique(U);
  rap := rap || '[10] compteurs : ' || res::text || ' ; ';
  perform set_config('role','authenticated', true);
  begin res := finaliser_devis(d.id, d.version); select reference_definitive into e from devis where id=d.id; rap:=rap||'[11] devis finalisé : '||e||' ; ';
  exception when others then get stacked diagnostics e = message_text; rap:=rap||'[11] finalisation impossible : '||e||' ; '; end;

  -- 12. Catalogue : nouvelles colonnes écrites par l'utilisateur
  begin insert into articles(owner_id,reference,designation,type,metier,unite,prix_ht_centimes,prix_achat_centimes,famille,fournisseur)
    values(U,'ESSAI-ACC-1','Essai','materiel','plomberie','piece',1500,1000,'Robinetterie','REXEL'); rap:=rap||'[12] article avec prix d''achat créé ; ';
  exception when others then get stacked diagnostics e = message_text; rap:=rap||'[12] ÉCHEC article : '||e||' ; '; end;
  -- 13. Ouvrage + composant
  begin
    insert into ouvrages(id,owner_id,reference,designation,metier) values('00000000-0000-4000-8000-0000000000b1',U,'OUV-1','Pose WC suspendu','plomberie');
    insert into ouvrages_composants(owner_id,ouvrage_id,position,type,designation,unite,quantite_milliemes,prix_ht_centimes) values(U,'00000000-0000-4000-8000-0000000000b1',0,'prestation','Main d''œuvre','heure',3000,5500);
    rap:=rap||'[13] ouvrage et composition créés ; ';
  exception when others then get stacked diagnostics e = message_text; rap:=rap||'[13] ÉCHEC ouvrage : '||e||' ; '; end;
  -- 14. Modèle et connaissance
  begin
    insert into modeles_devis(owner_id,nom,metier,lignes) values(U,'Salle de bain complète','plomberie','[]');
    insert into connaissances_metier(owner_id,categorie,titre,contenu) values(U,'tarif','Taux horaire','55 € HT');
    rap:=rap||'[14] modèle et connaissance créés ; ';
  exception when others then get stacked diagnostics e = message_text; rap:=rap||'[14] ÉCHEC : '||e||' ; '; end;
  -- 15. Historique : l'utilisateur ne peut pas en créer
  begin insert into documents_importes(owner_id,lot_import,type,reference,date_document,total_ht_centimes,total_tva_centimes,total_ttc_centimes) values(U,lot,'devis','D2026-00099','2026-01-01',0,0,0); rap:=rap||'[15] ÉCHEC création historique par l''utilisateur ; ';
  exception when others then rap:=rap||'[15] création d''historique réservée ; '; end;
  -- 16. Autre compte : ne voit rien
  perform set_config('request.jwt.claims', json_build_object('sub',X,'role','authenticated')::text, true);
  select (select count(*) from documents_importes)+(select count(*) from ouvrages)+(select count(*) from modeles_devis)+(select count(*) from connaissances_metier) into n;
  rap:=rap||format('[16] autre compte voit %s élément(s) ; ', n);
  perform set_config('role','postgres', true);
  -- 17. Retrait d'un lot entier par l'administrateur
  perform set_config('app.retrait_lot', lot::text, true);
  delete from documents_importes where lot_import=lot; get diagnostics n = row_count;
  rap:=rap||format('[17] lot retiré : %s document(s)', n);
  raise exception 'RAPPORT %', rap;
end $t$;
