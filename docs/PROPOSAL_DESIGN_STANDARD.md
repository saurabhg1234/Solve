# Mindmap proposal design standard

Saurabh's 16 October 2026 feedback establishes the manual Pentagon v2.3 proposal as a visual reference. The previous text/table-only rewrite missed the expected standard. Use the reference to learn how a proposal explains a solution, not as a source of reusable client facts, prices or technical guarantees.

Read this file before creating or revising a proposal. A newer task-specific user reference takes priority. Keep client originals, extracted artwork and populated deliverables in private storage, outside Git. The current source and delivery receipts are in [ZORA_HANDOFF.md](ZORA_HANDOFF.md).

## The expected visual language

- White pages, navy headings and lane labels, restrained orange section rules, generous margins and consistent typography. The website's palette and Zora's magenta email identity do not override a supplied proposal design.
- Colour conveys meaning: teal for inputs/capture, indigo for agent steps, blue for orchestration/data, purple for model or sales/service elements, orange for decisions and human actions, green for verified results, grey for operations. Use a visible legend when a diagram needs it.
- Use simple line icons, aligned cards, explicit connectors and grouped layers. Decoration and stock imagery cannot substitute for process or architecture diagrams.
- Explain the business outcome before technical detail. Each figure answers a concrete question, has a caption and connects to nearby prose.

| Reader's question | Preferred visual |
| --- | --- |
| How does work change across teams? | Business journeys with the owning agent at each step |
| Who or what does each action? | Swimlanes for source, agent, human reviewer and destination |
| What happens when a check fails? | Labelled decision branches, exception owner, hold/return path and terminal result |
| What connects to what? | Layered architecture with real dependencies or explicitly labelled logical hand-offs |
| Which deployment option fits? | Consistent option cards showing processing boundary, prerequisites and cost basis |
| How will capacity be chosen? | Evidenced sizing comparison or benchmark decision path; numerical bars require evidence |
| When does each capability arrive? | Gantt timeline with conditions and acceptance gates |
| Who owns each activity? | Responsibility matrix with an explicit legend and one accountable owner per row |
| How are payments staged? | Milestone strip reconciled to the commercial table and latest source |

## Layout rules

1. Preserve useful diagrams when correcting a proposal. If a figure is dense, simplify, split or give it more page space. Removing all visuals is not a readability fix.
2. Use one substantial agent swimlane per page when two would make the labels too small. A longer readable document is preferable to shrinking important figures.
3. Target 10–11 pt body text, 9–11 pt figure content and at least 8.5 pt for short figure labels at the **final printed size**. Captions/footer metadata may be smaller. Judge the exported document, not the full-resolution artwork alone.
4. Keep icon style, card corners, spacing, connector weight and heading hierarchy consistent. Text must fit its box; no label should be hidden under a later row, rule or arrow.
5. Prefer vector SVG artwork with a PNG fallback in Word. Verify that PDF export preserves vector paths and searchable diagram text. Supply vector sources when useful. Word body text and tables remain editable; SVG figures are edited through their vector sources.
6. Include useful figure descriptions in Word. Captions identify the figure and explain its purpose. Check contents-page numbers against the rendered PDF.

## Keep figures and narrative consistent

Copying a figure also copies its claims. Review every label, number, arrow and note against the current source and design.

- A business journey must not imply a dependency that does not exist. Separate parallel service paths and connect them to the record they actually use.
- The diagram and prose must agree on posting/sending approval. A successful model result or rule match is not authority by itself.
- Show reconciliation for unknown posting outcomes. Do not draw a blind-retry loop or label an untested integration as inherently idempotent.
- Local inference does not establish that mail, recording, telemetry or backup processing stays on-premise. Show those boundaries accurately.
- Avoid invented model availability, region guarantees, benchmark throughput or exact supplier pricing. Replace unsupported quantitative charts with an honest decision method, retaining a meaningful visual.
- Source commercial changes explicitly. Identical filenames/version labels can contain different bytes and different payment terms; hash and compare the actual latest attachment.
- Label design choices and unresolved assumptions appropriately. Do not turn a supplied example into a signed requirement, pricing approval or release decision.

## Required production check

Render the completed Word file to PDF and inspect **every page**, including architecture, agent flows, options, timeline and commercials. Fix clipped labels, overlapping rows, broken connectors, blank pages, orphaned headings and incorrect contents references. Confirm that figures are present in both formats and readable at normal viewing size.

Check document/figure counts, source and output hashes, payment arithmetic, figure descriptions, current source distinctions and the intended approval status. Open the delivered production files and compare their bytes to the checked local outputs. A self-check of layout and content does not become an independent QC pass.

## Reusable implementation

[scripts/visuals](../scripts/visuals/README.md) contains semantic scene validation, SVG primitives, an offline searchable atlas, a local browser renderer and a Word SVG/fallback embedding helper. Follow the [diagram workflow](DIAGRAM_WORKFLOW.md), which integrates the Cocoon AI and Cathryn Lavery repositories Saurabh selected for Visual V2. Use clear architecture boundaries, distinct decision shapes, orthogonal rounded routes and reserved focal emphasis. It contains no client-populated examples. Private builds may use these helpers to implement the standard; they are not a substitute for deciding the correct diagram or visually inspecting the result.

This standard is persistent repository guidance for future Zora work. Formal source-library approvals, workflow QC and client release remain separate records.
