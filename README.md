# Zora · Mindmap Digital

**Claude takeover:** start with [CLAUDE.md](CLAUDE.md) and the [comprehensive handoff](docs/CLAUDE_HANDOFF.md). The complete implementation is on **`codex/zora-foundation`**; at handoff, `main` still contains only the original uploaded assets. Private credentials/client files are held in the existing services and private workspace, with recovery instructions in the handoff.

Zora is Mindmap’s solutions agent. The full pilot scope is W1–W8, with S1 commercials and S2 independent QC. The current reasoning bridge targets **Codex sessions**, with no model API integration. Saurabh has now selected Claude to continue development; production agent-runtime migration is separate unfinished work. Vercel hosts the review portal, Microsoft notification endpoints and a verified five-minute mailbox monitor. **No unattended reasoning-agent dispatcher is deployed.** Earlier native scheduling assumptions are unverified; see [runtime options and gaps](docs/AUTONOMOUS_RUNTIME.md).

This checkout includes a **tested application foundation**, not a completed implementation of every BRD requirement. It includes the blue-and-white portal identity (with magenta retained for Zora emails), request portal, persistent queue/schema, Microsoft sign-in and isolated email monitoring, Codex request packs, human gates, attachment/private file storage, team access and revision/resume. The native bridge persists real files with hashes and now dispatches independent reviewer tasks. The server inventories document elements, isolates reviewer packets, rejects self-review/incomplete coverage and enforces explicit clean-loop policy before human gates. Native source preparation, approved Word/PPT editing, multi-template slide composition, tagged PDF export and separate buyer/internal RFI workbooks are implemented and locally verified. Advait has supplied the CompareIQ Word layout and real pilot packs; their originals are retained as private drafts. Real native-review acceptance, complete ESC/fix automation, consultant-quality document/demo/video production and all-eight acceptance remain pending. See [the review contract](docs/INDEPENDENT_REVIEW.md) and [your remaining actions](docs/YOUR_PENDING_ACTIONS.md).

Human review now retains file-linked feedback and routes ordinary corrections back through required checks and approvals. Document-gate QC escapes are recorded and block approval across revisions; the remaining fresh-drafter ESC sequence is unfinished. See [gate feedback](docs/GATE_FEEDBACK.md).

The private reusable knowledge library retains source bytes/versions and human reuse decisions, pins selected snapshots to pursuits and holds on withdrawals or integrity failures. Its supplied-asset bootstrap creates drafts only; it does not approve company claims or deliver a proposal.

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
- Word proposal drafting uses the supplied CompareIQ layout with client-specific carryover checks; slides must be edited template duplicates.
- Pilot ownership: sales owns bids, Zora performs architecture/domain review, Ganesh owns pricing and Advait supplies demo-builder names. Delivery approval is outside this phase. Use `ZORA_APPROVAL_POLICY=mindmap-pilot`; see the configuration guide.

## Project guides

- [Comprehensive Claude handoff and continuation plan](docs/CLAUDE_HANDOFF.md)
- [Unattended runtime options and missing intake/dispatcher work](docs/AUTONOMOUS_RUNTIME.md)
- [Product and architecture](docs/ZORA_BLUEPRINT.md)
- [Microsoft 365 setup and shared mailbox isolation](docs/MICROSOFT_365_SETUP.md)
- [Environment variables and deployment](docs/ENVIRONMENT_AND_DEPLOYMENT.md)
- [Advait’s eight-workflow pilot acceptance plan](docs/ADVAIT_PILOT.md)
- [Cloud scheduled task and native-session bridge](docs/CLOUD_ROUTINE.md)
- [Native internal effort/cost worksheets](docs/NATIVE_COSTS.md)
- [Private source inputs and pricing-owner access](docs/PRIVATE_SOURCES.md)
- [Native sourced and branded email drafts](docs/NATIVE_EMAILS.md)
- [Reusable Mindmap knowledge](docs/REUSABLE_KNOWLEDGE.md)
- [Native source and document tools](docs/NATIVE_DOCUMENTS.md)
- [Scanned PDF source transcripts and independent checks](docs/SOURCE_TRANSCRIPTS.md)
- [Human gate feedback and correction routes](docs/GATE_FEEDBACK.md)
- [Original drafter escalation explanations](docs/ESCALATION_EXPLANATIONS.md)
- [Fresh drafting and re-evaluation](docs/TRUST_RESET.md)
- [ESC-4 independent re-run, checklist learning and closure](docs/ESCALATION_RERUN.md)
- [Pilot roles and exact variable guidance](docs/PILOT_CONFIGURATION.md)

The portal is deployed at `https://zora-mindmap.vercel.app`, retaining Vercel protection. Microsoft application authentication, folder access, local PostgreSQL intake/queue checks and deployed connector/access/webhook-validation checks pass. The approved Neon database is connected and its schema migration passes twice through supported HTTPS transport. The four cloud application secrets are securely aligned with Vercel. Advait supplied thirteen attachments and four team contacts; role mapping and specific demo/tool details remain to be clarified. The production mailbox monitor checks every five minutes independently of Codex sessions. Interactive sign-in, actual recurring dispatch and all-eight outputs still need acceptance; a connected database or manually run bridge does not complete the pilot.

Mailbox monitoring is live through Microsoft notifications plus a five-minute Vercel backup; its first automatic heartbeat was verified on 15 October. The Connections screen shows private monitoring health, and Requests refreshes intake automatically. See [mailbox monitoring](docs/MAILBOX_MONITOR.md) and [received pilot inputs](docs/ADVAIT_INPUTS.md).
