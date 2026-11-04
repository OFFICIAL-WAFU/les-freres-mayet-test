-- Habitudes des documents (décision de Baptiste, 04/11/2026) : pré-remplir comme dans Khosmos la validité des devis
-- (30 jours), l'échéance des factures et acomptes (7 jours) et les mentions habituelles. Tout reste modifiable sur chaque
-- brouillon ; un document finalisé n'est jamais touché. Sans ligne d'habitudes, rien n'est pré-rempli (comportement d'avant).
begin;
create table public.habitudes_documents (
  owner_id uuid primary key references auth.users(id) default auth.uid(),
  validite_devis_jours integer not null default 30 check (validite_devis_jours between 0 and 365),
  echeance_facture_jours integer not null default 7 check (echeance_facture_jours between 0 and 120),
  remarques_devis text not null default '' check (char_length(remarques_devis) <= 5000),
  remarques_facture text not null default '' check (char_length(remarques_facture) <= 5000),
  updated_at timestamptz not null default now()
);
alter table public.habitudes_documents enable row level security;
revoke all on public.habitudes_documents from public, anon, authenticated;
grant select, insert, update on public.habitudes_documents to authenticated;
create policy habitudes_lecture on public.habitudes_documents for select to authenticated using (owner_id = auth.uid());
create policy habitudes_creation on public.habitudes_documents for insert to authenticated with check (owner_id = auth.uid());
create policy habitudes_modification on public.habitudes_documents for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Factures et acomptes naissent en SQL (preparer_facture, preparer_acompte, facture directe) : on complète à la création
-- seulement ce qui est vide. Les verrous de finalisation restent inchangés.
create function public.factures_habitudes() returns trigger
language plpgsql set search_path to 'public' as $$
declare h public.habitudes_documents%rowtype;
begin
  select * into h from public.habitudes_documents where owner_id = new.owner_id;
  if not found or new.statut <> 'brouillon' then return new; end if;
  if new.date_echeance is null and h.echeance_facture_jours > 0 and new.date_facture is not null then
    new.date_echeance := new.date_facture + h.echeance_facture_jours;
  end if;
  if coalesce(btrim(new.remarques), '') = '' and btrim(h.remarques_facture) <> '' then
    new.remarques := h.remarques_facture;
  end if;
  return new;
end $$;
create trigger factures_habitudes before insert on public.factures for each row execute function public.factures_habitudes();
commit;
