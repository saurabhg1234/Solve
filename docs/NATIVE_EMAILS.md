# Native W8 email drafts

Zora writes email content in its leased Codex session. The native helper produces branded draft files and a separate internal evidence record. It contains no Microsoft send operation, model integration or automatic approval. Actual sending remains the consultant's W8-G1 action.

## Workflow

At W8-1 or W8-2, run:

```bash
npm run routine -- email-context <private-workspace>
```

The helper reads downloaded `sources.json`, verifies every source's SHA-256 and rebuilds paragraph/cell references from actual stored bytes. It writes `outputs/internal/email-context.json`. Use its exact source IDs, locations and passages to select the facts the email may use. This inventory is unverified extraction, not an approved fact set. At W8-1, Codex still performs the required context selection. Save this extraction as an internal workpaper: reviewers already receive the actual sources and must make their own factual assessment. Never pass drafter reasoning as a review reference.

At W8-2, create the plan inside that same private workspace, then run:

```bash
npm run routine -- build-email <private-workspace> email-plan.json
```

The bridge enforces the native context, workspace, W8 stage and active lease. It renews that lease while the local helper runs. The child receives only the supported local tool environment, with infrastructure credentials withheld. A reviewer cannot use this bridge to alter the draft.

## Explicit inputs

The plan has exactly these fields:

- `policySourceId`: an actual downloaded source containing JSON with explicit `maxWords` and `hypeWords`. The word limit counts the subject plus authored body, excluding fixed branding and recipient headers. An explicitly empty hype list is distinct from an absent list. Saurabh deferred these settings; there is no production default.
- `to` and `cc`: arrays of ordinary mailbox addresses, without display names or header syntax. Zora normalises/deduplicates them and visibly copies `saurabh@mindmapdigital.ai`, unless he is already a primary recipient.
- `subject`: one annotated text segment, at most 200 characters, with no line breaks.
- `paragraphs`: arrays of annotated single-line segments. Segments join with spaces; each inner array becomes a paragraph.

A `claim` segment has `text` and nonempty `citations`. Each citation supplies the real `sourceId`, exact `location` from the context inventory, and a verbatim `quote` at that location. The policy file and private internal sources cannot support a client claim. A `courtesy` segment has `text` and an internal `reason` explaining why it contains no factual assertion. Greetings, neutral headings and open questions can use this classification; classifying a sentence as courtesy does not make an embedded claim nonfactual. Independent reviewers must check all content.

For example, this is only the shape of a segment; the IDs/passages must come from actual downloaded sources:

```json
{
  "kind": "claim",
  "text": "The client-specific statement drafted from the source.",
  "citations": [{
    "sourceId": "<actual source UUID>",
    "location": "<exact inventory location>",
    "quote": "<verbatim passage>"
  }]
}
```

The helper applies Unicode-normalised whole-phrase hype checks, the explicit word bound, recipient/header checks and conservative checks for free demo/POC wording, commercials/internal-cost terminology and obvious guarantees/delivery commitments. Matches hold for rewriting; there is no self-approved exception switch. These patterns can overblock neutral wording and cannot detect every paraphrase or implication. D8, D4, D6 and the BRD email-pattern review remain mandatory.

All inputs are bounded: 30 distinct sources, 32 MB each/64 MB combined, 40,000 inventory elements, a 1 MB plan/manifest, 50 To and 50 supplied Cc addresses, and bounded paragraphs/segments/citations. Scanned PDFs require an explicit page-linked source transcript; unsupported media, malformed documents and missing extraction material still hold. The 64 MB source working-set bound includes selected transcripts. Transcript files are at most 2 MB, and the artifact manifest is bounded to 200 entries/1 MB. The helper does not fetch websites, execute source scripts or infer permission to disclose.

## Files and review

Three **client draft** files are produced:

- `outputs/client/email.html`: escaped content in the existing Outlook-compatible magenta stripe/orb layout.
- `outputs/client/email.txt`: explicit To/Cc/Subject and plain text for reading/copying.
- `outputs/client/email-envelope.json`: draft recipients, subject, companion filenames and review-required flags.

`outputs/internal/email-build.json` is an **internal workpaper** with the explicit policy/hash, claim mapping, exact quotations, classification reasons, counts and generated-file hashes. It is excluded from the independent reviewer packet. Client files contain no internal rationale or evidence quotes added by the formatter. Actual source passages still enter independent review through the source packet; the reviewer must derive its own judgment.

The helper never attaches an internal file or claims an attachment is approved. Attachment/send/unknown plan fields are rejected. No `.eml` auto-send/import action is produced. Use `routine complete` with the returned file paths, MIME types, visibility and purposes to persist the real bytes. Each file must match the stored hash. W8-3 queues the fresh D8/D4/D6/EMAIL_PATTERNS passes, preceded by SOURCE_TRANSCRIPT when a PDF transcript is present, and configured QC exit rules still gate W8-G1. Draft export records no QC pass, human approval, release, sending or recipient delivery.

## Validation and limits

Nine email unit fixtures cover source/quote/hash bindings, owner-copy and header guards, deferred/configured policy rules, prohibited wording, complete segment classification, escaped markup and path/symlink containment. The local W8 fixture exercises context and drafting stage leases, expired/context/stage/path rejection, actual byte storage, role privacy, all four independent reviewer packet contracts and the missing-QC-policy hold. Its reviewer reports are explicitly synthetic protocol evidence, not fresh Codex semantic acceptance. Compiled desktop/mobile browser checks verify the stored plain-text preview, visible Cc, internal-file exclusion, no interpreted HTML, responsive width and zero page errors. No fixture sends email or persists real business policy.

Client facts, appropriate tone, complete claim coverage and consultant-quality writing still need real Codex work and independent semantic review. Source citation matching does not prove the inference, the truth of a source claim or permission to disclose it. Human sign-in, actual fresh reviewers, recurrence and the all-eight pilot remain separate acceptance work.


## Scanned source path

For an image-only PDF, use [the source-transcript plan](SOURCE_TRANSCRIPTS.md) and `routine build-transcript` in W8-1 before `email-context`. The context response's `additionalSourceFiles` must be declared in the stage result alongside the internal context workpaper. The helper reads only explicit `source_transcript` artifacts or the same stage's canonical packaged transcript file; it never substitutes arbitrary OCR caches, workpapers or transcripts from blocked earlier jobs.

W8-2 receives completed transcript artifacts newest first. Original PDF bytes, transcript bytes, hashes, exact page count and source access classification are checked again. Context paragraphs/cells/captions use page-linked locations such as `PDF page 1, unverified transcript paragraph 1`. Citations retain the original source ID/hash and transcript artifact ID/hash in the private build report; `supportVerified` stays false. A transcript packaged within W8-2 is included automatically in the build's returned files for persistence. It does not become an email attachment.

W8-3 receives the same original PDF and transcript. Its fresh SOURCE_TRANSCRIPT reviewer must compare every page before D8/D4/D6/email-pattern tasks become claimable. Draft wording still needs those separate checks and human proofreading. A private transcript cannot be cited or copied into client email text. No transcription status, source claim or business policy is approved by the formatter.

Two additional transcript/email unit fixtures check stored/local association, current-stage output declarations, changed hashes, blocked/workpaper exclusion and private-source leakage holds. `ZORA_LOCAL_SCANNED_EMAIL=1` runs the existing local W8 fixture with a real synthetic image-only PDF through W8-1, W8-2 and W8-3. It verifies exact citation-to-QC transcript IDs/hashes, five synthetic fresh reviewers, the deferred-policy hold and zero sending/approvals. It also supports the existing compiled desktop/mobile preview checks. Synthetic reviewer reports do not establish actual semantic acceptance.
