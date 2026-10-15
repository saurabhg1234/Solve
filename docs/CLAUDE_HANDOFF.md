# Zora — comprehensive handoff to Claude

Prepared **15 October 2026** at Saurabh's explicit request to transfer development to Claude. Times below carry UTC or Dubai (UTC+4) labels. This document is the current entry point; older milestone notes are historical evidence, not necessarily current status.

## 1. What the user wants

Build **Zora**, Mindmap Digital's first-level solutions consultant and proposal creator, to reduce reliance on a human solutions team. This is a custom branded application grounded in the supplied BRD, current business deck, company research, approved templates, historical proposals, RFPs and demo assets. Outputs include detailed Word proposals, PDFs, PowerPoint decks, spreadsheets, email drafts, real demos and walkthrough videos.

The user wants an agent that receives project/solution requests from Microsoft email, works with humans, creates and independently checks deliverables, and continues useful work without being repeatedly prompted. The portal is hosted on Vercel. **All eight workflows are in the first pilot**; a smaller W3/W4/W5/W8 pilot was explicitly rejected. Advait Mahajan is the operational testing counterpart.

The user's last instruction is to create this complete handoff and update the repository for Claude. That authorises Claude to take over development. Earlier instructions rejected Claude/model APIs in favour of Codex sessions for the application's reasoning runtime. That old restriction must not be interpreted as refusing this handoff. However, no production runtime migration, Claude credential, model API integration or unattended Claude deployment has been supplied or implemented here. Separate the choice of development assistant from the implementation of Zora's production agent runtime; resolve a runtime change when it becomes necessary, while continuing independent engineering.

Communication expectations: keep building, avoid repeatedly requesting completed setup or received inputs, distinguish actual activity from future plans, and report what is running after the chat closes. The user was understandably confused by “pilot in progress” when no developer was actually running in the background. Use “partially built” and name the deployed components precisely.

## 2. Repository, branches and production

| Item | Current value / evidence |
|---|---|
| GitHub | https://github.com/saurabhg1234/Solve |
| Implementation branch | **`codex/zora-foundation`**; all application code and this handoff are here |
| `main` at handoff | `1421c75ef4aa15a675e0b91f66f818ea7d16ccac`, original uploaded source assets; not the application branch |
| Last commit before this handoff | `90e1f310da5f7f4b3ad9d21e61f1b9f3268cd8b4`, unattended-runtime documentation |
| Last deployed application code | `a5d99c5`, mailbox monitoring and thirteen-file intake support |
| Production origin | https://zora-mindmap.vercel.app |
| Current verified deployment | `dpl_352vJ2KSipPy93LisTnqAxR21ogH`, `READY` |
| Deployment URL | https://zora-mindmap-79arvttk7-saurabhs-projects-b11d59ff.vercel.app |
| Vercel project | `zora-mindmap`, `prj_CMo2oudsZpGIt0JiuYLjV5mPjcyA` |
| Vercel team | `team_5DBsUWiufrEcP2odn32rtSJD`; existing Pro plan |
| Durable database | Existing connected Neon PostgreSQL; reuse its private `DATABASE_URL` |
| Existing checkout | `/workspace/Solve` |
| Existing private tools/data | `/workspace/solve-environment`, plus ignored `/workspace/Solve/.zora` |

No merge to main, default-branch change, new application deployment or infrastructure migration is part of this documentation handoff. A clone of main alone will miss the implementation. On a new machine:

```bash
git clone --branch codex/zora-foundation https://github.com/saurabhg1234/Solve.git
cd Solve
git status --short --branch
```

On the existing machine, preserve the current checkout and user changes. Do not create another worktree or reset to main. The platform already isolates cloud tasks. GitHub authentication in the old cloud environment is provided through an HTTPS proxy; an absent `GH_TOKEN` did not mean Git access was missing. A new Claude environment needs its own authorised repository access.

Do not resume, fork or import Codex thread `01a13551-d307-7611-94a6-476ff4aa0f2a`. It failed with `invalid paginated history lineage ... missing source rollout`. That is a platform conversation-history problem, not a repository or credential problem. All useful durable state is in the repository, database and private source storage.

## 3. Verified state at transfer

Fresh live verification at **2026-10-15 04:42 UTC / 08:42 Dubai** confirmed:

- Production deployment `READY`, with Vercel cron enabled at `*/5 * * * *` for `/api/microsoft/maintenance`.
- Actual successful automatic cron events at **04:30:06, 04:35:06 and 04:40:06 UTC** (08:30, 08:35 and 08:40 Dubai), each recorded as `actor=vercel-cron`, `ok=true`, `busy=false`.
- Manual `NODE_USE_ENV_PROXY=1 npm run routine -- check` also passed, with zero new messages synced. This is a bounded maintenance check, not an agent launch.
- Last inbox sync **04:41:49 UTC**; current Graph subscription expires **2026-10-18T12:41:56.945Z**. Future cron runs renew it when required; an expiry timestamp alone is not proof of future health.
- **22 complete private source versions**, including **13 email attachments**, **zero customer pursuits** and **zero human approvals**.
- Unsigned mailbox-status and maintenance requests return **401**, after passing Vercel's outer deployment protection through the authorised automation transport.

The database schema has 18 application tables from the deployed migration. Sources are retained as drafts; their import is not knowledge approval. No real all-eight proposal run has been accepted.

**Running after this handoff:** Vercel portal, Microsoft notifications and the Vercel five-minute mailbox monitor. **Not running:** an unattended Codex/Claude dispatcher, background autonomous developer or complete automatic proposal pipeline. Do not switch off the working monitor during a runtime migration.

## 4. Product scope and workflow contract

Canonical requirements: `AI_Solutioning_Agent_BRD_v1.0/01_BRD/AI_Solutioning_Agent_BRD_v1.0.docx` and its PDF. `data/brd-index.json` indexes **272 requirements and 120 workflow/shared steps**; index coverage is not implementation coverage. Read the BRD's house rules, per-workflow checks, escalation rules and commercial constraints directly. User decisions below override conflicting original role/provider assumptions.

| Workflow | Intended output and acceptance focus |
|---|---|
| W1 | Company-specific introduction PPT; five evidenced pain points, consultant decisions, approved-template slide duplicates and client-relevant architectures |
| W2 | Existing demo/video shortlist with relevance, talk track, maturity, branding and data/reuse checks |
| W3 | Transcript-based PPT or detailed Word/PDF; timestamped requirements, confirmed baseline/design, as-is/to-be, architecture, Gantt/RACI, sourced ROI where available, S1 and deep QC |
| W4 | RFP response in buyer order/format; clause/addendum reconciliation, independent understanding, compliance mapping, individually approved deviations, five pre-draft checks, S1 and submission checks |
| W5 | Buyer clarification workbook plus separate internal tracker; only unanswered, consequential questions, simple/complex wording, no identifying company name in anonymised Q&A |
| W6 | Functional domain demo, process map/specification, test evidence and run sheet; 10–12 meaningful sub-agents where BRD requires them, real in/out-of-sample tests and human acceptance |
| W7 | Actual branded walkthrough video of a working demo, with approved voice/recording tools, correct screens/captions and no build-platform leakage |
| W8 | Sourced branded email draft; calm concise tone, no invented promises, unapproved prices/timelines or free demo/POC offers; human release/sending |
| S1 | Internal effort/cost/commercial workpapers, independent technical review and Ganesh's pricing approval; no internal rate/margin leakage into client documents |
| S2 | Fresh independent reviewers, source/hash/element coverage, findings/fixes, explicit loop limits and human escalation |

W1/W3/W4/W5/W6/W7 retain routing confirmation. W2/W8 show the routing card and proceed under the defined flow. Autonomous intake must create a proposed case/routing decision without fabricating these confirmations. Ambiguity should be resolved with the consultant.

Review profiles include D1 compliance, D2 contradiction, D3 internal consistency, D4 scope/promises, D5 visuals/tables, D6 proofread, D7 commercials and D8 source check. Do not use a reviewer's own drafting context. A new reviewer verifies fixes. Missing evidence, unsupported media or deferred policy values must produce precise holds. Review coverage IDs are necessary protocol evidence, not proof of semantic quality.

## 5. People, roles, identity and settled decisions

| Person / responsibility | Address and current assignment |
|---|---|
| Saurabh | `saurabh@mindmapdigital.ai`; admin and consultant; must visibly receive copies of outgoing Zora mail |
| Advait Mahajan | `advait.mahajan@mindmapdigital.ai`; consultant, testing counterpart and demo-team coordinator |
| Ganesh Thyagarajan | `ganesh@mindmapdigital.ai`; pricing owner |
| Sales | Bid owners; named accounts still needed from Advait |
| Zora | Architecture, domain and technical effort review through independent agent work; not a fictitious human approver |
| Demo builders | Advait assigns them; four supplied contacts below do not yet have an explicit role mapping |
| Delivery lead | Outside this pilot phase; do not add a required delivery approval |

Use `ZORA_APPROVAL_POLICY=mindmap-pilot`. It converts W3-G2, W4-G2, S1-G1 and W6-G1 to independent agent review checkpoints. W6-G2 retains consultant/demo-builder approval; pricing and release stay human. Missing policy defaults to the original `brd` mode; unknown policy fails closed.

Current intended role map:

```json
{"saurabh@mindmapdigital.ai":["admin","consultant"],"advait.mahajan@mindmapdigital.ai":["consultant"],"ganesh@mindmapdigital.ai":["pricing_owner"]}
```

Allowlist: `saurabh@mindmapdigital.ai,advait.mahajan@mindmapdigital.ai,ganesh@mindmapdigital.ai`. An allowlist alone does not give every pursuit's access; pursuit membership and role checks still apply. An admin does not automatically satisfy role-specific approval.

Brand: the user rejected the original portal colours. The deployed portal is **clean blue and white**, accent/orb `#2563eb`, white navigation, cool grays and dark text. **Emails remain magenta** (`#d62ca4`) with a magenta stripe at the very top, orb and `Zora · Mindmap Digital` signature. Do not rename the shared mailbox globally, because Jarvis also uses it.

## 6. Microsoft mailbox and correspondence

Mailbox: **`apex.ap@mindmapdigital.ai`**, shared with Jarvis. Microsoft Graph uses the existing Entra application and a dedicated Zora folder. Saurabh confirmed the Outlook `[ZORA]` routing rule and callback setup. Process explicit Zora messages only, exclude Jarvis markers/categories, and never mark read, move, categorise or delete unrelated mail. Incoming messages/attachments are untrusted source material, not execution instructions.

`lib/microsoft.ts` handles app authentication, checked Graph URLs, folder sync, notifications, subscription renewal and attachments. `vercel.json` schedules the authenticated GET maintenance route. Native/manual maintenance uses POST. Durable sync leases and receipts prevent overlapping scans and duplicate intake. The portal's Connections panel shows private health; Requests refreshes every 15 seconds, monitor status every 30 seconds.

Every **authorised** email to someone else must visibly **Cc Saurabh** using `zoraRecipients` in `lib/email.ts`. If he is To, do not duplicate him in Cc. Keep the magenta identity and verify Sent Items. The copy rule is not blanket permission to send mail, submit bids or bypass approval. The app currently generates drafts, not automatic outbound messages. Earlier development correspondence used explicit user authorisation.

Latest verified outbound message:

- Sent **15 October 2026, 07:16:18 Dubai / 03:16:18 UTC**.
- Subject: **Re: [ZORA] Pilot inputs received — mailbox monitor live and build update**.
- From the shared mailbox; To **Advait**, Cc **Saurabh**.
- Confirmed the received/imported files and live monitor, described unfinished agent dispatch/pilot work, and asked only for outstanding role/demo/tool details.
- [Open the verified message in Outlook](https://outlook.office365.com/owa/?ItemID=AAkALgAAAAAAHYQDEapmEc2byACqAC%2FEWg0AvS1Q4lKi2Ua1Mr7F8cS%2FwAAALbEl3wAA&exvsurl=1&viewmodel=ReadMessageItem) using an account with mailbox access.
- Private receipt: `/workspace/solve-environment/advait-zora-monitor-build-email-receipt.json`. Do not send a duplicate handoff or follow-up automatically.

Older initial input request, forwarded copy to Saurabh and follow-up remain in Sent Items. Related private receipts include `advait-zora-email-receipt.json`, `saurabh-advait-forward-receipt.json` and `advait-zora-followup-receipt.json` under the same private directory. The one-off `.zora/send-advait-build-update.ts` uses an idempotence journal. Do not reuse it as a general sending service.

Graph operational caution: `graph()` expects a relative path such as `users/...`, without an initial slash. A successful Graph send can return HTTP 202 with no JSON body; the current JSON helper can then throw a parse error. Inspect Sent Items/a saved receipt before retrying an ambiguous send. Never infer “unsent” solely from that parse error.

## 7. Sources, business knowledge and assets already received

### Original tracked sources

The Git repository contains the original BRD DOCX/PDF, `00_READ_ME_FIRST.pdf`, `MindMap AI Business Deck Oct 2026.pdf`, the reference slide deck and five slide templates under `AI_Solutioning_Agent_BRD_v1.0/02_Templates/`. Keep their bytes unchanged. Nine original sources were imported into private knowledge as drafts.

Official website: https://www.mindmapdigital.ai. Read `MINDMAP_KNOWLEDGE.md` and `ZORA_BLUEPRINT.md`. Research covered the homepage, About, MindMap OS, Model Estate, DocGenie and customer stories; private snapshots are at `/workspace/solve-environment/research`.

Mindmap positions itself around sovereign enterprise AI inside client infrastructure, MindMap OS (accelerator library, model estate, deploy kit), forward deployed engineers and outcomes. It also offers AI CoE, Service-as-a-Software and engineering practices. Do not confuse the client's proposed on-premises deployment with Zora's own Vercel/agent hosting.

Preserve model maturity: Charaka 1.5 and Lekha 2.5 were listed live/stable; Vanij 1.0 limited production; Bhasha 1.0 POC; Rasayana development. Do not say all five are production models. The website/deck disagree on retainers and contain differing broad production claims; resolve per pursuit with source dates and pricing ownership. Counts, logos, certification, ROI and customer outcomes need source/permission checks. Keep anonymised customer cases anonymous.

### Advait's reply and thirteen attachments

Advait replied **14 October, 11:35 Dubai**, supplying **13 attachments / 33,864,456 bytes**, the Drive library and four contacts. All thirteen originals are stored as complete private knowledge drafts, with immutable message/attachment provenance and hashes. The repeat import reused the same versions. Read `ADVAIT_INPUTS.md` before requesting anything.

| Material | What is available and how to use it |
|---|---|
| CompareIQ Word proposal | Explicitly nominated by Advait as the Word layout. Real inspection/build/tagged-PDF export passed; 19 style/media parts retained, 25-page internal format trial. Replace old client content, scope, prices and static contents/page references in new drafts. |
| Seven one-slide PPTs | Two case-study layouts plus agents, methodology, offerings, periodic table and problems. Use source-specific brand/claim checks. |
| Indigrid ZIP | 33-page RFP, technical response and commercial proposal. Buyer clarifications/addenda are absent; commercial source stays internal. |
| PP 2.0 / Parker ZIP | 12-page RFP, three-page buyer Q&A, questionnaire, call transcript and final response. Best first W3/W4/W5 benchmark. The final response is comparison material, not a drafter/reviewer answer key. |
| Coty ZIP | Buyer instructions, response DOCX, response workbook and twelve process PDFs. Response DOCX is a blank buyer template, not a completed submission. |
| Tender application ZIP | Source tree retained/inspected without execution. Contains Base44/InvokeLLM dependencies; do not copy its model integration or run unknown scripts as part of source extraction. |
| Demo transcripts / library | Transcript DOCX and accessible Google Drive root/categories. First index found 45 videos plus two subfolders across sixteen categories; not a full recursive inventory, playback check or functional acceptance. |

Drive library: https://drive.google.com/drive/folders/1W-DQtB-3ZYsmqmfNS_VRlchlSq5suUEP?usp=sharing.

Private local root: `/workspace/solve-environment/advait-inputs-2026-10-14`; includes originals, manifest, expanded files, preparation evidence, format trial and `demo-library-index.json`. Bounded extraction produced 221 files without executing code. Source preparation processed 32 Office/PDF documents into **15,439 location-linked passages, zero extraction holds**; all passages remain unverified. The Indigrid commercial file is internal.

For Parker, the buyer answers already specify redirect-only payment handling, redirect integrations for Trualta/FindHelp, and ICS calendar export. Do not ask these again as unanswered RFI questions or invent replacement services.

### Recovering private assets on another machine

Private client inputs are intentionally **not in Git**. A Claude clone will not receive `/workspace/solve-environment`, `.zora`, credentials or private receipts. The thirteen original attachments are durable in Neon `zora_knowledge_versions`, alongside the nine original sources; they also remain in the authorised mailbox. Do not ask Advait to resend them just because a new machine lacks the old working directory.

Use an authorised admin/owner session in the existing portal's knowledge library, or an authorised private database export, to restore exact bytes. `GET /api/knowledge` lists accessible versions with pagination; `GET /api/knowledge/{id}/file` returns authenticated bounded byte ranges. The runner bearer token is not a human library-session token. Non-approved drafts are restricted to owner/admin. Use 2 MB ranges and verify final SHA-256/length against metadata; do not blanket-approve drafts to make them downloadable. For an authorised DB restore, export only the intended file rows to private storage and avoid printing bytes/content to logs. Re-extract safely and regenerate derived evidence if old local caches are unavailable.

## 8. Architecture and code map

Stack: **Node 24, npm 11, Next.js 16.4.0 App Router, React 19.3, TypeScript 5.9, PostgreSQL/Neon, Microsoft Graph**. `jose` handles sessions, Zod contracts, `pg` runtime DB connections, Neon HTTPS migration/administration in the old cloud environment. Python/LibreOffice format documents outside Vercel. No Claude SDK, model API client or general AI SDK is installed.

| Area | Main files |
|---|---|
| Portal, tabs, workflow cards | `components/portal.tsx`, `app/page.tsx`, `app/globals.css`, `components/orb.tsx`, `app/icon.svg` |
| Review, sources, feedback, knowledge, health UI | `components/case-review.tsx`, `case-files.tsx`, `gate-feedback.tsx`, `knowledge-library.tsx`, `mailbox-monitor.tsx` |
| Workflow catalogue and state machine | `lib/catalogue.ts`, `lib/engine.ts`, `lib/cases.ts`, `lib/result.ts` |
| Identity, roles and configuration | `lib/auth.ts`, `lib/config.ts`, `app/api/auth/*` |
| Microsoft ingestion / renewal | `lib/microsoft.ts`, `app/api/microsoft/*`, `app/api/mailbox/status/route.ts`, `vercel.json` |
| Source/artifact byte handling | `lib/files.ts`, `lib/uploads.ts`, case/worker upload and file routes |
| Reusable sources | `lib/knowledge.ts`, `app/api/knowledge/*`, `scripts/import_reference_assets.ts` |
| Independent QC | `lib/reviews.ts`, `review-plan.ts`, `review-manifest.ts`, `app/api/reviews/*` |
| ESC-1/2/3 and feedback | `lib/gate-feedback.ts`, `escalation-explanation.ts`, `trust-reset.ts`, `trust-reset-contract.ts`, case decision/trust-reset and worker escalation routes |
| Native Codex bridge | `scripts/cloud_routine.ts`, `worker/transport.ts`, `worker/runtime.ts` |
| Legacy optional runner | `worker/run.ts` — incomplete for the current protocol; do not launch unchanged |
| Source/document tooling | `scripts/prepare_sources.py`, `build_documents.py`, `build_rfi.py`, `build_costs.py`, `build_transcript.ts`, `build_email.ts` |
| Email rendering/privacy | `lib/email.ts`, `native-email.ts`, `email-preview.ts` |
| Database | `db/001_init.sql`, `scripts/migrate.ts`, `lib/db.ts` |
| Requirement index | `data/brd-index.json`, `scripts/index_brd.py` |

The 18 tables are `zora_cases`, `zora_jobs`, `zora_sources`, `zora_events`, `zora_approvals`, `zora_mail_state`, `zora_mail_receipts`, `zora_artifacts`, `zora_inbox`, `zora_mail_signals`, `zora_case_members`, `zora_uploads`, `zora_qc_runs`, `zora_reviews`, `zora_review_contexts`, `zora_knowledge_versions`, `zora_gate_feedback`, and `zora_draft_contexts`. File bytes are stored in PostgreSQL, not a separately provisioned object bucket. Migrations are repeatable; preserve explicit SQL statement boundaries and provider TLS.

Pursuits and jobs are version/source-revision bound. Claiming creates an expiring lease; source changes invalidate stale work and approvals. Outputs must be real stored files with exact hashes, declared visibility and purpose. Internal workpapers require both pursuit access and the appropriate role. W5's `rfi_review` tracker has a narrow consultant/bid-owner exception; it does not expose general pricing workpapers.

Native bridge commands include `check`, `claim`, `heartbeat`, `prepare`, `build`, `build-rfi`, `build-costs`, `email-context`, `build-email`, `build-transcript`, `complete`, `escalations` and `explain`. Read the relevant guide before use. `check` performs maintenance only. `claim` requires a real native `CODEX_THREAD_ID`, permits one job per native task, creates a private packet/workspace and may claim independent review. **Claude must not invent a Codex thread ID to get past this guard.** A provider adapter needs its own genuine session identity and matching isolation/continuation semantics, plus regression coverage.

## 9. What is implemented versus unfinished

Implemented and tested foundations:

- Blue/white portal, all-eight catalogue, manual/email case intake, durable queue, team access, source versions, approvals and revisions.
- Work-account sign-in implementation, private API access checks and origin protection. Real user interactive sign-in is still unaccepted.
- Microsoft Zora-folder notifications, delta catch-up, subscription renewal, duplicate protection, isolated attachment intake and five-minute live cron.
- Private chunked source/output storage and safe previews/downloads, reusable knowledge lifecycle and pinned source snapshots.
- Independent-review job protocol, actual document inventory, creator/reviewer context restrictions, packet/hash/element coverage checks, explicit clean/max-loop policy and stale-run cancellation.
- Native source extraction/OCR, Word/PPT template-preserving edits, multi-template slides, bounded picture replacement, tagged PDF export, W5 workbooks, exact-decimal S1 worksheets, sourced W8 drafts, PDF source transcripts.
- File-linked human feedback, ordinary correction routing, ESC-1 records, immutable ESC-2 original-producer explanations, isolated ESC-3 fresh drafting packets/results.

Not completed or not accepted:

- Automatic incoming-email classification/thread linking into proposed pursuits, plus an actually deployed unattended execution dispatcher.
- Actual fresh independent semantic reviewer runs on real proposal outputs; synthetic context IDs/tests do not establish reviewer quality or session isolation.
- **ESC-4:** root-cause checklist updates, independent checks from the BRD return point, linkage to regenerated draft hashes, a next-human-gate re-evaluation-note reading flow, and controlled escalation closure.
- Changed-source escalation reconciliation; pre-draft D2/D3 continuation; automatic original-producer resumption; complete fix/disagreement orchestration.
- Buyer-specific spreadsheet-template mapping and unsupported/large-media paths where the current code holds.
- Verified speaker/timestamp transcription for recording-only requests; actual W6 demos, W7 recording/voice/editing and functional acceptance.
- Approved reusable company claims, configured deferred business/QC policies, full interactive sign-in acceptance and all-eight workflow acceptance.
- Automatic outbound mail or bid submission. Existing draft and human release boundaries must not be removed accidentally during runtime work.

ESC-3 deliberately leaves the pursuit blocked and escalation open. Do not “fix” this by clearing the escalation immediately. Original-producer explanations require the real original completed task/workspace; unavailable history is a limitation, not permission to impersonate it. Fresh drafting excludes old drafts and previous reasoning, while retaining only the allowed sources/baseline/findings/explanations.

## 10. Unattended execution: missing connection and options

Current: **email → durable inbox**, and separately **confirmed pursuit → queued stage**. Nothing deployed wakes a reasoning agent to bridge these steps. Vercel request handlers do not host a permanent agent process. Starting `routine claim` periodically alone still does not classify raw inbox messages or satisfy intentional human gates.

Read `AUTONOMOUS_RUNTIME.md`. The last recommendation was a persistent cloud worker using official Codex CLI sessions with ChatGPT authentication, plus triage, a supervised dispatcher, fresh reviewer sessions, leases/retries/heartbeats and failure visibility. The user found that setup burdensome and requested this Claude transfer. **No worker host or account/plan choice was supplied, no Codex automation token was created, and no worker was activated.** Do not present that recommendation as a settled implementation choice.

`worker/run.ts` is a legacy prototype. It claims without the new context identity, handles only older stage results and deliberately blocks independent QC. It must be replaced/upgraded before production use. The current native bridge depends on actual Codex context identity and one-task isolation. Preserve the queue, artifacts, human gates and isolation contract when adding a Claude-compatible runner; do not merely replace a CLI executable name.

Earlier native cloud scheduling instructions were overconfident and have been corrected. No schedule-creation tool was exposed in this chat. Current Scheduled documentation does not establish that a scheduled web task can attach this Solve shell/document environment; desktop project automations require an awake host. Team Tasks and Workspace Agents have separate availability/auth/tool constraints. The documented Workspace Agents trigger is not a generic endpoint for resuming this chat. Verify the selected provider's actual capabilities before promising unattended execution.

A true acceptance run must start from a tagged email with all chats closed, produce a routed case and stored draft, run a genuinely separate reviewer, reach the correct human gate, and recover after a worker restart without duplicate output/send. A separate bounded engineering queue can continue improvements between client requests once implemented. “Always available” still needs account usage/error handling and an independently operated service.

## 11. Credentials and configuration — names only

Existing credentials are present in the old cloud workspace and configured in Vercel where required. They are **not transferred by Git**. Rebind existing authorised values securely in Claude's environment; never paste them into prompts or commit them. Check names/presence and actual operations before asking Saurabh to recreate anything. Do not dump the environment, `.env` files, auth caches or private receipts.

| Setting | Purpose / location |
|---|---|
| `DATABASE_URL` | Existing Neon connection; server and authorised migration/operations tooling |
| `ZORA_APP_URL` | `https://zora-mindmap.vercel.app` in production |
| `ZORA_SESSION_SECRET` | Human-session signing; existing secret |
| `ZORA_RUNNER_TOKEN` | Trusted queue transport; not a model login or human session |
| `ZORA_WEBHOOK_SECRET` | Graph client-state verification; existing 32–128 character secret |
| `CRON_SECRET` | Maintenance bearer authentication; does not itself create a schedule |
| `ZORA_NOTIFICATION_BYPASS` | Existing Vercel automation bypass for protected service requests |
| `Tenant` / `MS_TENANT_ID` | Existing Microsoft tenant binding |
| `Client` / `MS_CLIENT_ID` | Existing Entra application client ID |
| `Client_secret` / `MS_CLIENT_SECRET` | Existing Microsoft application secret |
| `Object` / `MS_SERVICE_PRINCIPAL_OBJECT_ID` | Service-principal object ID, not app-registration object ID |
| `EMAIL` / `MS_ZORA_MAILBOX` | Shared Zora/Jarvis mailbox |
| `MS_ZORA_FOLDER_ID`, `ZORA_SUBJECT_TAG` | Existing dedicated folder; `[ZORA]` marker |
| `ZORA_ALLOWED_EMAILS`, `ZORA_ROLE_MAP` | The approved accounts/roles above |
| `ZORA_APPROVAL_POLICY` | `mindmap-pilot` |
| `VERCEL_TOKEN` | Deployment/administration only; do not expose to web or drafting processes |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Existing team/project IDs above |
| `ZORA_WORK_ROOT`, `ZORA_REPO_ROOT`, `ZORA_WORKER_ID` | Private worker paths/identity for a future dispatcher |
| `ZORA_DOCUMENT_PYTHON` | Optional bridge override for the document Python interpreter |

The four application secrets (session, runner, webhook and cron) were securely aligned with Vercel; do not rotate them independently. No model key exists as an application requirement. The canonical Microsoft variables being absent is normal when the supplied aliases are present; `lib/config.ts` supports both.

Known housekeeping: the old cloud's saved `ZORA_NOTIFICATION_BYPASS` contains malformed/non-ASCII display text. `worker/runtime.ts` safely retrieves the **existing** valid production binding through the supplied Vercel credentials, restricted to the expected project/team/host. Live maintenance passes with that fallback. Rebind the real existing value privately when moving environments; do not copy a redacted/display value or create a replacement unnecessarily. The old saved cloud allowlist also omitted Ganesh while production includes him; align with the intended role map when updating settings.

The old environment uses `NODE_USE_ENV_PROXY=1` for outbound HTTPS with proxy-bound secrets. Placeholders are resolved by that platform, not necessarily usable raw credentials on another host. Do not copy its proxy/auth internals. Direct PostgreSQL sockets may be unavailable there; the migration script uses Neon's supported HTTPS driver for verified Neon hosts. Vercel runtime uses `pg`. Preserve TLS verification.

## 12. Development setup and reproducible checks

Read `AGENTS.md` before coding. This repository's Next.js version has breaking conventions; consult installed framework docs, not assumed older APIs. Use the lockfile with `npm ci`.

```bash
node --version                 # handoff: v24.19.0
npm --version                  # handoff: 11.9.0
npm ci
npm run typecheck
npm test
npm run build
```

For ordinary development use `npm run dev -- --port 3001`. Without production bindings, the UI is a no-client-data preview and private APIs fail closed. Use a dedicated local PostgreSQL database and synthetic identity/mailbox for integration fixtures; never run fixture deletion/insertion against Neon production. Node child processes used for local tests must receive local settings explicitly so inherited production credentials cannot redirect them.

### Document toolchain

Existing interpreter: `/workspace/solve-environment/.venv/bin/python`, Python 3.12.14. To reproduce on a new machine, install Python/venv support and create a private environment, then install these tested versions:

```bash
python3 -m venv /workspace/solve-environment/.venv
/workspace/solve-environment/.venv/bin/python -m pip install \
  pypdf==6.10.0 python-docx==1.2.0 python-pptx==1.0.2 \
  Pillow==12.3.0 PyMuPDF==1.26.6 lxml==6.1.1 \
  typing_extensions==4.16.0 XlsxWriter==3.2.9
/workspace/solve-environment/.venv/bin/python -m pip check
```

Adjust private paths for the receiving host and set `ZORA_DOCUMENT_PYTHON` if needed. Install a supported LibreOffice distribution exposing **`soffice` on PATH**, English Tesseract and required fonts. Handoff machine: `soffice --version` reports LibreOfficeDev 26.8.0.0.alpha0; `tesseract --version` is 5.5.0. The `libreoffice` command alias is absent, but `soffice` works and is what the builder invokes. Use a supported available release on a new host and verify rendering rather than assuming identical output. Preserve font availability/metrics and inspect pages/slides visually.

```bash
soffice --version
tesseract --list-langs
/workspace/solve-environment/.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

Native Python tests cover document preparation/build/RFI, image replacement and costs. Browser testing also needs Playwright/Chromium. The old workspace has those in `/workspace/solve-environment/browser-tools`; they are not project dependencies and will not arrive through Git.

### Local database and API fixtures

Existing retained container: `zora-dev-db`, loopback port **55432**. Private synthetic config: `/workspace/solve-environment/zora-local-test.json`. It is not the production credential file. Its app origin is `http://127.0.0.1:3001`, mailbox `local-fixture`, folder `fixture-folder`, policy `mindmap-pilot`, and local-only random secrets.

Synthetic accounts are `tester@mindmapdigital.ai` (consultant), `pricing-tester@mindmapdigital.ai` (pricing_owner), `outsider@mindmapdigital.ai` (consultant without case membership), `demo-tester@mindmapdigital.ai` (demo_builder) and `admin-tester@mindmapdigital.ai` (admin/consultant). If recreating this fixture on another machine, generate local-only secrets and a loopback database connection privately. Several integration scripts currently hardcode that config path; port it deliberately rather than reading a similarly named production file.

Run `npm run db:migrate` only with the intended database settings explicitly supplied. `scripts/migrate.ts` is repeatable and uses explicit transaction/statement boundaries. Start the local app with synthetic settings and preload `scripts/local_graph_fixture.mjs` **only in development**. It rejects a non-synthetic mailbox and must never be enabled in production. `ZORA_LOCAL_MONITOR=1` enables the monitor fixture; other tests document their own mode. The old untracked launcher is `/workspace/solve-environment/start-monitor-test.mjs`; a fresh host must recreate the small launcher with its local config rather than assume this private file is in Git.

Run database fixtures **sequentially** with `node --import tsx scripts/<test>.ts`. Relevant tracked suites:

- `test_local_api.ts`: uploads/downloads, hashes, access, leases, revision and origins.
- `test_local_mail_monitor.ts`: cron/manual auth, separate heartbeats, idempotence, Jarvis exclusion and status privacy.
- `test_local_reviews.ts`: fresh contexts, isolated packets, complete element coverage, explicit policy and stale cancellation.
- `test_local_documents.ts`, `test_local_costs.ts`, `test_local_emails.ts`, `test_local_transcripts.ts`: actual native helper contracts and persisted artifacts.
- `test_local_knowledge.ts`, `test_local_private_sources.ts`: source reuse/version/approval and commercial privacy.
- `test_local_gate_feedback.ts`, `test_local_explanations.ts`, `test_local_trust_reset.ts`: ordinary correction, ESC-1/2/3 and retained approval holds.

Compiled browser fixtures may use `ZORA_LOCAL_BROWSER=1`, `ZORA_LOCAL_TEST_ORIGIN`, HTTPS loopback proxy/certificates and `NODE_EXTRA_CA_CERTS`. Earlier retained proxy material is in `/workspace/solve-environment/local-ui-tls`. Do not disable certificate validation. The old workspace has a pre-existing port-3000 process; stop only servers you started. Previous owned port-3001/3003 test servers were stopped, while the local database was retained.

### Validation evidence and its limits

For this handoff, **44/44 TypeScript tests, 21/21 Python tests, `npm run typecheck` and `npm run build` passed again**, and the live integration/cron checks in section 3 passed. PDF inventory tests emit a `standardFontDataUrl` warning; it did not fail the tests and is not a claim that every PDF renders identically.

Historical last application release additionally passed the local mailbox/API integration fixtures and compiled desktop/mobile health/refresh checks. Earlier releases passed the independent review, knowledge, document, private source, cost, email, transcript, feedback, explanation and trust-reset suites as described in `BUILD_STATUS.md`. Those are historical checks; do not label every suite as rerun during this documentation handoff. No human interactive sign-in, real independent semantic review, automatic dispatch or all-eight acceptance was established by these tests.

## 13. Deployment and service checks

Reuse the existing Vercel project/team and protected stable hostname. `.vercel/project.json` is ignored machine linkage, not a secret bundle. In a new environment, link the intended existing project using authorised Vercel tooling rather than creating another project. The old CLI is `/workspace/solve-environment/deploy-tools/node_modules/vercel/dist/vc.js`; its installed tooling directory is not in Git.

Build/type/test before app deployment. Root `.vercelignore` excludes original assets, local worker, scripts and tests; its `/worker/` exclusion must not accidentally exclude `app/api/worker`. No application deployment is needed for this handoff's Markdown changes. Do not assume the production build follows main automatically: the verified deployment was made explicitly from the implementation branch.

Service checks with existing secure credentials:

- `/api/worker/mailbox` with runner authentication: connector, database/schema and subscription status; its `automaticProcessingVerified` remains false.
- `/api/microsoft/maintenance` with `CRON_SECRET`: GET for hosted cron, POST for bounded manual/native maintenance. This renews/syncs; it does not start a model.
- `/api/mailbox/status` with an authorised consultant/bid-owner/admin session: last scan, actual cron heartbeat and pending count.
- Vercel deployment API/status and `zora_events` with `type='mailbox.maintenance'`, `actor='vercel-cron'`: actual recurring execution evidence.
- Read-only counts/hashes of knowledge sources, cases and approvals; never populate production with synthetic test cases to make a dashboard look active.

The old cloud environment's saved draft was revision 16, startup pointing to `ZORA_HANDOFF.md`. Some earlier config writes returned `INVALID_ARGUMENT`; don't retry blindly. Saved configuration, publication/snapshot, processes and scheduled execution are separate facts. This handoff did not change the saved cloud runtime configuration.

## 14. Outstanding external inputs — do not ask for received items again

Advait supplied these contacts without role mapping: Shiva Shankar (`shiva.shankarb@qualesce.com`), Faiyaz (`md.faiyaz@qualesce.com`), Nischal (`nischal.n@qualesce.com`), Amarnath (`amarnath@mindmapdigital.ai`). Clarify who builds demos and which named salespeople own bids before granting roles. Keep current access intact.

Already requested in the latest copied email:

- Role mapping and named sales/bid owners.
- Direct working demo links/access, expected results/tolerances, maturity and permitted client-data/branding reuse.
- Existing approved voice/recording/editing tools and licences.
- Additional Indigrid buyer clarifications/addenda, if available.

Advait has no accent preference and said **“Just build it we'll iterate”**. He did not offer a fixed test meeting; continue asynchronously rather than repeatedly requesting availability.

Saurabh deferred business policy values: rate/currency/geography rules, overhead/margin/AI reductions, scoring/recency thresholds, RFI question caps, email policy limits/hype list, QC clean-loop/max-loop values and related tolerances. Missing values hold affected stages. Do not infer rates from historical proposals or use synthetic test values in production. Data-region constraints beyond the existing Neon service remain unspecified. Work-account sign-in still needs real-user acceptance.

No new Microsoft or Vercel credential is needed to continue ordinary engineering in the current authorised environment. A different Claude environment must receive access to the existing bindings, and a chosen unattended runtime may introduce genuine host/auth prerequisites. Ask only for the specific missing access after checking what is already available.

## 15. Recommended next implementation sequence

1. Read this handoff, `AGENTS.md`, the BRD/index, `ZORA_BLUEPRINT.md`, `PILOT_CONFIGURATION.md`, `ADVAIT_INPUTS.md` and `ADVAIT_PILOT.md`. Check out the implementation branch and preserve current state.
2. Verify production mailbox monitoring and private source counts. Restore needed source files privately from Neon/mailbox if the old workspace is unavailable. Do not resend setup emails or create duplicate imports.
3. Resolve an executable unattended runtime path compatible with the user's current provider preference, then implement intake triage/thread association and the dispatcher against the existing queue. Retain genuine fresh session identities, leases, isolation and resumable producer handling; expose errors/paused state in the portal. Use a test proving operation after chat closure.
4. Complete ESC-4 and changed-source/pre-draft continuation without bypassing feedback, source hashes, independent review or human gates. Extend the existing meaningful fixtures for these new transitions.
5. Use Parker for an actual W3/W4/W5 benchmark, approved CompareIQ/slide layouts and source-backed outputs. Test real draft/review isolation and keep the historical response out of independent reasoning packets.
6. Complete W1/W2/W6/W7/W8 with real source/demo/video evidence. Resolve only genuinely blocking missing business/tool inputs. Keep all-eight scope visible.
7. Run Advait's acceptance plan, including deliberate defect injection: contradictory/security claims, unsupported metrics, invented sources, hidden costs, answered RFIs, unrequested scope and free-POC promises. Record exact outputs, hashes, findings, fixes, run IDs and human decisions.
8. Deploy validated increments, update build evidence and handoff, and send only authorised progress correspondence with Saurabh visibly copied. Do not call the pilot complete until all eight workflows have their acceptance evidence.

## 16. Documentation map and private continuity files

| Guide | Purpose |
|---|---|
| `ZORA_HANDOFF.md` | Prior Codex startup/current state; this Claude handoff supersedes its provider-specific startup assumptions |
| `BUILD_STATUS.md` | Chronological implementation/deployment/verification evidence; later entries supersede earlier counts/gaps |
| `YOUR_PENDING_ACTIONS.md` | Narrow current external-input list |
| `ZORA_BLUEPRINT.md`, `MINDMAP_KNOWLEDGE.md` | Product scope, evidence and company positioning |
| `ADVAIT_INPUTS.md`, `ADVAIT_PILOT.md` | Received source inventory and all-eight acceptance |
| `PILOT_CONFIGURATION.md`, `MICROSOFT_365_SETUP.md` | Role policy, exact non-secret values, Entra/mailbox setup |
| `ENVIRONMENT_AND_DEPLOYMENT.md` | Service bindings/deployment; historical choices are superseded by this handoff |
| `MAILBOX_MONITOR.md`, `CLOUD_ROUTINE.md`, `AUTONOMOUS_RUNTIME.md` | Live monitoring, native bridge and unactivated runtime options |
| `INDEPENDENT_REVIEW.md`, `SOURCE_TRANSCRIPTS.md` | QC protocol and image-only PDF source checking |
| `NATIVE_DOCUMENTS.md`, `NATIVE_COSTS.md`, `NATIVE_EMAILS.md` | Deterministic document/cost/email helpers and bounds |
| `REUSABLE_KNOWLEDGE.md`, `PRIVATE_SOURCES.md` | Source versions/reuse and internal commercial access |
| `GATE_FEEDBACK.md`, `ESCALATION_EXPLANATIONS.md`, `TRUST_RESET.md` | ESC-1/2/3 contracts and the outstanding ESC-4 boundary |

Private continuity files are intentionally absent from Git: source originals/expanded passages, website snapshots, generated format trials, local test settings/TLS material, deployment receipts and send receipts. Key paths are listed above. Additional important receipts are `zora-mail-monitor-receipt.json`, `zora-advait-assets-receipt.json`, `zora-trust-reset-milestone-receipt.json` and `zora-blue-portal-receipt.json` in `/workspace/solve-environment`. Use them only if that private workspace is available; otherwise reconstruct current evidence from authorised service queries rather than treating missing local receipts as lost production data.

This handoff transfers the existing implementation and evidence. It does not claim a completed autonomous agent, migrate credentials, release client content, send new emails or approve a provider integration.
