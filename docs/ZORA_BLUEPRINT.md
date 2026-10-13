# Zora: product and implementation blueprint

## Intended outcome

Zora is Mindmap Digital’s first-level solutions consultant: it receives a pursuit request, establishes what the client is buying, assembles the right deliverable, checks it independently and works with named humans until release. The first pilot includes **all eight BRD workflows**, plus S1 commercials and S2 QC.

This is a custom build. It follows the supplied BRD, company deck, slide templates and architecture formats. The user’s later instruction overrides the BRD’s proposed Claude integration: **all reasoning, research and content creation happen in Codex sessions. There is no Claude SDK, model API key or direct model API integration.** Microsoft Graph is the mailbox transport; Vercel is the web host.

## Mindmap understanding from the supplied deck

Source: `AI_Solutioning_Agent_BRD_v1.0/MindMap AI Business Deck Oct 2026.pdf`, 19 image-only pages, with OCR extracted during onboarding. OCR was used for study; numerical and certification claims require visual source checks and approved company-profile entries before client release.

- Positioning: sovereign AI installed inside client infrastructure, with forward deployed engineers accountable for outcomes.
- Product: MindMap OS combines an accelerator library, model estate and deploy kit. Accelerators combine a domain model, workflow logic, connectors, guardrails/human review and audit.
- Named model families: Charaka, Lekha, Vanij, Bhasha and Rasayana. The deck distinguishes production, proof-of-concept and development statuses; Zora must preserve those distinctions.
- Business lines: AI Centre of Excellence, Service-as-a-Software, sovereign model families and industry solutions.
- Engineering practices: test automation, RPA/intelligent automation, data/analytics, digital engineering, work management/Smartsheet, managed support, staff augmentation and AI skilling.
- Commercial positioning: outcomes/transactions and retainers, with enterprise delivery and partner channels. Proposals still follow the BRD’s explicit S1 review and client-commercials format.
- Reported case outcomes and company counts are source claims, not automatically approved assertions. Customer logos do not imply endorsement. Anonymised cases stay anonymised unless disclosure is authorised.

Website research now includes the homepage, About, MindMap OS, Model Estate, DocGenie and customer-stories pages. Evidence snapshots are retained outside the checkout under `/workspace/solve-environment/research`. The Model Estate page explicitly lists two live/stable families, Vanij in limited production, Bhasha in POC and Rasayana in development; preserve those statuses rather than repeating a blanket production claim from a different source. See [the sourced company notes](MINDMAP_KNOWLEDGE.md).

For client solution architectures, Zora must derive hosting and data movement from client evidence. Zora’s own Vercel/Codex infrastructure is a separate internal presales deployment; it is not evidence that a client solution runs inside the client perimeter.

## Brand and interaction

Zora is a **magenta orb**, using `#d62ca4` as its identity accent. The portal uses a dark navigation rail, quiet neutral surfaces, restrained magenta accents and clear stage/approval states. Emails use an Outlook-friendly table layout with a magenta stripe as the first visible element, the Zora orb identifier and “Zora · Mindmap Digital” signature.

The shared mailbox display name must not be renamed globally: Jarvis also uses it. Zora identifies its own messages through the routing marker, HTML header and signature. No automatic sending is implemented; the BRD keeps sending as a human action.

## Runtime architecture

```mermaid
flowchart LR
  Mail[Microsoft 365 shared mailbox] -->|Zora folder only| Hook[Vercel verified webhook]
  Hook --> Inbox[Durable inbox and request queue]
  Catch[Subscription renewal and delta catch-up] --> Inbox
  Human[Consultant / Advait] --> Portal[Branded review portal]
  Portal --> Inbox
  Inbox --> Runner[Mindmap-controlled signed-in Codex runner]
  Runner --> Create[Fresh Codex creation session]
  Create --> Artifacts[Versioned evidence and deliverables]
  Artifacts --> Review[Fresh Codex sessions for independent QC]
  Review --> Gate[Required human gates]
  Gate -->|Revision with new version| Inbox
  Gate -->|Release approval| Delivery[Human downloads / sends / submits]
```

Vercel request handlers do not host a permanent Codex process. A Mindmap-controlled machine runs the signed-in Codex CLI, claims a leased request, creates an isolated session directory and returns validated stage results. If no runner is available, an authorised human downloads a request pack and opens a Codex session. Queueing a request is not the same as creating or waking a cloud Codex chat.

PostgreSQL retains pursuits, jobs, leases, source metadata, mail cursors, immutable audit events and version-bound approvals. A database/provider and required region remain to be selected. No model API keys are needed.

## Workflow contract

| Workflow | Deliverable | Critical gates / conditions |
|---|---|---|
| W1 | Company-specific intro PPT | Five evidence-backed pain points; consultant approves pain points and deck; every slide is an edited template duplicate |
| W2 | Existing demo/video shortlist and talk track | Approved demo/video library; relevance, branding and data checks; consultant approves picks |
| W3 | Transcript-based PPT or detailed Word/PDF | Timestamped requirements; locked baseline; architect approval; independent QC; human proofread; S1; deep QC; release |
| W4 | RFP response in buyer format/order | Clause reconciliation; independent understanding; locked baseline; technical design; deviations approved individually; five pre-draft checks; human proofread; S1; submission check; release |
| W5 | Buyer question sheet plus separate internal tracker | Questions must be unanswered and necessary; simple and complex columns; no company name in anonymised bidder Q&A; bid owner/consultant approves |
| W6 | Functional domain demo, specifications, test log and run sheet | Domain owner approves process map; 10–12 meaningful sub-agents; real in/out-of-sample tests; joint readiness approval |
| W7 | Branded walkthrough video | Working demo and run sheet; approved voice/recording tools; no build platform visible; consultant and demo builder approve |
| W8 | Branded email draft | Sourced facts; calm tone; no free demo/POC or unapproved promises; human proofreads and sends |

W1/W3/W4/W5/W6/W7 wait at routing confirmation; W2/W8 show the routing card and proceed. Ambiguous requests must be resolved by the consultant; email ingestion must not guess a workflow from a weak keyword.

## Evidence, QC and confidentiality

The Pursuit Case File contains source documents, evidence passages, requirement versions, parameters, draft versions, QC reports, findings, decisions, approvals and routing history. Every claim links to its document/page/clause/timestamp. Later sources supersede earlier ones explicitly; both are retained where they conflict.

Independent reviewers start fresh with only sources, baseline/reference, draft and checklist. They do not see drafter reasoning or previous reviews. Each pass has a unique run ID and complete element coverage. A new reviewer verifies a fix. Disagreements go to humans.

D1 compliance, D2 contradiction, D3 internal consistency, D4 scope/promises, D5 visuals/tables, D6 proofread, D7 commercials and D8 source check follow the per-workflow BRD profiles. Two consecutive clean loops are the proposed general exit rule; deep QC runs until clean. A configured loop maximum sends unresolved findings to a human.

Pre-draft contradictions and QC escapes at document gates trigger ESC1–ESC4: log, explain, reset trust/re-evaluate in a fresh creation context, and rerun the relevant checks. Reviewers must not claim success from an empty coverage log or invented test output.

Internal man-hours, rates, overhead, AI reduction, margins and commercial reasoning remain separate from client output and are visible only to the authorised commercial roles. Client prices appear only in the one commercial table or required buyer schedule. Architecture data sources must name the actual system/feed and the data it supplies. The BRD’s 17 house rules remain the authoritative checklist.

## Current implementation and next milestones

Implemented foundation: branded portal, all-eight workflow catalogue, BRD index, case creation, durable schema and stage queue, role/version-bound gate logic, Microsoft work-account sign-in, Zora-folder-only notifications/delta sync/subscription renewal, request-pack download and guarded Codex runner scaffold.

Remaining before pilot acceptance: connected database and team access; mailbox routing and permissions validation; attachments into source manifests; artifact persistence/import and review preview; full fresh-session QC orchestration and authoritative coverage checks; revision and resume handling; approval escalation; all document/demo/video paths; end-to-end tests with Advait.

Those items are implementation work, not completed features. The current scaffold intentionally blocks unverified file delivery and QC instead of advancing a pursuit on unsupported claims. An automatic pilot cannot be called ready until these are implemented and tested with the actual runner and source inputs.

## Inputs and decisions still needed

1. Always-on signed-in Codex runner versus manual request packs; this determines automatic launch.
2. Confirmation of shared-mailbox routing and Advait’s work email/roles.
3. PostgreSQL service and data region.
4. Approved detailed Word proposal template and company-profile claims.
5. Approved accelerator/demo/video library, with real asset locations and permitted use.
6. Pending tender agent code and domain-owner input for W6; real RFP/RFI/final-response test sets.
7. Voice, recording and editing tools for W7, compatible with the no-model-API requirement.
8. BRD “To set” business values, currency/geographic rate rules, question caps, classifier thresholds, loop limits and other acceptance tolerances. No guessed value should become a client commitment.
