# Zora build status — 13 October 2026

The deployed application is a tested foundation. It is not a completed solutions agent, and none of W1–W8 has passed full end-to-end acceptance.

| Area | Current state |
|---|---|
| Branded portal | Deployed at https://zora-mindmap.vercel.app, with magenta orb identity and Vercel protection |
| Company/BRD sources | Company deck/site research and indexed 272 BRD requirements/120 stages available; original source assets preserved |
| Production database | Neon connected; additive file/team/revision schema migrated; repeatable migrations and deployed schema checks verified |
| Microsoft mailbox connection | Authentication and dedicated Zora-folder reads verified; Graph subscription registered; manual renewal/catch-up works |
| Request and approval foundation | Pursuit tracking, queued stages, leases, evidence/source schema and role/version-bound human gates implemented and tested |
| Work-account sign-in | Implemented; user confirms Entra callback setup; full interactive sign-in acceptance unverified |
| Native Codex processing bridge | Bounded claim/heartbeat/complete; downloads sources/prior files and persists generated outputs with hash verification; local real-format transport verified, real proposal processing unaccepted |
| Automatic cloud recurrence | Prepared standalone prompt; saved schedule and actual recurring execution unverified |
| Word/PDF/PPT proposal production | File import/storage/download implemented; consultant-quality drafting/export and acceptance unfinished; approved Word template outstanding |
| Attachment handling | Email file/inline intake and manual uploads implemented; 32 MB per file, 2 MB transfers, provenance/hashes; linked/nested attachments and limits hold explicitly |
| Team access and revisions | Owner/admin assigns approved accounts; role-limited internal files; audited revision/reset and blocked-step resume implemented and tested |
| Independent QC | Fresh-reviewer orchestration, authoritative coverage, clean loops and escalation unfinished; QC stages hold |
| Demos and videos | Full W6/W7 production paths and acceptance unfinished; real assets, team names and tool preferences requested from Advait |
| Pilot scope | All eight workflows remain required; a workflow card/index does not demonstrate delivery |

Latest implementation evidence: TypeScript and 16 domain tests pass. Local authenticated API checks cover chunked file round trips, inline-only attachment intake, provenance, hash/offset/path denial, team isolation, internal-file restrictions, revision conflicts, lease/replay checks, QC holds and origin enforcement. Browser checks on the compiled production build with a local HTTPS origin pass for authenticated reviewer downloads, safe text preview, owner controls, mobile width and zero page errors. Supplied PDF/DOCX/PPTX files are used only as byte-preserving transport fixtures, not presented as generated proposals. Local fixtures are deleted after checks. Production database queries work; there were no real pursuits, queued jobs or unlinked requests at the previous startup check.

Manual mailbox/queue checks pass with the project's valid existing Vercel automation token. The saved cloud `ZORA_NOTIFICATION_BYPASS` binding remains malformed, and the cloud allowlist was missing Ganesh. A temporary private override is not a repaired saved binding or active schedule. Updating the environment's saved start-instructions draft returned `INVALID_ARGUMENT`; draft persistence is unconfirmed. Current startup instructions are committed in `docs/ZORA_HANDOFF.md`.

Build work runs while a Codex task is actively executing. A final reply ends execution; “unfinished” means pending implementation, not an invisible background build. No automatic recurrence is verified.

## Advait email and owner visibility

The original request email is in **apex.ap@mindmapdigital.ai → Sent Items**. It was sent to **advait.mahajan@mindmapdigital.ai** on **13 October 2026 at 4:18 pm Dubai time**, subject **[ZORA] Pilot inputs and team details — all eight workflows**. Original Cc was empty. It asks for the approved Word template, historical RFP/RFI/final-response sets, tender-agent code, accelerator/demo/video assets, sample pursuits/transcripts, media-tool preferences, sales/demo team names and testing availability.

Saurabh subsequently required a visible copy of every outgoing email. Include **saurabh@mindmapdigital.ai** in Cc for messages to others; include him only once if he is the primary To recipient. This is persisted in AGENTS.md, the handoff, routine prompt and `zoraRecipients` helper. Keep the magenta stripe/orb and verify/save actual To/Cc in the send receipt. This preference does not authorise automatic client sends or bypass release decisions.

A copy of the original was forwarded to **saurabh@mindmapdigital.ai** on **13 October 2026 at 5:10 pm Dubai time**, subject **FW: [ZORA] Pilot inputs and team details — all eight workflows**. The forwarded message is verified in the shared mailbox's Sent Items. This confirms sending and the saved message; recipient delivery/read status is not claimed.
