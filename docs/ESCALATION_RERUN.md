# ESC-4: independent re-run, checklist learning and controlled closure

BRD 13.4 ESC-4: “The loop re-runs with new reviewer instances from its return point; the root cause is added to the relevant checklist.” Section 17: “when a human catches something, the team decides whether it becomes a standing rule.” The ESC-3 note is “read at the next human gate”. This milestone implements that protocol. It is not semantic acceptance of any proposal.

## Sequence

1. **ESC-1 → ESC-3 unchanged.** A document-gate escalation is logged, every finding gets an original-drafter explanation, and a fresh drafter completes the isolated whole-document re-evaluation with a stored client draft.
2. **Start independent re-run** (pursuit owner/admin, `POST /api/cases/{id}/escalation-rerun`). Body: `version`, `feedbackId`, and `checklist` — exactly one rule per finding: `{findingIndex, checkers[], rule}`. Checkers must run again between the BRD return point and the escalated gate (for example W3-17→W3-G3: D1–D6; W3-20→W3-G4: D3/D6/D7). Rules are 20–1,000 characters and must be phrased as general checks; reviewers never see drafter explanations.
3. The server re-checks the escalation (open, same source revision, at its gate), the latest ESC-3 run (completed, packet/report hashes intact) and the regenerated draft bytes. It records the rules, moves the pursuit to the return stage, and creates the return-stage QC run targeting **only the regenerated draft** (plus sources and confirmed references). The fresh drafter is the run's creator. Existing claim rules exclude every earlier drafter, reviewer and reset context on the pursuit, so each pass is a new reviewer instance. Any missing input rolls the whole start back; nothing becomes claimable by an ordinary drafter.
4. The escalation becomes `rerunning`. The loop and every later stage/gate run normally. QC findings hold as usual; corrections re-run QC with new reviewers.
5. **Next document gate reads the note.** Approval needs `readNotes: [{feedbackId, reportHash}]` matching the exact ESC-3 note hash, plus a passed QC run at the return stage created on or after the re-run. Each approver's reading is stored in `note_reads`. If the escalation is restricted (internal sources/files), only an approver with internal access can read and acknowledge it.
6. **Controlled closure.** Only completion of that gate approval moves the escalation to `addressed`, storing `resolution` (gate, version, closer, approved roles, note hash, re-run and passed QC run IDs, reviewed draft IDs/hashes). There is still no manual clear-escalation endpoint.

## Checklist learning

`zora_checklist_rules` (19th table) holds each rule with its pursuit, escalation, finding, workflow and target checkers. Rules apply immediately to every later QC packet of their own pursuit. An administrator decides (`POST /api/checklist/{id}`, `decision: standing|declined`, with a note) whether a rule becomes **standing** for every pursuit of that workflow; a standing rule can later be retired. Declined rules remain on their own pursuit only.

Every QC packet now carries `checklist` (applicable pursuit + standing rules for the stage's checkers, at most 100). Reviewers must return `checkedRuleIds` covering exactly the rules for their checker; missing, extra or duplicate IDs are rejected. A recorded rule ID is protocol evidence, not proof that the rule was applied well.

## Visibility

The re-evaluation note is shown to internal readers and, when the escalation is unrestricted, to the workflow's document-gate approvers (consultant for W3, bid owner for W4) so they can read it at the gate. Other pursuit members still see status only. Drafter explanations stay internal. Restricted rule text is hidden from non-internal members.

## Limits

- Changed sources after a re-run starts hold document-gate approval (`Changed-source reconciliation is required`); that reconciliation path is not implemented.
- Pre-draft D2/D3 contradiction escalations (W3-16 / W4 stage D) still hold without an ESC continuation.
- Original-producer resumption, real fresh-session isolation and semantic review quality remain acceptance items. Synthetic fixtures prove protocol only.

## Migration and checks

Additive, repeatable migration: `zora_gate_feedback` gains `rerunning`, `rerun`, `resolution`, `note_reads`; new `zora_checklist_rules`. The runner health check includes them. No new variable, role or dependency.

- `tests/escalation-rerun.test.ts`: checker ranges, rule coverage/validation, rule-ID reporting and note-hash schema.
- `scripts/test_local_escalation_rerun.ts` (loopback only): ESC-3 prerequisite, owner/version/checklist validation, concurrent start, fresh-reviewer exclusion, regenerated-draft-only packet, rule coverage rejection, the 7-pass W3-17 loop, W3-18 D6 rule, note-hash acknowledgement, approver/member visibility, closure record, admin standing/retire decisions and the changed-source hold.

Local fixtures accept `ZORA_LOCAL_TEST_CONFIG` (synthetic config path) and `ZORA_LOCAL_WORK_ROOT`; defaults remain the old `/workspace/solve-environment` paths.
