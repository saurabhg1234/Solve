# ESC-2: original drafter explanations

The BRD requires the drafting agent to explain why an issue survived its earlier checks, identifying material it missed or added. Zora now records that explanation against each document-gate finding, its exact artifact/hash and the completed task that produced the file. This is a durable ESC-2 input, not a trust-reset completion or a semantic acceptance decision.

## Native continuation

Use the **original completed producer task** and its retained private workspace. Its actual platform `CODEX_THREAD_ID`, job ID and original lease ID must match the stored producer. No new stage claim or renewed stage lease is made. A fresh task cannot adopt the original identity or submit an explanation on its behalf.

```bash
cd /workspace/Solve
export NODE_USE_ENV_PROXY=1
npm run routine -- escalations <original-private-workspace>
# Read escalations.json and explanation.schema.json in that workspace.
# Write a JSON array in explanation.json, one item per relevant finding.
npm run routine -- explain <original-private-workspace> explanation.json
```

`escalations` returns only unresolved escalated findings concerning files produced by that task. Each item identifies the feedback ID, original finding index, artifact ID and SHA-256. The explanation plan repeats those identifiers and includes:

- `cause`: `missed`, `added` or `missed_and_added`.
- `rootCause`: a concise account of the error.
- `whyChecksMissedIt`: why it survived the earlier checks.
- `correctionPlan`: the intended correction and further checks.

Provide a concise, evidence-based account; do not dump private thought processes or reconstruct reasoning that is unavailable. These text fields are bounded to 20–2,000 characters each. A batch contains 1–20 unique findings. A valid shape does not prove the explanation is true or sufficient.

Only completed producer tasks qualify. A blocked, anonymous, differently leased or unrelated task is rejected. Source revisions do not erase history: explanations can still refer to the preserved original file bytes after a later source revision. Exact task, artifact, source-revision and feedback associations are checked. Submissions are atomic and immutable; duplicate or concurrent attempts cannot overwrite the first explanation. If a response was lost, read the recorded explanations before retrying. No explanation changes a pursuit stage, queues work, grants approval or closes an escalation.

## Portal visibility and reviewer isolation

Pursuit members see how many findings have explanations. Detailed explanations remain internal, including when the affected draft is client-visible. Existing assigned internal roles can expand the root cause, missed-check account and correction plan. Other members receive no explanation text or producer context IDs in the pursuit API or request pack. Event payloads contain identifiers only.

Native ordinary stage packets retain these records for continuity. Independent QC packets still exclude drafter explanations and previous reasoning. The later ESC-3 drafter is a distinct type of task: the BRD explicitly requires it to receive the explanation, findings, sources and locked baseline. That isolated fresh-drafter path is not implemented by this release.

## Remaining work and operational limit

Original-task resumption is not scheduled or automated. If the original native task cannot resume or its workspace is unavailable, hold and report that limitation. Never change `CODEX_THREAD_ID`, spoof the original task or use a newly claimed task to fabricate an original-drafter account. The previously reported missing-history failure must not be retried through a failing thread as an onboarding shortcut.

Fresh whole-document re-evaluation, complete section notes, root-cause checklist updates and independent return-point execution (ESC-3/4) remain pending. Pre-draft D2/D3 contradiction escalation continuation is also pending. All existing escalation approval blocks remain, including after every explanation has been recorded. No manually clear-escalation endpoint is added.

## Migration and validation

The repeatable additive migration adds `zora_gate_feedback.explanations`; the application still has seventeen tables. No new account role, environment variable, dependency or business setting is required. The health endpoint checks the column.

`scripts/test_local_explanations.ts` refuses non-loopback application/database origins. It verifies original producer identity, exact evidence, multi-producer isolation, invalid/batched/concurrent/replayed submissions, rollback, internal-detail privacy, native CLI context/path guards, history across revisions and persistent approval blocks. Optional `ZORA_LOCAL_BROWSER=1` checks internal detail and consultant redaction on compiled desktop/mobile HTTPS views. All synthetic cases/workspaces are removed. These protocol fixtures do not establish genuine drafter recall, fresh semantic review or pilot acceptance.
