# Zora · Mindmap Digital

Zora is Mindmap’s solutions agent. The full pilot scope is W1–W8, with S1 commercials and S2 independent QC. Proposal reasoning and creation run in **Codex sessions**, with no Claude or model API integration. Vercel hosts the review portal and Microsoft notification endpoints. The chosen pilot dispatch is a native cloud scheduled task; its bridge and prompt are prepared, but schedule creation still needs the product's Scheduled UI.

This checkout includes a **tested application foundation**, not a completed implementation of every BRD requirement. It includes the magenta orb identity, request portal, persistent queue/schema, Microsoft sign-in and isolated email monitoring, Codex request packs, human gates, attachment/private file storage, team access and revision/resume. The native bridge persists real files with hashes and now dispatches independent reviewer tasks. The server inventories document elements, isolates reviewer packets, rejects self-review/incomplete coverage and enforces explicit clean-loop policy before human gates. Native source preparation, approved Word/PPT editing, multi-template slide composition, tagged PDF export and separate buyer/internal RFI workbooks are implemented and locally verified. Word drafting still requires its missing approved template. Real native-review acceptance, complete ESC/fix automation, consultant-quality document/demo/video production and all-eight acceptance remain pending. See [the review contract](docs/INDEPENDENT_REVIEW.md) and [your remaining actions](docs/YOUR_PENDING_ACTIONS.md).

Sources and generated files support 32 MB per file, transferred in 2 MB chunks. Email intake retains file and inline attachments with provenance, with explicit holds for linked/nested attachments or limits. The portal displays saved drafts and restricted internal workpapers; text/JSON can be read safely in place, while Word/PDF/PPT files download for review. Saving a file does not establish its quality or authorise release. See [current build evidence](docs/BUILD_STATUS.md).

The original `AI_Solutioning_Agent_BRD_v1.0` assets remain unchanged. `data/brd-index.json` indexes all 272 requirements and 120 workflow/shared steps from the Word BRD. An indexed requirement is **not** evidence that its implementation passed.

## Local development

Use Node 24 and npm 11 or newer. The cloud document environment is at `/workspace/solve-environment/.venv`.

```bash
npm ci
npm run dev
```

Without application variables, the portal opens in a public preview containing no client records. Authenticated case APIs fail closed. Configure variables from `.env.example` in a local ignored `.env.local` or your hosting environment; do not commit values.

```bash
npm run typecheck
npm test
npm run build
```

After provisioning a PostgreSQL database and securely supplying `DATABASE_URL`:

```bash
npm run db:migrate
```

The database migration is repeatable and does not delete tables. Preserve provider TLS verification. The application does not disable certificate verification.

## Decisions already made

- All eight workflows are in the first pilot; no workflow has been silently removed.
- Mailbox: `apex.ap@mindmapdigital.ai`, shared with Jarvis. Saurabh confirms the dedicated Zora folder / `[ZORA]` Outlook rule and Entra callback setup are done.
- Reuse existing `Tenant`, `Client`, `Client_secret`, `Object`, and `EMAIL` cloud variables; canonical `MS_*` names are supported too.
- Zora’s identity is a magenta orb and a magenta stripe at the top of every email draft.
- Emails are drafts. The app has no automatic email sending or bid submission implementation.
- Word proposal drafting requires the pending approved Word template; slides must be edited template duplicates.
- Pilot ownership: sales owns bids, Zora performs architecture/domain review, Ganesh owns pricing and Advait supplies demo-builder names. Delivery approval is outside this phase. Use `ZORA_APPROVAL_POLICY=mindmap-pilot`; see the configuration guide.

## Project guides

- [Product and architecture](docs/ZORA_BLUEPRINT.md)
- [Microsoft 365 setup and shared mailbox isolation](docs/MICROSOFT_365_SETUP.md)
- [Environment variables and deployment](docs/ENVIRONMENT_AND_DEPLOYMENT.md)
- [Advait’s eight-workflow pilot acceptance plan](docs/ADVAIT_PILOT.md)
- [Cloud scheduled task and native-session bridge](docs/CLOUD_ROUTINE.md)
- [Native source and document tools](docs/NATIVE_DOCUMENTS.md)
- [Pilot roles and exact variable guidance](docs/PILOT_CONFIGURATION.md)

The portal is deployed at `https://zora-mindmap.vercel.app`, retaining Vercel protection. Microsoft application authentication, folder access, local PostgreSQL intake/queue checks and deployed connector/access/webhook-validation checks pass. The approved Neon database is connected and its schema migration passes twice through supported HTTPS transport. The four cloud application secrets are securely aligned with Vercel. Advait has been emailed for inputs/team details. Interactive sign-in, actual recurring dispatch and all-eight outputs still need acceptance; a connected database or manually run bridge does not complete the pilot.
