# Zora: start a fresh cloud task

Use the same published Solve environment and existing `/workspace/Solve` checkout on branch `codex/zora-foundation`. Do not inherit, fork or resume thread `01a13551-d307-7611-94a6-476ff4aa0f2a`; Codex's thread reader reproduces a missing source rollout for it. A fresh task is a recovery attempt, not confirmation that the platform history has been repaired.

Read `AGENTS.md`, `README.md`, `docs/PILOT_CONFIGURATION.md`, `docs/CLOUD_ROUTINE.md`, `docs/ZORA_BLUEPRINT.md` and `docs/ADVAIT_PILOT.md`. Preserve all existing work and original source assets. Do not create another worktree or reset to main.

Zora is Mindmap Digital's magenta-orb solutions agent. All eight BRD workflows are in the first pilot. All reasoning/document creation runs in native Codex sessions; no Claude or model API integration. The shared mailbox is `apex.ap@mindmapdigital.ai`, also used by Jarvis. Only explicit `[ZORA]` requests in the Zora folder belong to Zora. Saurabh confirmed the Outlook routing and Entra callback setup.

Pilot ownership: Zora performs independent architecture/domain/effort review; delivery approval is outside this phase. Sales owns bids, Ganesh (`ganesh@mindmapdigital.ai`) owns pricing and Advait nominates demo builders. Saurabh and Advait retain consultant roles. Use `ZORA_APPROVAL_POLICY=mindmap-pilot`; do not record technical review as human approval. Sales/demo names are still pending Advait's reply. Other business settings are deferred, and missing values must hold relevant stages.

The portal is deployed at `https://zora-mindmap.vercel.app` with Vercel protection. Production Neon migrations and deployed connection/schema checks passed. The four application secrets were aligned between cloud and Vercel. The Graph subscription was registered and a manual empty-queue check passed. Recurring scheduling is not verified. Advait was sent the authorised magenta-branded request for templates, RFP/RFI/response sets, tender code, demo/video assets, sample pursuits/transcripts, team names and testing availability. Do not resend that email automatically.

Current configuration diagnosis: this cloud binding of `ZORA_NOTIFICATION_BYPASS` contains non-ASCII characters and cannot be used in an HTTP header. It must contain the actual private Zora-project Vercel automation token, not a masked display, description or newly generated application secret. Replace it securely from the existing Vercel value. Never print credentials or put them in Git/chat/task prompts.

First verify the bindings with `NODE_USE_ENV_PROXY=1 npm run routine -- check`. Then follow the bounded native-session bridge in `docs/CLOUD_ROUTINE.md`, keeping human workflow confirmation and approvals in the portal. Do not claim a recurring schedule until Run now and actual recurrence are verified.

This is a tested foundation: full attachment ingestion, generated-artifact import/preview, independent reviewer orchestration/coverage, revision/resume, complete document/demo/video paths and all-eight acceptance remain work. Generated-file and QC stages must hold until verified implementation exists. Use the supplied Word/PPT templates; do not invent layouts or claim unbuilt demos work.
