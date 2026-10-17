# Native source preparation and document export

Before proposal generation, read [the Mindmap visual design standard](PROPOSAL_DESIGN_STANDARD.md). Saurabh's manual reference establishes substantive diagrams and page-level visual checks as part of the deliverable. [SVG/Word helpers](../scripts/visuals/README.md) support the same active-session authoring work; they do not replace the leased workflow or QC contracts below.

The 17 October client-facing requirements add cover artwork, both official logos, the Mindmap logo on every page, About Mindmap and removal of internal drafting commentary. When requested, supply an editable PowerPoint narrative with its PDF companion. Run the client proposal preflight in `scripts/visuals` and inspect every rendered page/slide. Source hashes, tool provenance and QC status belong in the private build record, outside the client proposal.

For architecture and process figures, follow the [diagram workflow](DIAGRAM_WORKFLOW.md): choose the semantic type, check explicit routes and ports, preserve vector exports, and supply an offline atlas for substantial figure packs. The reusable implementation adapts the two diagram repositories selected by Saurabh without model APIs or a scheduled dispatcher.

These helpers run inside the current claimed Codex task. They never call a model API or create another model session. Codex reads and reasons about the actual sources, writes a bounded build plan, inspects the resulting files and submits them to independent QC and human gates. The helpers format and extract; they do not establish factual accuracy or approval.

## Prepare the claimed sources

```bash
npm run routine -- prepare <private-workspace>
```

The bridge validates the saved job and actual task identity, renews its lease and downloads no additional external content. The helper checks each source's stored SHA-256 and writes private `prepared/evidence.json` and `prepared/source-text.txt`. Each passage retains a source ID/hash, its own text hash and an exact location: Office XML paragraph/table, PDF page/block, workbook cell or text line/timestamp. Original sources remain available. Private inputs retain their visibility on extracted source/evidence records.

Image-only PDF pages use installed Tesseract, ten pages per invocation. Hash/language-bound caches let later invocations continue the remaining pages. Direct helper use supports an explicit zero-to-thirty-page batch:

```bash
/workspace/solve-environment/.venv/bin/python scripts/prepare_sources.py <private-workspace> --max-ocr-pages 10
```

All extraction is marked **unverified**. OCR records include confidence and a rendered page filename; visually inspect that page before relying on a claim. An OCR result does not replace a verified source or bypass the server's image-only-PDF QC hold. Recordings require a verified speaker-labelled timestamped transcript; this implementation does not invent speech transcription. Malformed, encrypted, oversized, unsupported or empty sources return precise holds. Preparation is bounded to 64 distinct sources and 256 MB total workspace input. Limits are 32 MB per source, 96 MB expanded Office packages, 32 MB per archive member and 150 pages per PDF.

## Inspect and edit an approved Word/PPT template

```bash
/workspace/solve-environment/.venv/bin/python scripts/build_documents.py inspect <template-path> --format pptx
npm run routine -- build <private-workspace> build-plan.json
```

Use `docx` to inspect Word. The native bridge requires the plan to be inside the claimed workspace. The template must be in that private workspace or the supplied `02_Templates` library, have its exact SHA-256 declared and be explicitly identified as approved. The original BRD is rejected as a proposal template, even if copied. A plan flag alone is not proof of human approval: the native task must retain the actual approval/source authority. **Advait supplied the CompareIQ Word layout on 14 October and explicitly nominated it as the proposal template.** Its real DOCX inspection, retained-layout build and PDF export pass. Preserve that email authority and exact source hash; replace client-specific content and update static contents/page references in each new draft. See [received inputs](ADVAIT_INPUTS.md).

An Office plan includes `format`, `template`, `templateSha256`, `approvedTemplate`, `output` and optional `pdf: true`. PPT plans specify one-to-one source slide duplicates:

```json
{
  "format": "pptx",
  "template": "<approved-template-path>",
  "templateSha256": "<actual-inspected-sha256>",
  "approvedTemplate": true,
  "output": "outputs/client/draft.pptx",
  "pdf": true,
  "slides": [{
    "sourceSlide": 1,
    "edits": [{"index": 0, "expected": "<exact-original-text>", "text": "<source-grounded-replacement>"}],
    "retained": [{"index": 1, "expected": "<exact-retained-text>"}]
  }]
}
```

Every visible slide text node must be edited or explicitly retained. Word uses `parts` instead of `slides`, with `part` identifying each body/header/footer/footnote/endnote XML part, and the same `edits`/`retained` structure. Resolve comments and tracked changes in an approved template first. Index/hash/original-text mismatches, undeclared retained text, macros, embedded documents and external assets are rejected.

To compose the five supplied templates, retain the base `template` and add `templates` entries with unique `key` values and the same path/hash/approval fields. Each slide chooses `templateKey` (`base` by default). Its layouts, master, theme, artwork and related assets are imported with separate paths; different slide dimensions hold instead of scaling. A build permits at most ten additional templates and 160 MB combined template assets. Original font sizes and run formatting remain. Unselected slides, speaker notes, comments, old document properties and unreachable assets are removed.

Master/layout text and reachable artwork retain their source bytes. Inspect them and the rendered slides for source-client claims, text fit, inherited footers, visual quality and branding; a mechanically retained template is not automatically safe. The QC inventory includes imported masters/layouts and visuals. Ordinary embedded PNG/JPEG pictures can now be replaced through explicit image decisions below. Buyer-specific spreadsheet template mapping remains pending; request an appropriate clean approved layout when needed.

With `pdf: true`, installed LibreOffice exports a current tagged PDF using a private profile. PDF conversion is bounded and must produce the current file. The internal build report records output/template hashes, edited text count, retained style parts and `qcRequired: true`. Keep that report in `outputs/internal` as a workpaper. View the actual rendered pages before submitting: preserved typography does not guarantee that new text fits.

## Replace an existing picture without rebuilding the layout

`inspect` now returns each supported text part's `images`: stable indices, embedded relationship, media part, exact source SHA-256, pixel dimensions, and whether the frame can be replaced. This applies to existing slide pictures and Word body/header/footer pictures. It does not insert a new layout, invent a diagram or treat a supplied architecture reference as client-specific design.

An individual slide or Word part may provide:

```json
{
  "images": [{
    "index": 0,
    "expectedSha256": "<inspected old image hash>",
    "path": "outputs/internal/verified-diagram.png",
    "sha256": "<actual replacement image hash>",
    "altText": "<accurate description of the replacement figure>",
    "sourceNote": "<actual source or build provenance; retained internally>"
  }],
  "retainedImages": [{"index": 1, "expectedSha256": "<explicitly retained picture hash>"}]
}
```

Once image decisions are supplied, every picture in that part must be replaced or explicitly retained with its inspected hash. Without image decisions, the earlier behavior retains the template's original artwork, which still requires visual/carryover review. Existing images on masters/layouts remain source artwork and cannot be edited by this operation.

Replacement bytes must be inside the private workspace, match their declared SHA-256 and be a single PNG/JPEG image within 32 MB and 25 million pixels. The intrinsic aspect ratio must exactly match the original. The builder preserves the original position, dimensions, layout/theme and crop-free frame; it does not guess a new crop, stretch or diagram layout. Cropped, linked, interactive, animated, effect/fallback and vector pictures hold for a suitable approved frame. Replacement assets have a 64 MB working bound; final Office artifacts must fit the existing 32 MB transport bound.

Each changed picture receives its own image relationship, so a logo or shared picture in other frames/slides remains unchanged. Other-template imports keep their namespace/theme. Replaced picture descriptions/titles are cleared and accurate alt text is recorded; unreferenced old assets are removed by package traversal. Original source files and retained artwork are unchanged. The internal build report records old/new hashes, input path, dimensions, alt text and the source/build note. These declarations do not validate what a figure claims. The server's QC inventory now includes image descriptions/titles and their words, as well as visual elements, so old accessible metadata is also reviewable.

Six additional Python fixtures verify shared-image isolation, Word styles/metadata, pixel dimensions and frame positions, different-template composition, real supplied-template compatibility, hash/path/crop/ratio/retention holds, removal of unused old bytes and a rendered PDF containing both the replaced and retained figures. The actual local native queue also stores/re-inventories changed picture artifacts. No synthetic picture is a real architecture, client asset or accepted deliverable.

## Export W5 question workbooks

```bash
npm run routine -- build-rfi <private-workspace> rfi-plan.json
```

The exporter holds when a source packet contains private pricing/internal inputs, so the buyer sheet and consultant-visible RFI exception cannot publish private-source workpapers. The exporter rechecks source bytes through source preparation and requires an explicit `questionCap`, `anonymised` boolean and `buyerTemplateRequired: false`. When a buyer template is required, its mapping holds; do not substitute the standard sheet. Saurabh deferred business settings, so the native task must hold a real cap-dependent stage until the cap is explicitly provided. Synthetic test caps do not configure production.

Each ranked question has a unique `id`, consecutive `rank`, `simple` and `complex` wording, `answerState: "not_found"`, nonempty `impacts` (design/effort/price/compliance/risk), a concrete `impactReason`, and actual `searchedEvidenceIds`. It also needs either `citations` with exact `evidenceId`/`quote` matches or a described `simulationGap` of at least twenty characters. An optional `closestAnswerEvidenceId` locates the strongest possible existing answer. Record excluded candidates in `dropped` with question, disposition (answered/irrelevant/duplicate/cap/contradiction) and reason.

Unverified OCR citations, missing references, changed source hashes, fabricated quotes, duplicate wording, unchecked/answered questions, cap overflow and Mindmap names in anonymised buyer questions/references hold explicitly. Formula-like question text is written as a literal string, never executable Excel content. Overlong Excel cells hold instead of silently truncating evidence. Semantic answer search, relevance, simplification and contradiction checks still require the actual Codex stages and independent reviewers.

Outputs are separate:

- `outputs/client/clarification-questions.xlsx`: only simple/detailed questions with their source references.
- `outputs/internal/rfi-tracker.xlsx`: exact passages, closest answering evidence, searched sections, decision impact, source hashes and excluded/capped questions.
- `outputs/internal/rfi-build.json`: private export hashes/counts, without an approval claim.

The tracker stays internal. At W5-11, declare the exact `outputs/internal/rfi-tracker.xlsx` workbook as purpose `rfi_review`: assigned pursuit consultants/bid owners can read this cross-check sheet and its QC findings. Other internal workpapers and commercial files retain restricted access. Earlier W5 stages should retain it as a private workpaper; only the W5-11 cross-check output receives this narrowly scoped review access.

## Save files and finish this stage

Declare actual files in `result.json` with their `path`, `visibility`, `mimeType` and `purpose`. Client deliverables are `draft`; a confirmed baseline is `reference`; source/build reports and reasoning are internal `workpaper`. Then:

```bash
npm run routine -- complete <private-workspace>
```

The bridge imports byte-accurate files before recording completion. Document helpers renew leases while working and stop if renewal fails. A fresh independent reviewer may prepare its isolated packet, but cannot use the build commands to change its draft. Completion does not send email, release a proposal, submit a bid or record a human approval.

Verified locally: ten Python tests exercise source/hash/timestamp/OCR resumption, actual five-template deck/PDF assembly, Word run/style retention, unchanged architecture PNG/JPEG visual evidence, guards, buyer/internal workbook separation, literal cells and provenance/anonymity/cap checks. The real local queue fixture prepares sources, builds PPT/tagged-PDF/RFI files, persists ten exact artifacts including edited pictures and checks QC inventory plus internal privacy. These are transport/format fixtures, not client quality or full W1–W8 acceptance.


Image-only PDF sources can now use explicit page-linked transcripts with an independent transcription check before ordinary QC. The original PDF remains in the packet; no OCR cache is marked verified. Read [source transcripts](SOURCE_TRANSCRIPTS.md) for the native build plan, privacy, review ordering and limits.
