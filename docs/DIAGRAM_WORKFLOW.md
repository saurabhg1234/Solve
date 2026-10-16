# Proposal diagram workflow

Saurabh requested a second Pentagon visual iteration and persistent use of two diagram repositories on 16 October 2026. Read the [proposal design standard](PROPOSAL_DESIGN_STANDARD.md) first. The implementation draws on [Cocoon AI's process-flow methods](https://github.com/Cocoon-AI/process-flow-diagram-generator) and [Cathryn Lavery's Diagram Design](https://github.com/cathrynlavery/diagram-design); pinned commits, adaptation boundaries and MIT notices are in [THIRD_PARTY_NOTICES.md](../scripts/visuals/THIRD_PARTY_NOTICES.md).

## Design before drawing

Write the reader's question and select the diagram grammar. Use architecture for components and boundaries, swimlanes for actors and hand-offs, a state map for waits/retries/terminal outcomes, Gantt for time and a responsibility matrix for ownership. Do not turn every topic into the same set of cards.

State output size and audience before rendering. For portrait proposals, use a 1,000-unit-wide canvas at approximately 6.95 printed inches: 19–23-unit text gives roughly 9.5–11.5 pt; 17 units is the floor for short labels. Split detail across figures when more than about nine nodes or twelve edges obscures the main question. Counts are a design aid, not factual permission to omit source requirements.

Use the supplied client design as the brand authority. The current Mindmap proposal profile is white paper, navy ink, blue system emphasis and restrained orange for human decisions, with labelled green results. Use Liberation Sans / Arial locally. Do not import upstream default dark themes, remote fonts, decorative glow or fictional metrics. Monospace is for technical identifiers only. The email orb remains magenta.

## Build and check

1. Derive nodes, actor lanes, boundaries and conditions from source evidence. Separate source requirements, proposed design and unresolved decisions. Identify approval, exception ownership and recovery before drawing the happy path.
2. Use `scripts/visuals/diagram_scene.py`. Explicit geometry is intentional: the author chooses the layout and ports. All node geometry sits on a four-unit grid; edge bends are rounded and orthogonal. Separate parallel return paths, keep arrow labels away from their lines and never route behind a non-endpoint node.
3. Its validator rejects missed/shared ports, diagonal or zero-length segments, node intersections, text overflow, overlapping nodes, overlapping connector strokes, unbridged crossings and arrow-label collisions. It does not prove process correctness, inspect every free annotation or replace visual inspection. Reroute a crossing or split the figure; this renderer does not yet implement crossing bridges.
4. Export accessible SVG with title/description and a JSON geometry record. Use `render_proposal_figures.mjs` for local PNG fallbacks. Use `word_figures.py` to embed SVG + fallback + description in Word. Do not flatten the PDF into screenshots.
5. Build an offline atlas with `build_diagram_atlas.py` when a proposal has multiple substantial figures. It supports search, local scrolling, enlargement, native SVG/PNG downloads and browser print. It has no external fonts/scripts, network calls, analytics or model APIs. Keep the atlas private with the proposal.
6. Render the entire Word/PDF and inspect every page. Check diagram meaning as well as typography: all decision paths, real authority, failure outcomes, data boundaries, dependencies and source-grounded quantities. Confirm version labels, captions, contents references, text bounds, SVG/fallback counts and commercial arithmetic. Exercise atlas controls at desktop/mobile sizes and print.
7. Publish the checked files, compare downloaded hashes and retain receipts. Source references and design methods are provenance, not an independent QC pass or human release approval.

## Reuse and privacy

The generic JSON example and renderer are committed. Client-filled diagrams, private generation scripts, original attachments and output packs remain outside Git. Update the handoff with private paths, exact source hashes, output hashes and verified delivery/send locations. Never overwrite published files in place: use a fresh revision directory.

This workflow is available to native Codex sessions through AGENTS.md, NATIVE_DOCUMENTS.md and the project-local [mindmap-diagrams skill](../.agents/skills/mindmap-diagrams/SKILL.md). It does not install or restart Claude and does not depend on an autonomous dispatcher. Existing template, visibility, source-integrity, review and release rules continue to apply.
