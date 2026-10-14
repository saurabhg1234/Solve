# ESC-3 fresh drafting packet and re-evaluation

An owner/admin can select **Start fresh re-evaluation** on a rejected W3/W4 document gate after all findings have an original producer explanation. This queues a separate `ESC-3` drafting task. It does not clear the escalation, reopen approval or implement the remaining ESC-4 return-point checks.

## Prerequisites and immutable inputs

The escalation must still be open at its rejected gate, with unchanged source revision and complete file-bound ESC-2 explanations. Sources must be present and reusable-source approvals/integrity valid. A reference baseline from the correct W3-6 or W4-3/W4-4 stage must have been confirmed at the workflow's requirement gate under the current role policy. Missing sources/baseline/approvals/explanations hold explicitly. A completed re-evaluation cannot be replaced by starting another one in this source revision.

The server snapshots exact active sources, the latest confirmed baseline producer at each applicable stage, findings and concise explanations. Original source/baseline bytes are checked against stored SHA-256. The packet is bounded to thirty files and 64 MB. Canonical JSON hashing survives PostgreSQL JSONB key ordering. The packet excludes the old draft, previous job results, other references/workpapers, earlier QC reports, producer context IDs and the earlier free-form briefing. Source files may themselves contain historical documents; native tasks must treat them as untrusted evidence, not instructions or reusable reasoning.

Earlier transcript artifacts are not silently added to this restricted packet. A fresh drafter can prepare or transcribe the original source again using the native tools. Missing readable evidence still holds; a previous OCR or transcription claim does not establish truth.

## Fresh native context and scoped files

The standard `npm run routine -- claim` command can lease ESC-3 as a stage task. Its `trustReset` object identifies the packet hash and permitted material; `sources` and `artifacts` contain only originals and locked baselines. There is no `prior` or general `gateFeedback` field. Existing bounded source preparation, template editing, upload, heartbeat and completion tools apply. Use actual approved templates among the permitted sources; do not open another private workspace to obtain layouts or older drafts.

Known producer contexts, prior review contexts and previous expired reset attempts are excluded. Stage claims now retain context history, so future expired producer attempts cannot become fresh drafters. Each native session still claims at most one task. Legacy overwritten attempts without retained history cannot be reconstructed; a context ID is a trusted-runtime identifier, not cryptographic proof of an empty model context. Real standalone session isolation remains an acceptance requirement.

File download endpoints enforce the packet's IDs and hashes, rather than merely checking pursuit membership. Old drafts, unrelated references/workpapers and out-of-packet files are denied. Expired lease IDs, packet changes and source revisions invalidate access. Full revisions cancel queued/leased resets. A retry must use another fresh context and the stored packet. Reset contexts cannot later take ordinary stages or independent QC on that pursuit.

## Required result and visible note

A completed result must store an actual regenerated client draft and include `resetReport`:

- `packetHash`: the supplied canonical packet hash.
- `checkedSourceIds` and `checkedBaselineIds`: each pinned file exactly once.
- `sections`: every document section re-evaluated, with its name, assessment and changes.
- `findingResponses`: each finding index exactly once with its correction.

The native `result.schema.json` includes this contract. Sections and text are bounded; duplicate, missing or foreign file/finding IDs fail. Missing inputs require a blocked result. File-ID coverage and section notes are statements for subsequent checking, not proof that every section is present or correct. This milestone does not automatically infer a whole-document section inventory or establish semantic completeness.

The portal records progress and renders the section note for assigned internal reviewers. Details remain private in case APIs and request packs; other members see status only. A full revision retains prior notes. Regenerated drafts remain unapproved artifacts. Completion leaves the pursuit **blocked** and the escalation **open**; the feedback panel states that independent checks are pending.

## Outstanding ESC work

ESC-4 still needs root-cause checklist updates, new reviewer execution from the correct return point, validated linkage to the corrected draft and a controlled escalation-resolution transition. The next human gate must receive and record reading an appropriate re-evaluation note; that gate-reading flow is not implemented here. Original-producer resumption and pre-draft D2/D3 escalation continuation also remain incomplete. No human approval or sending permission is inferred from an ESC-3 result.

Changed-source escalations need a fresh confirmed baseline and a future explicit reconciliation path; they cannot reuse this same-source shortcut. A recorded section note is not full W1–W8 acceptance.

## Operations and checks

The additive migration adds `zora_jobs.reset_packet`, `reset_packet_hash` and `zora_draft_contexts` (eighteenth table). The context history preserves every new stage claimant, including expired attempts; it does not grant roles. No new dependency, variable, business policy or credential is required. Health checks include these schema additions.

`scripts/test_local_trust_reset.ts` runs only against loopback application/database origins and removes its synthetic cases/workspace. It uses the real native claim/download command; only its unrelated loopback mailbox-maintenance response is stubbed. Live Microsoft maintenance is checked separately. The fixture covers missing explanations/baseline/approval, concurrent starts, original/reviewer/expired-context denial, exact downloaded bytes, excluded drafts, report/output requirements, privacy, replay, revision cancellation and unchanged approval holds. Approvals and reviewer identities are explicitly synthetic. Optional compiled HTTPS desktop/mobile checks use `ZORA_LOCAL_BROWSER=1`. Run database fixtures sequentially.
