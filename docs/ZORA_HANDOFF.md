# Zora: current startup and handoff

Updated **16 October 2026** from repository and live service state. Saurabh resumed development with Codex after Claude's changes. This file supersedes the older branch/runtime instructions in historical notes. Do not import the previous chat's history.

## Startup checks

1. Use the existing `/workspace/Solve` checkout on **`main`**, tracking `origin/main`. Inspect status, fetch and reconcile remote changes without discarding local work. Claude merged the former `codex/zora-foundation` branch into main; that retired branch is not the development target. Preserve all original assets and private runtime files. Do not reset this checkout or create a replacement worktree.
2. Read `AGENTS.md`, root `CLAUDE.md`, `README.md`, `docs/AGENT_DISPATCHER.md`, `docs/PILOT_CONFIGURATION.md` and this file. Read the installed Next 16 documentation before framework changes. The comprehensive `docs/CLAUDE_HANDOFF.md` preserves the earlier background; its dated snapshot is not current service state.
3. Check production with `NODE_USE_ENV_PROXY=1 npm run routine -- check`. This catches up the dedicated mailbox and renews its subscription; it does not start an agent or approve a workflow. Inspect actual `dispatcher.wake` events, queue/lease state and cron heartbeats before claiming unattended work is healthy.
4. For native work, use `docs/AGENT_DISPATCHER.md` and the bounded protocol in `docs/CLOUD_ROUTINE.md`. `nativeContext()` accepts the real platform `CODEX_THREAD_ID`, or `claude:` plus the real `CLAUDE_CODE_REMOTE_SESSION_ID`. Never invent either. Each native context claims at most one item. Fresh reviewers must not open earlier workspaces, drafts or reasoning excluded from their packet.
5. Read `docs/SOURCE_CONTEXT_AND_PROGRESS.md`, `docs/BUILD_STATUS.md` and `docs/YOUR_PENDING_ACTIONS.md`. Reuse supplied credentials/templates; do not ask for them again. No new dependency, role, schema or secret is required for the 16 October source-context/progress change.

The original `invalid paginated history lineage ... missing source rollout` error belongs to thread `01a13551-d307-7611-94a6-476ff4aa0f2a`. Do not resume, fork or import that thread. Durable truth comes from Git, the database and stored files. Saved cloud setup revision 16 points to this startup file; that saved configuration is separate from a running provider schedule.

## Application and runtime

- Production: **https://zora-mindmap.vercel.app**, with Vercel protection retained. Project `prj_CMo2oudsZpGIt0JiuYLjV5mPjcyA`, team `team_5DBsUWiufrEcP2odn32rtSJD`. GitHub pushes to **main** deploy to production. Check the deployment's actual Git SHA and READY state after a release.
- **Verified application release: `8f07b18`**, deployment **`dpl_D9owaFwv6dMWuqBfY6eVueTb8gmY`**, READY at **10:37 UTC / 14:37 Dubai on 16 October**. Production serves the new source-context/progress UI, and unsigned context edits return 401. A later documentation-only commit may be the latest deployment; inspect its actual Git SHA. Claude’s preceding application revision was `c69cff1`.
- Claude implemented automatic email intake/triage, ESC-4 re-review/checklist learning and an hourly dispatcher on 15 October. Preserve those changes. `docs/AUTO_INTAKE.md`, `docs/ESCALATION_RERUN.md` and `docs/AGENT_DISPATCHER.md` describe the contracts.
- Scheduled Claude task **`trig_01FStjqDrd8Bm92CqUg3Zuec`** wakes persistent dispatcher **`session_01E6WrJSA5FkgtMqFuxSXwMy`** hourly at :01 UTC. It requests up to five fresh worker sessions; the dispatcher itself never claims work. This Codex chat exposes no tool to manage that Claude schedule or create its worker sessions.
- Latest recorded dispatcher wake in the 16 October audit: **08:01:52 UTC / 12:01 Dubai**, before Advait's new request. Later hourly wakes were overdue when checked. The reason is unverified; Saurabh was asked whether Claude shows an error/usage limit or a paused schedule. Do not claim it was repaired or disable it merely because development resumed here.
- The separate **five-minute Vercel mailbox cron is healthy**: real automatic runs at 10:25, 10:30 and 10:35 UTC were verified. Microsoft subscription expiry was `2026-10-18T12:41:56.945Z`; ongoing maintenance renews it. Unsigned status/maintenance calls return 401.
- Database: **19 application tables**, **22 complete private knowledge source versions** (nine original assets plus thirteen email attachments), **two pursuits**, **zero human approvals** at this audit. No fixture data was inserted in production.
- Real native sessions have processed individual stages. This is stronger evidence than a wake, but **none of W1–W8 has full end-to-end acceptance**. A completed chat does not leave a background Codex developer running.

## Advait's latest email and real requests

Advait replied **16 October, 09:31 UTC / 13:31 Dubai**, subject **“Re: Zora update: live email intake and automatic agent dispatch”**, with Saurabh already copied. He reported three problems: no per-file explanatory context, unclear multiple-file support, and no useful current stage/agent progress. These are addressed by the 16 October implementation below.

His Pentagon pursuit **`b7719635-8f9d-4d4c-9a36-f8588b013c99`**, “3 way match and transcript PO checker”, was submitted at 09:26 UTC as **W3** with a typed scope and `Pentagon_AI_Agents_on_Tally_Proposal_v2.3.docx`. The real W3-1 stage was claimed and prepared in this Codex context: one source, 271 extracted evidence passages, no extraction holds. Inspection found an **existing solution proposal**, not the discovery transcript required by W3-1. Mentions of Fireflies describe proposed system inputs, not an attached meeting transcript.

Native completion recorded a **blocked** result with one private source-intake workpaper. The specific required input is the original discovery transcript with speakers/timestamps, the recording, or an accessible meeting link. Do not invent a transcript, pretend a proposal is one, silently switch workflows or confirm a different route on the user's behalf. If Advait intended another workflow, its owner must choose/confirm that route. Private job `cde9440b-1592-42cd-afd7-7122bff04395` has a finalised blocked result; this native context has used its one claim and must not take another.

The other real pursuit, **`3c050ac6-61b4-4bab-94c0-f63b3fffa87e`**, is Saurabh's W8 Parker follow-up test. Claude completed W8-1 and recorded a W8-2 hold on 15 October. Preserve its recorded results; no human gate has been approved.

A separate Advait Coty email at **05:19 UTC** explicitly addresses **Jarvis**. It was not imported or processed as a Zora request. The shared mailbox must remain isolated.

## Source context and progress release

`docs/SOURCE_CONTEXT_AND_PROGRESS.md` describes the API, privacy and UI behavior:

- Explicit multi-file selection and a staged batch, up to 24 files with the existing 32 MB/file and 2 MB/chunk bounds. Each file has type, optional short label, explanatory notes and visible upload state.
- Existing source context can be edited by an authorised role while the pursuit is paused. Saves retain an audit record and advance both case version and source revision; metadata cannot silently change a running or approved packet.
- Source notes reach stage manifests, independent review and fresh re-evaluation packets as descriptive, unverified user input. File hashes, private visibility and approval authority stay separate.
- Request progress shows the actual current stage, workflow position, next human decision, queued time, live agent/reviewer lease, last contact and last dispatcher check. It refreshes every 15 seconds. Expired leases are not shown as active work; queued requests flag a dispatcher check overdue by more than 90 minutes.
- Labels say “Queued for Zora” / “Zora working”. Blue-and-white portal identity and magenta email identity are retained.

Verification: **56 TypeScript tests**, type checking and production build passed. Real local API fixtures passed for source context, general cases, independent review, trust reset and ESC-4. Review/reset fixtures explicitly check isolated source notes. Compiled browser checks passed at 1440 px and 390 px for batch upload/context editing, inert text rendering, real 15-second progress refresh, overdue/active states, no page errors and no horizontal overflow. These checks establish implementation behavior, not semantic proposal acceptance. No Python implementation changed in this release.

## Identity, people and private sources

Mindmap Digital: https://www.mindmapdigital.ai. Zora is the solutions agent. All eight BRD workflows, S1 commercials and S2 independent QC remain in scope. Native Codex/Claude sessions are supported; the application has no model API integration.

Mailbox **`apex.ap@mindmapdigital.ai`** is shared with Jarvis. Process explicit Zora requests in the dedicated folder; preserve other mail and mailbox state. Human routing/approval/pricing/release/sending gates remain enforced. Claude configured default QC through `ZORA_QC_POLICY`; inspect the actual per-case policy rather than assuming all QC settings are still missing.

Saurabh (`saurabh@mindmapdigital.ai`) is administrator/consultant. Advait (`advait.mahajan@mindmapdigital.ai`) is consultant. Sales owns bids, Ganesh (`ganesh@mindmapdigital.ai`) owns pricing, Zora performs architecture/domain work and Advait nominates demo builders. No delivery approval is required in this pilot. Responsibility mapping for Advait's four supplied contacts remains outstanding.

**Every authorised email to another person visibly Ccs Saurabh**, uses `zoraRecipients` and retains the magenta stripe/orb. Verify the send in Sent Items and retain a private receipt. This visibility preference does not itself authorise a send or workflow release. After the release, Saurabh explicitly requested a reply to Advait. It was sent and verified in Sent Items on **16 October at 10:59:59 UTC / 14:59:59 Dubai**, in the existing thread, subject **“RE: Zora update: live email intake and automatic agent dispatch”**, To **advait.mahajan@mindmapdigital.ai**, Cc **saurabh@mindmapdigital.ai** and **ganesh@mindmapdigital.ai**. It confirms the three deployed fixes, requests the missing discovery source or clarification of the intended workflow, and accurately notes overdue dispatcher health. The HTML retains the magenta stripe/orb. Private receipt: `/workspace/solve-environment/advait-zora-feedback-reply-receipt-2026-10-16.json`. Do not resend automatically. Earlier verified progress emails, including Claude’s 15 October update, also remain in Sent Items.

Read `docs/ADVAIT_INPUTS.md` before asking for assets. Thirteen email attachments total **33,864,456 verified bytes**; all are retained privately with original hashes. The CompareIQ Word layout, slide packs, three project packs, tender code, demo transcripts and Drive library were received. Local source originals/manifests/extractions are under `/workspace/solve-environment/advait-inputs-2026-10-14`. Earlier preparation found 32 documents / 15,439 location-linked passages; extraction is not semantic validation. Supplied tender code has Base44/InvokeLLM dependencies and is not Zora's model transport. Use the retained Parker pack for benchmark work and avoid re-asking supplied buyer questions.

## Retained tools and secrets

Never dump environment values, credentials, client content or private receipts. Reuse supplied Microsoft/Vercel/Neon credentials. The saved cloud notification-bypass binding contains malformed non-ASCII text; native transport securely resolves the existing production value via Vercel without rewriting secrets. Do not replace it with a masked display or new token. Check the production allowlist before altering roles; earlier cloud configuration omitted Ganesh while production includes him.

Toolchain: Node 24/npm 11, Next 16.4, document Python `/workspace/solve-environment/.venv/bin/python`, LibreOffice/document tools and retained Chromium/Playwright. Private local test configuration: `/workspace/solve-environment/zora-local-test.json`. Local database container `zora-dev-db` listens at `127.0.0.1:55432`. Migrate/test only against explicit local fixture configuration, never production. The release needs no new schema, although Claude's earlier production build runs the existing repeatable migration.

Use `scripts/local_graph_fixture.mjs` only for local tests. The 16 October tests used owned Next servers on 3001 (development) and 3003 (compiled); both were stopped after verification. Preserve any pre-existing port-3000 process. Python/browser tools and private audit receipts remain outside Git. Production audit receipts: `/workspace/solve-environment/zora-resume-2026-10-16.json` , `zora-mail-monitor-receipt.json` and `zora-source-progress-release.json`. Native workspace: `.zora/routine/cde9440b-1592-42cd-afd7-7122bff04395/18b03854-8a47-4fa8-b6d8-b3b468a7595c` (private).

## Continue from here

1. Verify the latest deployed main revision and dispatcher health; distinguish mailbox monitoring, scheduled wake, active worker and completed output.
2. Resume Advait's selected W3 after the missing discovery source is supplied and its owner resumes the stage. The uploaded proposal can remain reference material with an explanatory label.
3. Continue real source-grounded workflows, independent semantic review and appropriate human gates. Complete changed-source/pre-draft escalation continuation and original-producer resumption without impersonating identities. ESC-4 is implemented; do not re-list it as wholly missing.
4. Complete all-eight acceptance with real drafts/reviews/demo evidence. Human pricing inputs, role mapping, demo access/expected results/reuse limits and applicable recording/voice licences remain specific external inputs; they do not prevent unrelated engineering.

Use the existing focused fixtures for changed behavior. Run database fixtures sequentially. Do not turn successful synthetic protocol checks into claims of consultant-quality output or a fully autonomous accepted pilot.
