# Zora · Mindmap Digital

Zora is Mindmap’s solutions agent. The full pilot scope is W1–W8, with S1 commercials and S2 independent QC. Proposal reasoning and creation run in signed-in **Codex sessions**, with no Claude or model API integration. Vercel hosts the review portal and Microsoft notification endpoints. Automatic session launch needs a separate Mindmap-controlled Codex runner.

This checkout now includes a **tested application foundation**, not a completed production implementation of every BRD requirement. It includes the magenta orb identity, request portal, persistent queue/schema, Microsoft sign-in and isolated email monitoring code, Codex request packs, explicit human gates, and a guarded runner scaffold. Artifact import, full independent QC orchestration/verification, source attachment ingestion, revision/resume handling and end-to-end acceptance remain implementation work. QC and generated-file completion deliberately hold rather than accepting unverified claims.

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
- Mailbox: `apex.ap@mindmapdigital.ai`, shared with Jarvis. Proposed routing uses a dedicated Zora folder and `[ZORA]` subject marker, pending final confirmation.
- Reuse existing `Tenant`, `Client`, `Client_secret`, `Object`, and `EMAIL` cloud variables; canonical `MS_*` names are supported too.
- Zora’s identity is a magenta orb and a magenta stripe at the top of every email draft.
- Emails are drafts. The app has no automatic email sending or bid submission implementation.
- Word proposal drafting requires the pending approved Word template; slides must be edited template duplicates.

## Project guides

- [Product and architecture](docs/ZORA_BLUEPRINT.md)
- [Microsoft 365 setup and shared mailbox isolation](docs/MICROSOFT_365_SETUP.md)
- [Environment variables and deployment](docs/ENVIRONMENT_AND_DEPLOYMENT.md)
- [Advait’s eight-workflow pilot acceptance plan](docs/ADVAIT_PILOT.md)

The portal is deployed at `https://zora-mindmap.vercel.app`, retaining Vercel protection. Microsoft application authentication, folder access, repeated local delta sync, local PostgreSQL migrations/intake/queue checks, and deployed connector/access/webhook-validation checks pass. Continuous production webhook delivery, interactive Entra sign-in, production storage, runner sessions and all eight deliverables still require connected validation. Configure the Outlook `[ZORA]` rule and Entra callback described in the updated setup guide.
