# Deliver work completed on request

Saurabh requires requested work to be done in the active session while Claude is off. A completed correction, proposal or review memo can now be saved to its pursuit immediately, without waiting for a scheduled worker or pretending a workflow stage/independent review has completed.

The pursuit shows **Completed work** above workflow progress, with the summary, source revision, timestamp and hash-verified downloads. Earlier-source deliveries remain labeled as such. Connections and progress describe execution on request; they do not tell the user to wait for the inactive hourly dispatcher. Real active reviewer leases and recorded QC counts remain visible separately.

## Native delivery command

Prepare actual files and a private JSON plan in the same directory. Run from the repository root:

```bash
NODE_USE_ENV_PROXY=1 npm run routine -- deliver /private/output-directory/delivery-plan.json
```

Plan fields: a new UUID `id` retained for safe retry, `caseId`, exact `version` and `sourceRevision`, `title`, `summary`, `visibility` (`client` means the authorized pursuit team; `internal` requires an internal role), selected `sources` as `{id,sha256}`, and `files` as `{path,mimeType}`. Up to eight files and 2 MB total are accepted per atomic pack; split larger deliveries. Paths must stay inside the plan directory. Supported formats are DOCX, PDF, PPTX, XLSX, plain text and JSON.

The CLI reads the real native context, hashes the bytes, publishes the pack and writes a private `.receipt.json` beside the plan. It does not accept a fabricated context in the plan. Keep the plan's UUID unchanged after an ambiguous response: the server accepts an exact replay and rejects changed contents under that identifier. This operation stores files only; it does not send email. Existing runner authentication and Vercel protection are retained; no new secret or model API is needed.

## Integrity and workflow boundary

- `POST /api/worker/deliveries` authenticates the runner before bounded JSON parsing, validates canonical bytes/hashes and filenames, locks the case, verifies current source IDs/hashes/revisions, and atomically stores the pack and audit event. Released pursuits need a revision first.
- `zora_direct_deliveries` and `zora_delivery_files` retain immutable manifests/files separately from leased stage artifacts. They do not alter source bytes, case versions/status/stage, queued reviews, human approvals or release records. The repeatable migration adds these two tables.
- Private-source work cannot be published as team-visible. Case membership plus delivery visibility controls both metadata and downloads. Summaries render as inert text; download responses use the existing range, attachment and `nosniff` controls.
- A direct producer cannot subsequently claim an independent review or fresh trust-reset task on that pursuit. A prior independent reviewer cannot publish drafting work on it. The existing genuine-context and reviewer-packet boundaries remain in force.
- Direct outputs are not silently inserted into the old QC packet. A corrected draft needs a new explicit review snapshot; an earlier review cannot certify changed bytes. The UI describes these outputs as drafts/review notes and does not count them as independent passes or human approval.

## Validation

`scripts/test_direct_deliveries.ts` exercises real local authenticated APIs and the native CLI: exact source/revision binding, changed/foreign/private inputs, hash errors, concurrent replay, immutable receipts, private metadata/downloads, ranges, producer/reviewer isolation, released-case protection and unchanged workflow/QC/approval state. Fixtures are synthetic and local only.

`scripts/test_direct_deliveries_ui.mjs` exercises compiled 1440px/390px layouts, actual file downloads, corrupt-transfer rejection, inert summaries, revision labels, accurate independent-review counts and on-request connection wording. Existing diagnostic-review and trust-reset protocol fixtures remain applicable. These tests prove transport and UI behavior, not consultant-quality semantic acceptance.
