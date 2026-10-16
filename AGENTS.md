<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Zora work on request — 16 October 2026

Saurabh's latest direction: **Claude is off for now. Whenever work is requested, do the work in the active session.** Read `docs/ZORA_HANDOFF.md` for current state. This supersedes older instructions to wait for, restore or depend on Claude's scheduled dispatcher. Do not ask Saurabh to re-enable Claude as a prerequisite or restart it without a new instruction.

Carry requested implementation, proposal analysis, document creation, testing and authorized email actions through to concrete results. A queued job or handoff is not completion of requested substantive work. Continue all work possible with supplied sources and available tools; report a specific missing capability or input only for the part it actually prevents. Do not end with an unchanged scheduler explanation when useful work remains.

Preserve truthful QC and approval records: direct analysis is not an independent review, and the same context must not impersonate fresh reviewers or bypass human gates. The bridge's one-item-per-context rule describes its current API, not a limit on ordinary development or analysis in the active session. This documentation change does not remove that API restriction or complete queued checks. Keep mailbox collection running separately and never imply an unattended developer is working after a session ends.

## Zora outgoing email visibility

Saurabh requires a visible copy of every outgoing Zora email. For emails to others, include `saurabh@mindmapdigital.ai` in **Cc**, including setup requests, follow-ups and client emails. If Saurabh is the primary To recipient, do not duplicate his address in Cc. Use `zoraRecipients` from `lib/email.ts` when constructing recipient headers. Keep the magenta stripe/orb on every outgoing email and retain a send receipt with To/Cc and the sent-message location. This preference does not itself authorise sending; proposal/email workflow release and sending remain human actions unless the user explicitly instructs a send.

## Proposal design learned from the manual reference

Before producing or revising proposal documents, read `docs/PROPOSAL_DESIGN_STANDARD.md`. Saurabh expects substantive visuals: business journeys, architecture, agent swimlanes, options, timelines and responsibility matrices as appropriate. Do not replace the visual explanation with text/tables alone. Preserve the latest user-supplied design logic, correct claims inside diagrams as well as prose, and inspect every rendered page. Use readable vector figures with Word fallbacks when possible. Reusable helpers are under `scripts/visuals`; client-specific source assets and populated outputs remain private. This is persistent design guidance, not a formal source/QC/release approval.

For substantial diagrams, also follow `docs/DIAGRAM_WORKFLOW.md` and the project-local `.agents/skills/mindmap-diagrams/SKILL.md`. The user-selected Cocoon AI and Cathryn Lavery methods are adapted into checked semantic scenes, orthogonal routing, accessible SVG and an offline diagram atlas. Use the new scene renderer for connected graphs; source correctness and whole-page visual inspection remain required.
