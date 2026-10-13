# Reusable Mindmap knowledge

The signed-in Knowledge page holds source-backed company claims, Word/slide templates, architecture formats, demo/video references and other firm references. Every proposed version retains the actual file bytes, SHA-256, source origin, author and review decision. It does not call a model API or turn a template index into a delivered proposal.

## Source and approval flow

1. A consultant, bid owner or administrator selects an active source from a pursuit they manage and proposes it for reuse. Company claims require the statement, exact supporting passage and page/section/timestamp. The approved Word proposal layout must be a real DOCX; the BRD is rejected as that template.
2. Drafts remain private to their owner and the administrator. The administrator checks the actual source file, passage, formatting and limitations, explicitly authorises reuse by approved work accounts, and records a decision note. This uses Saurabh's existing administrator role, not a new pilot role.
3. An approval makes that version available to the team. A newer draft keeps the previous approved version available. Approving a replacement supersedes the old version; existing pursuits retain their old, immutable snapshots.
4. A pursuit owner/administrator attaches a currently approved version while the pursuit awaits confirmation or is paused. The actual source plus an approval/version/provenance JSON snapshot are copied into its sources. This changes the pursuit/source revision; it does not silently replace an active draft or prior approval.
5. Withdrawn, missing or hash-mismatched reusable records hold stage completion, independent QC progression and human workflow/gate decisions. Open a revision and retire or replace the source. Retirement disables its current use and retains earlier bytes and decisions for audit. Sources shared by multiple active snapshots remain available until their final use is retired.

Source-reuse approval is not pursuit-specific factual QC, a client commitment, pricing approval, permission to send email or acceptance of W1–W8. Literal passages and claim limits still need actual human/independent checking. The library does not grant Codex a human role or a reusable-source approval endpoint authenticated by a runner token.

## Supplied source assets

The bootstrap importer is limited to the nine original supplied Mindmap assets: five slide templates, the reference slide deck, two architecture PNGs and the October 2026 business-facing deck. Their combined size is **31,253,161 bytes**. It records the repository/path/commit and actual checksum, creates **drafts only**, and creates no customer pursuits or human approvals. The source files remain unchanged.

```bash
cd /workspace/Solve
NODE_USE_ENV_PROXY=1 npm run db:migrate
NODE_USE_ENV_PROXY=1 node --import tsx scripts/import_reference_assets.ts
```

Run this as a deployment/bootstrap operation, not inside the routine's proposal task. The importer uses supported Neon HTTPS transport or the owned local PostgreSQL instance, transfers bounded 512 KB chunks, checks stored offsets/prefixes and verifies final stored bytes with SHA-256. Repetition reuses the same completed versions; interrupted imports resume only from a matching prefix. Partial imports cannot be downloaded, attached or approved. It never resets or overwrites a completed version.

Seeded drafts are private to the administrator until source reuse is approved. The original repository template library remains available to native document tasks under the existing user-provided template authority; importing drafts does not revoke that authority or add a new task permission request. The business deck remains a source requiring verified claims. An approved detailed Word template, real demos/videos and tender code remain outstanding; the importer does not manufacture them.

## Native task and file boundaries

Human-selected snapshots appear in the stage's normal source manifest with their system provenance. The native bridge retains that provenance and verifies downloaded bytes. Claim/inventory/request packs exclude retired sources; signed pursuit downloads retain historical files. Build/source reports and commercial workpapers retain their existing restricted permissions.

Knowledge files use signed-in, bounded byte-range downloads and private database storage. Corporate sources never appear in the public preview. A model receives attached source data, not infrastructure credentials. Approved-source withdrawal is checked under database row locks in a consistent order with source/gate operations, so concurrency cannot bypass the hold or form the tested originating-pursuit lock cycle.

Scanned PDFs still require verified OCR/transcript copies for word-level independent QC; source approval does not bypass that parser hold. Native source preparation now preserves architecture PNG/JPEG bytes as unverified visual evidence, without inventing text. Exact citations, source/currentness, consent, layout and all applicable BRD checks remain necessary.

## Verification and limits

`scripts/test_local_knowledge.ts` runs only against the owned loopback database. It checks private drafts, source consent, real role/version decisions, runner denial, one current approval, byte-exact sharing, pinned snapshots, missing/hash/withdrawn holds, retirement/replacement/history, incomplete-import denial and originating-pursuit concurrency. Compiled browser checks cover source/quote/history display, verified downloads, consent controls, a synthetic role-gated approval, mobile width and role privacy. No synthetic approval is accepted as a real Mindmap or client decision.

The current source selection UI uses existing pursuit uploads; direct user upload into the standalone library is not implemented. API pages return up to fifty versions with an explicit continuation. The native routine does not silently select all approved assets, infer company metrics or wake itself. Human sign-in, real pilot inputs and actual recurring cloud execution remain separate prerequisites.

Private pricing/internal pursuit sources cannot be proposed for this firm-wide library. Attaching an approved version cannot downgrade a matching private source’s classification. See [private source rules](PRIVATE_SOURCES.md).
