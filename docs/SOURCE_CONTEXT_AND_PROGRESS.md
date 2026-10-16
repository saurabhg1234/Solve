# Source context, batch uploads and pursuit progress

Implemented from Advait's **16 October 2026, 09:31 UTC / 13:31 Dubai** reply to “Zora update: live email intake and automatic agent dispatch”. He reported that files could not be explained/tagged, multiple-file upload was unclear, and requests showed “waiting for Codex” without useful progress.

## Source files

The existing picker supported multiple files but immediately started uploading. It now offers **Choose multiple files**, an explicit selected-file list, and one type/label/context form per file. Users may add multiple selections, remove items, and upload up to 24 files per batch, with the existing 32 MB/file and 2 MB/chunk limits. Files upload sequentially against the returned pursuit version. Each file shows its state; a failed item stops the batch, retains completed files and leaves unsaved selections/context available.

Source categories are requirements/RFP, transcript/meeting notes, buyer answers, reference/example, template, commercial input and other. Optional labels are at most 100 characters, notes at most 3,000. These are submitter descriptions, not template approval, verified claims or a change to file visibility. Team/private upload permissions stay unchanged.

Finalising a source upload accepts optional `sourceContext` in `POST /api/cases/{id}/uploads/{uploadId}`. Existing empty-body clients remain supported. Context is saved under `zora_sources.provenance.context` with author/time; file bytes and their SHA-256 remain unchanged. A duplicate upload cannot overwrite the existing file's context or access classification.

**Edit context** uses `PATCH /api/cases/{id}/sources/{sourceId}` with `{version, sourceContext}`. Source access/role and active-state checks apply. Changes require a paused/awaiting-confirmation pursuit and a matching current version. Saving increments both pursuit version and source revision, and retains old/new context in the private audit event. An active request must first open a revision; editing never silently changes inputs used by a running agent or approved baseline.

Stage manifests and request packs retain source provenance. Independent review and ESC-3 packets receive only the current `source_context`, within their existing visibility/packet restrictions. The packet hash binds that metadata; prior audit/context history does not enter an isolated review. Agent instructions describe notes as unverified user context and require checks against actual files/baselines.

## Progress

The pursuit now opens with a progress panel: current stage, workflow position, next human decision, queued time, actual agent/reviewer assignment, latest contact and last dispatcher check. The existing 15-second detail polling refreshes it.

`GET /api/cases/{id}` returns a scoped `progress` object. It reads only current-version/current-source-revision jobs and reviews, with no result text, private notes or other pursuits' data. Worker contact is inferred from the existing five-minute lease; expired contact is never shown as active work. A dispatcher check older than 90 minutes is flagged when work is queued without an active agent. This detects an overdue heartbeat, not its cause; it does not restart a provider schedule or promise an ETA.

The portal's status labels now say **Queued for Zora** and **Zora working**. Human confirmation, human approval, missing input, queued review and actual agent activity are distinct. Workflow position is not a claim that a percentage of document drafting is complete.

## Verification

- `tests/pursuit-progress.test.ts`: real/expired contact, queued/overdue/human states and bounded descriptive metadata.
- `scripts/test_local_source_context.ts`: two real sequential uploads, notes in the worker/request pack, unchanged file hash, revision/stale-write guards, member/role/private-source isolation, queued and active progress.
- Existing API, review, trust-reset and ESC-4 fixtures pass. Review/reset fixtures explicitly assert source context reaches their isolated packets without earlier drafter material.
- `scripts/test_source_context_ui.mjs`: compiled desktop/mobile selection, notes per file, batch upload, editing, safe text, queued/overdue/active states, real 15-second refresh, no page errors/overflow. It uses synthetic routed browser responses, not production writes. Playwright/Chromium paths can be supplied with `ZORA_PLAYWRIGHT_MODULE` / `ZORA_CHROMIUM_PATH`.
- Type checking, 56 TypeScript tests and the production build pass. No new dependency, schema migration, role or credential is needed for this change.

The source-context change is independent of scheduling. Claude's existing dispatcher and intake/ESC-4 implementation are retained. All-eight semantic acceptance remains outstanding.
