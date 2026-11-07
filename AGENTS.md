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
- Version conflicts are raised with SQLSTATE 'PT409' (HTTP 409), never '40001'. Why: the Data API retries 40001 indefinitely, which hung every conflict request.
- Each business table (clients, articles, entreprises, devis, factures, reglements, avoirs) has a single access module in src/data/ and SQL-function-only writes; detailed rules live in src/data/AGENTS.md. Why: keep RLS/trigger invariants in one place.

- Product priority (user 07/10/2026): reproduce the observed Khosmos v2.4.2 interface and familiar navigation before adding new extensions. Reference screenshots are in ../outputs/references-khosmos; they are private and must never be included in code delivery. Missing functions must be visible as « En développement », with no simulated actions or invented financial indicators. Keep Les Frères Mayet branding and frozen document data intact.
- Lots use the existing public description prefix through src/lib/lots.ts; never rewrite saved or finalized documents to add groups. Render only contiguous groups in the chosen order. Historical Ens/U units replace their exact native equivalents only, without changing calculations.
- Purchase tracking uses src/data/achats.ts as its sole read access module with owner-keyed Query caches; the activity chart combines activiteAnnuelle in HT with a year-filtered purchase read through pure src/lib/marge-graphique.ts rules, not the monthly view or quote costs. The UI has no purchase writes. Why: chart margins must match its HT bars without changing frozen totals or manual imports.
