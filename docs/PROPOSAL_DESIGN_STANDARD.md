# Mindmap proposal design standard

Saurabh's 16 October 2026 feedback establishes the manual Pentagon v2.3 proposal as a visual reference. The previous text/table-only rewrite missed the expected standard. Use the reference to learn how a proposal explains a solution, not as a source of reusable client facts, prices or technical guarantees.

Read this file before creating or revising a proposal. A newer task-specific user reference takes priority. Keep client originals, extracted artwork and populated deliverables in private storage, outside Git. The current source and delivery receipts are in [ZORA_HANDOFF.md](ZORA_HANDOFF.md).

## Client-facing proposal requirements — 17 October 2026

Saurabh's latest direction applies to **every Word proposal**, including revisions. Deliver a finished client-facing document, with these elements:

- A designed cover with a beautiful, relevant image or illustration, the proposal title, the official Mindmap logo and the official client logo. A small process chart alone is not the cover image. Preserve logo proportions and original artwork; use verified assets from supplied materials or the official company site.
- The Mindmap logo at the top of **every page**. The cover may carry it in the cover layout; subsequent pages need a real repeating header image. Check section changes and first/even-page header settings after PDF export.
- An **About Mindmap Digital** section grounded in the current business deck and official company material. Select capabilities relevant to the engagement. Do not invent customer endorsements, certifications, performance claims or delivery guarantees.
- Direct client prose. Remove internal commentary such as “the notes indicate”, “the supplied manual”, “this revision”, “review draft”, source hashes, authoring tools, AI-generation disclosures and internal QC/dispatcher status. Keep those records in the private handoff. AI may naturally be discussed when it is the proposed solution. Business assumptions, scope boundaries, estimated costs and acceptance criteria still belong in the proposal when relevant.
- Varied visuals chosen for meaning, with particular attention to Cathryn Lavery's diagram-design methods. Use a sequence for message timing, a lifecycle for states, an evidence comparison for matching, a tree for traceability, swimlanes for responsibilities, and a Gantt for delivery. Do not render every concept as the same card chain or swimlane. A feedback loop must represent a real repeatable action.

When PowerPoint is requested, produce the actual editable presentation and a PDF companion. Use a presentation narrative: **cover → About Mindmap → client priorities → proposed solution → agent/capability portfolio → business journeys → architecture and controls → implementation → commercials → next steps**. Put detailed agent diagrams in an appendix. Adapt diagrams to landscape reading size instead of pasting Word pages as slide images. Prefer native PowerPoint text, shapes, connectors, timelines and matrices; preserve the supplied template/theme where appropriate without carrying over another client's content or notes.

**Company slides and ending — additional direction on 17 October:** include a concise, reusable Mindmap company section near the beginning, after the cover/About slide: **what we do, engineering practices, geographic presence and customers**. Use the current business deck for the facts, locations and actual logo artwork. Retain the distinction between current and past customers and do not turn a logo into an endorsement or a named case study. Keep generic capabilities separate from the priced project scope. The final slide must be a designed **Thank you / Let's build** close with Mindmap branding, the client logo and verified contact details. If detailed agent slides follow the main narrative, put the final close after that appendix as well; an agent-detail slide is not an ending. See [the reusable company-slide specification](MINDMAP_COMPANY_SLIDES.md).

For slides, target 18–24 pt body labels and 28–36 pt headings; compact chart axes or short metadata may be smaller. Calculate wrapped heading/body heights separately. Inspect covers for image/title overlap and card headings for overflow. Official logos and cover artwork can be raster images; charts and process visuals should remain editable where practical.

Run `scripts/visuals/client_proposal_preflight.py` against the finished Office files and the exact official logo files. It checks embedded logo identity, cover artwork, repeating Word headers, slide branding, About Mindmap, unresolved Word revisions/comments and common internal-language leaks. It does **not** assess relevance, rendering quality, complete source accuracy or approval. Render and inspect every final page/slide as well.

## The expected visual language

- White pages, navy/blue headings, restrained teal and semantic accents, generous margins and consistent typography. Orange can denote a decision or exception. The website's palette and Zora's magenta email identity do not override a supplied proposal design.
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
2. Use one substantial agent visual per page when two would make the labels too small. Select its grammar from the question being answered; a swimlane is one option. A longer readable document is preferable to shrinking important figures.
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
