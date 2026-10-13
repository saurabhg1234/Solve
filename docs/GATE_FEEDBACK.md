# Human gate feedback and correction routing

A reviewer can use **Request revision** at an assigned human gate. A note is retained with the stage, pursuit version, source revision and reviewer. Document gates W3-G3/G4 and W4-G3/G4 also require at least one issue with a file, page/slide/section, explicit severity, description, evidence and document/commercial impact. The file must be accessible, from a completed job in the current source revision, and its lease must still match. The saved finding records the filename and exact SHA-256. Up to twenty findings can be submitted together.

Feedback appears in the pursuit and request pack. Ordinary native stage tasks receive it; independent reviewers do not receive human commentary or creator reasoning. If private sources or internal files are involved, detailed notes/findings are restricted to assigned internal reviewers. Other pursuit members see only the stage/status and a generic restriction. Existing case membership, gate role, same-origin and stale-version checks still apply.

## Ordinary corrections

When a rejected gate needs an ordinary correction, the pursuit owner/admin can select **Start correction**. This queues the earlier correction stage, increments the pursuit version and runs subsequent stages, independent checks and human gates again. Earlier human approvals do not approve the new version. Completing the corresponding human gate marks ordinary feedback addressed. Concurrent attempts cannot create duplicate correction jobs. Changed sources require a full revision; the ordinary route applies only to unchanged source revisions. A full revision supersedes ordinary feedback while preserving its history.

The BRD specifies these document return points:

| Gate | Return stage |
|---|---|
| W3-G3 | W3-17 |
| W4-G3 | W4-18 |
| W3-G4 | W3-20 for exclusively commercial issues; otherwise W3-17 |
| W4-G4 | W4-23 for exclusively commercial issues; otherwise W4-18 |

For other gates, the implementation conservatively restarts the relevant earlier work: W1-G1 at W1-4, W1-G2 at W1-11, W2-G1 at W2-1, W3-G1 at W3-5, W3-G2 at W3-8, W4-G1 at W4-3, W4-G2 at W4-8, W5-G1 at W5-2, both W6 gates at W6-1, W7-G1 at W7-1, W8-G1 at W8-2 and both S1 gates at S1-1. These ordinary routing choices are implementation decisions, not additional BRD-prescribed ESC return points. Unit checks validate that every route is an earlier task under both supported approval policies.

## Document escalation: log and explanation

At the four document gates, critical/major issues or any previously unlogged issue trigger an escalation, following BRD section 13.4. A new minor issue is therefore an escalation too. API callers may link an existing completed QC finding only with its review ID/index, exact artifact hash, location, description and evidence; they cannot lower its severity or submit their own QC-escape flag. The linked packet must be accessible to that reviewer. The current form reports new issues; selecting an existing QC finding in the UI remains pending.

The escalation is durably recorded and visible. **Start correction** cannot bypass it. Opening a full revision preserves it, and later document-gate approval rejects unresolved escalations across source revisions. There is deliberately no manually clear-escalation endpoint in this milestone.

Original-drafter explanations are now recorded through the bounded native continuation described in [ESCALATION_EXPLANATIONS.md](ESCALATION_EXPLANATIONS.md). They remain internal and do not resolve an escalation. The rest of ESC is pending: a separate fresh drafting context using only sources/locked baseline/findings/explanation, whole-document re-evaluation notes for human reading, new independent reviewers with root-cause checks, and validated return-point execution. Existing D2/D3 contradiction holds are separate; their complete ESC continuation is also pending. This milestone must not be described as complete trust-reset automation or accepted proposal generation.

## Operations and evidence

Run the repeatable additive migration before deployment. `zora_gate_feedback` is the seventeenth application table; no environment variable, business setting or account role is added. The worker health check includes it.

`tests/gate-feedback.test.ts` covers classification, document return points, all human-gate routing and strict issue validation. `scripts/test_local_gate_feedback.ts` is restricted to loopback/private local test configuration and removes its synthetic records. It exercises correction through fresh reviewer protocol and a new human gate, durable evidence, concurrency/stale/membership/role failures, source changes, internal artifact/packet restrictions, exact QC linking, cross-revision escalation holds and private feedback redaction. Its approvals/reviewer contexts are synthetic protocol fixtures, never real pilot acceptance.

Set `ZORA_LOCAL_BROWSER=1` with the compiled local HTTPS origin for desktop/mobile form and feedback checks. Existing API/review fixtures remain applicable; run database fixtures sequentially. Do not preload the development Graph fixture in production or create synthetic production approvals.
