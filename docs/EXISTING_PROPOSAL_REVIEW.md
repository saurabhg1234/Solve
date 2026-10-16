# Review a supplied proposal

Implemented 16 October 2026. This closes the entry-path gap identified by Advait: meeting notes plus an already drafted proposal can enter independent diagnostic review without recreating the proposal or fabricating a transcript, baseline approval or completed stages.

## Portal

For a W3 or W4 pursuit at its initial stage, paused or awaiting workflow confirmation, the owner/admin can use **Review an existing proposal**. Upload the proposal through the normal file controls first. Select each file explicitly as **Proposal to review**, **Supporting source**, or **Exclude from review**. Every file starts excluded. Provide the actual meeting notes/requirements; remove earlier review findings and agent reasoning from this text. Meeting notes alone can support a selected draft; a recording is optional.

Starting review snapshots the notes, selected file hashes, source metadata, checklist and byte-derived inventory. It queues ten independent passes: D1 twice, D2, D3 twice, D4, D5, D6, D7 and D8. Drafts remain stored as uploaded sources but have `role: draft` in the packet. They cannot also be supporting evidence. No generated artifact/job or historical approval is invented.

Each pass needs a fresh actual native session and complete element coverage. Notes have inventoried `request-notes/…` elements. Selected file downloads use the existing protected review endpoints. Unselected files, prior artifacts/reports, other reviewers' results and producer workspaces are excluded. Source context is descriptive, not verified evidence. Normal internal-file permissions apply at selection and when showing findings.

Findings and missing inputs from a diagnostic pass do **not** cancel the other diagnostic passes. All ten reports are collected. The completed run is `blocked` when any report has a finding/missing input, otherwise `passed`. In both cases the **pursuit returns to paused/blocked**, its stage index stays unchanged, and no approval, release, send or normal workflow QC completion is recorded. The manager can review findings, upload a corrected version and start another snapshot, or resume the regular workflow. A later draft/source change needs a new review; existing reports do not certify it.

The owner/admin can cancel an active diagnostic review. Cancellation or a full revision invalidates leases and queued work; late reports return 409. Expired reviewer leases use the existing fresh-session retry rules. A reviewer context cannot be reused for another pass/rerun on this pursuit. There is no automatic draft correction or clean-loop claim here; normal workflow QC retains its existing policy and baseline requirements.

## Implementation

- `POST /api/cases/:id/existing-review`: authenticated, same-origin owner/admin; exact case version; 1–24 selected files, 64 MB total, 40,000 inventoried elements, 10–20,000 characters of notes. Draft and source IDs must be unique, disjoint, active, accessible and belong to this pursuit. Unsupported/unreadable files fail before queue creation. PDF drafts retain the tagged/structural-copy requirement; this entry does not add OCR support.
- `DELETE` on the same route: exact version plus run ID; cancels only the active existing-draft run.
- Repeatable migration extends `zora_qc_runs` with `purpose` (`stage` or `existing_draft`). Only existing-draft diagnostics may omit `job_id`; a human-started run may omit native creator identity. Normal stage runs still require both. An authorised operator can record their real native context as the creator, excluding self-review.
- `lib/existing-draft-review.ts` prepares the bounded packet and audit event. It does not claim native work. `lib/reviews.ts` uses the existing fresh-reviewer claim/lease/coverage protocol and a separate diagnostic completion branch.
- No new secret, external API or table is required. The normal production migration runs before build. The provider dispatcher still has to start actual fresh worker sessions; queuing ten passes does not prove any is running.

## Verification

57 TypeScript tests, type checking and production build passed. `scripts/test_existing_draft_review.ts` verifies actual local API permissions, excluded-file privacy, draft/source separation, concurrent start rejection, inventoried notes, packet/coverage checks, ten separate synthetic contexts, collection after findings, clean and failing terminal states, no stage/job/approval fabrication, rerun identity exclusion, cancellation and revision invalidation. The existing independent-review fixture also passed, including normal clean loops, private finding protection and role-gated release.

`scripts/test_existing_draft_ui.mjs` verifies the compiled desktop/mobile flow (1440/390 px): exact file selections/notes, excluded prior report, ten queued passes, overdue dispatcher indication, cancellation, no approval action, no overflow or page errors. All test sessions are explicitly synthetic and local. These tests establish protocol behavior, not real independent semantic review or acceptance of all eight workflows.
