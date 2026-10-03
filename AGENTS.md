<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Management pages live under src/routes/_authenticated/ (client-only session gate → /connexion); why: the whole app is private, only sign-in and password recovery are public.
- Sign-out must call effacerDonneesSession() (src/lib/session.ts); why: in-memory demo business data must not survive a session.
- Clients are stored in the `clients` table (RLS owner_id = auth.uid(), no delete, anon revoked, server-managed dates); src/data/clients.ts is the only access point. Why: step 9 moved clients to durable per-owner storage while entreprise/devis stay in memory.
- Client edits use optimistic concurrency (update … where updated_at = version read) and creations use a client-generated stable UUID per attempt. Why: avoid silent overwrites across tabs and duplicates on retry.
- Catalogue articles are stored in the `articles` table (same RLS/grant/trigger pattern as clients, price in integer cents, unique (owner_id, lower(trim(reference))) incl. archived); src/data/catalogue.ts is the only access point. Why: step 10 persisted the catalogue; quote lines copy article values and stay independent.

- Company profile is stored in the `entreprises` table (one per owner via UNIQUE(owner_id), same RLS/no-delete/trigger pattern, capital numeric(15,2) nullable); src/data/entreprise.ts is the only access point; preview/PDF use only the saved row. Why: step 11 persisted the company profile.
- Quote drafts are stored in `devis` + `devis_lignes` (RLS per owner, lines only via own quote, client/article ownership checked by triggers, line amounts recomputed by trigger); every save goes through the atomic SQL function enregistrer_brouillon(id, version, payload) (SECURITY INVOKER, integer version for concurrency, per-owner counter for BROUILLON-NNN); src/data/documents.ts is the only access point; fake demo documents only shown when Réglages demo mode is on. Why: step 12 persisted drafts atomically.
