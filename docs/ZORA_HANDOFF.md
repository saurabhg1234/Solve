# Zora: startup and current handoff

Use the published Solve environment and existing `/workspace/Solve` checkout on `codex/zora-foundation`. Preserve the checkout, private runtime files and all original source assets. Do not create another worktree or reset to main. Do not resume, fork or import thread `01a13551-d307-7611-94a6-476ff4aa0f2a`: its missing-source-rollout history error is a platform failure. Use saved repository/database state. This handoff replaces accumulated historical startup notes; deployment history remains in BUILD_STATUS.md.

## Startup checks

1. Read `AGENTS.md`, `README.md`, `docs/PILOT_CONFIGURATION.md`, `docs/CLOUD_ROUTINE.md`, `docs/ZORA_BLUEPRINT.md` and `docs/ADVAIT_PILOT.md`. Read the installed Next 16 documentation before coding, as AGENTS.md requires.
2. Inspect Git status and preserve existing changes. No source asset, dependency or account role was changed in the last release.
3. Verify live bindings with `NODE_USE_ENV_PROXY=1 npm run routine -- check`. This renews/catches up the dedicated Zora mailbox queue. It does not establish native recurrence or approve intake/workflow decisions.
4. Follow the bounded native bridge in CLOUD_ROUTINE.md for actual queued work. Use real `CODEX_THREAD_ID`; one claim per native task. Fresh reviewers/drafters must not import earlier task history or open other private session directories.
5. Read BUILD_STATUS.md and YOUR_PENDING_ACTIONS.md before reporting a blocker. Do not ask for credentials already supplied. No new environment variable or dependency is needed for the current release.

Saved cloud draft readback remains **revision 16**, with no pending runtime requirements and startup pointing to this file. Earlier configuration writes returned `INVALID_ARGUMENT`; do not retry blindly without a new diagnosis. No configuration write was needed for this release. Saved configuration, a published environment and an active schedule are separate facts.

## Current live build

Production: **https://zora-mindmap.vercel.app**, retaining Vercel protection. Current application code **fe887b4**, deployment **dpl_6WBbW6dwLwnjr7xVu5pYM6w2QfxU**, **READY**, verified **2026-10-14T07:11:14.951Z**. Private receipt: `/workspace/solve-environment/zora-trust-reset-milestone-receipt.json`.

Production has **18 application tables**, **nine real supplied corporate source versions as private drafts**, and **zero pursuits, active jobs, feedback records, drafting-context records or human approvals**. Stored original source hashes were verified; no company claims or source reuse was approved by Codex. Latest live checks pass for storage/schema, active Microsoft subscription, protected case/knowledge/reset APIs and missing-producer denial. The Graph subscription expires at **2026-10-18T12:41:56.945Z**; startup maintenance remains necessary.

This is a tested foundation. None of W1–W8 has full end-to-end acceptance. Local synthetic approvals, contexts and fixtures are protocol evidence only, not real semantic review, client proposals or human acceptance. A final response ends active execution. No recurring native schedule is verified and no invisible background build runs after a final reply.

## Identity, roles and mailbox

Zora is Mindmap Digital's solutions agent. Saurabh requested a clean blue-and-white portal on 15 October: white navigation, blue accents/orb, cool gray backgrounds and dark text. Outgoing emails and email previews retain the previously requested magenta stripe/orb, using the email-specific Orb tone. All eight BRD workflows are in the first pilot, with S1 commercials and S2 QC. All reasoning and document generation run in native Codex sessions: no Claude, model APIs or nested model CLI. Vercel hosts the portal and notification endpoints.

Mailbox **apex.ap@mindmapdigital.ai** is shared with Jarvis. Process only explicit `[ZORA]` requests in the dedicated Zora folder; preserve other mailbox state. Saurabh confirmed Outlook routing and the Entra callback setup. Interactive work-account sign-in and actual native recurrence remain unaccepted.

Use `ZORA_APPROVAL_POLICY=mindmap-pilot`. Saurabh is administrator/consultant; Advait is consultant. Sales owns bids, Ganesh (`ganesh@mindmapdigital.ai`) owns pricing, and Advait nominates demo builders. Zora owns architecture/domain/effort review, never human approval. No delivery role is needed for this phase. Sales/demo names are still pending. Business policies remain deferred; missing rates/currency/reductions/overheads/caps/email/QC-loop settings hold affected stages.

Every **authorised** outgoing Zora email to others visibly Ccs **saurabh@mindmapdigital.ai**; if he is primary To, do not duplicate him. Use `zoraRecipients` from `lib/email.ts`, the magenta stripe/orb and a verified Sent Items receipt. This visibility rule does not authorise automatic sending, bid submission or bypassing release gates.

Advait is **advait.mahajan@mindmapdigital.ai**. The original inputs request, its forwarded copy to Saurabh and one authorised follow-up are verified in Sent Items; details are in BUILD_STATUS.md. Last follow-up: **13 October 21:03 Dubai**, subject **[ZORA] Follow-up: pilot assets, team names and first test**, To Advait/Cc Saurabh. Do not duplicate automatically. Latest related-reply check: **14 October 11:10 Dubai**, **zero replies**, complete pagination. No outbound email was sent in this release.

## Credentials and local runtime

Never dump environment values, credential files or private receipts. The saved cloud `ZORA_NOTIFICATION_BYPASS` contains non-ASCII text. The native transport securely resolves the existing production value using supplied Vercel credentials; live maintenance works without rewriting the binding. Future binding cleanup must reuse that private value, not a masked display, description or new token. The saved cloud allowlist omitted Ganesh although production includes him; align with PILOT_CONFIGURATION.md when changing configuration.

Retained toolchain: Node 24/npm 11, Next 16.4, document Python at `/workspace/solve-environment/.venv/bin/python`, document tools/LibreOffice, and private local configuration `/workspace/solve-environment/zora-local-test.json`. The owned local PostgreSQL container is `zora-dev-db` at `127.0.0.1:55432`. Processes may need restarting after environment restoration. Start/check this service before local database fixtures and run migrations against the explicit local configuration. Never point fixtures at production.

Local development uses port **3001** and development-only `scripts/local_graph_fixture.mjs`. Never preload that fixture in production. Compiled browser checks use Next start on 3001, app origin `https://127.0.0.1:3002`, and retained TLS proxy `/workspace/solve-environment/local-ui-tls/proxy.mjs`. Use its certificate through NODE_EXTRA_CA_CERTS. Browser tooling/Chromium are retained. Stop only processes started by the active task; leave the pre-existing port-3000 process alone. Last release stopped its owned Next/proxy processes and removed all synthetic cases/jobs/feedback/context rows and temporary reset workspaces; the database remains.

## Implemented paths and relevant guides

- Attachments/chunked files (32 MB, 2 MB transfers), private sources/artifacts, scoped team roles, revisions/resume, role/version-bound human gates and retained evidence. PRIVATE_SOURCES.md covers private pricing-source isolation and duplicate/library guards.
- Independent reviewer queue, stored-byte inventories, fresh context checks, full element-ID coverage, explicit clean-loop/max settings, revised-packet cancellation and scoped file endpoints. INDEPENDENT_REVIEW.md records bounds and limits. IDs do not prove semantic checking or cryptographically attest empty context.
- Native source preparation, approved Word/PPT editing, five-template deck composition, picture replacement and tagged PDF export. NATIVE_DOCUMENTS.md covers source hashes, exact frame/style retention and output checks. Approved Word layout is still missing; hold instead of inventing it. Buyer/internal RFI workbooks and the narrow W5-11 consultant/bid-owner exception do not expose other commercial workpapers.
- Private versioned reusable knowledge, pinned pursuit snapshots, source reuse review/retirement and withdrawal/hash guards. REUSABLE_KNOWLEDGE.md covers the nine original assets imported as drafts only.
- Internal cost worksheets and exact arithmetic: NATIVE_COSTS.md. No actual pricing values were configured; Ganesh retains S1-G2.
- Sourced W8 HTML/plain/recipient drafts and safe portal preview: NATIVE_EMAILS.md. Explicit email policy, exact citation hashes, fresh QC and human approval remain required; no automatic send is implemented.
- Page-linked PDF source transcripts: SOURCE_TRANSCRIPTS.md. Exact original/transcript hashes, page coverage/privacy and a fresh SOURCE_TRANSCRIPT pass precede other QC. W8 can use the same source/transcript pair. Retained OCR is unverified. The real 19-page business-deck packaging trial produced 3,829 source elements but received no semantic/source approval.
- Gate feedback/ordinary correction routes: GATE_FEEDBACK.md. Notes/file/hash/location/severity persist; document QC escapes survive revisions and block approval. Ordinary corrections repeat subsequent checks and gates.
- Original-producer explanations: ESCALATION_EXPLANATIONS.md. Native `escalations`/`explain` use the original completed task/lease/context/workspace, immutable finding-level explanations and private detail access. If original history cannot resume, hold; never impersonate its identity.
- **Fresh drafting protocol: TRUST_RESET.md.** Eligible same-source escalations with complete explanations and human-confirmed baseline can queue ESC-3. Only pinned sources/baseline/findings/explanations enter its packet. Earlier draft/reasoning/report endpoints are excluded. Known producer/reviewer/expired contexts cannot claim it; new ordinary stage attempts also retain context history. Native completion stores actual regenerated drafts and a bounded section/finding report, then leaves the pursuit blocked and escalation open. Section claims still need semantic review. Baseline approval comparison preserves PostgreSQL timestamp precision.

## Current verification and remaining engineering

Type checking, production builds and **43 TypeScript unit tests** pass. This release passed `scripts/test_local_trust_reset.ts`, existing explanation/gate/review regressions, actual native claim/download/complete and compiled desktop/mobile start-action, status, section-note and privacy checks. The new fixture stubs only unrelated loopback mailbox maintenance; live maintenance is separately verified. Migration passed twice locally and twice on Neon. Run database fixtures sequentially.

For affected changes use the relevant existing fixtures: `test_local_api.ts`, `test_local_reviews.ts`, `test_local_documents.ts`, `test_local_knowledge.ts`, `test_local_costs.ts`, `test_local_emails.ts`, `test_local_private_sources.ts`, `test_local_gate_feedback.ts`, `test_local_explanations.ts`, `test_local_trust_reset.ts` under scripts. Scanned-email mode is `ZORA_LOCAL_SCANNED_EMAIL=1`; compiled browser mode is `ZORA_LOCAL_BROWSER=1` with ZORA_LOCAL_TEST_ORIGIN. Native Python suites: eleven `test_native_documents.py` tests, six `test_document_images.py` tests and four `test_costs.py` tests using the retained Python environment. Run only suites relevant to the change.

**Next engineering gap: ESC-4.** Implement root-cause checklist updates, new reviewer execution from the BRD return point, linkage to corrected draft hashes, next-human-gate reading of an appropriate re-evaluation note and controlled escalation resolution. Do not clear an escalation merely because ESC-2/3 finished. Changed-source reconciliation, pre-draft D2/D3 continuation, automatic original-task resumption, disagreement/fix automation, real fresh semantic/transcription reviews, real demos/videos and complete W1–W8 acceptance remain pending. No PR was created for this release.

External inputs remain in YOUR_PENDING_ACTIONS.md: approved Word template, real pilot RFP/RFI/answer/final-response sets and brief/transcript, sales/demo accounts, demo/video/tender-code assets/tool choices and testing availability. Work-account sign-in and native recurrence also need actual acceptance. No new secret or role is required to continue engineering.
