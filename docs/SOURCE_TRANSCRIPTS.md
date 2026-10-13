# Scanned PDF source transcripts

An image-only PDF can now enter independent word-level QC with a page-linked transcript. The original PDF stays in the packet. A separate fresh `SOURCE_TRANSCRIPT` reviewer must compare the transcript with every original page before any ordinary checker can claim a task in that loop. Hash/page checks prove association and coverage, not transcription accuracy or approval of the source claims.

This path applies to **PDF sources**. It cannot replace the locked requirement baseline, supply structure for an untagged PDF draft or bypass a human gate. Recording-only requests, unsupported media, draft PDF structure, and the native W8 email helper's direct text-source requirement retain their existing holds.

## Native preparation

In the claimed stage's private workspace, use `routine prepare` to extract text and bounded OCR. Read the original PDF pages and correct the candidate transcription. OCR caches remain unverified. Write an explicit JSON plan:

```json
{
  "version": 1,
  "status": "unverified",
  "sourceId": "00000000-0000-4000-8000-000000000001",
  "sourceSha256": "<exact SHA-256 from sources.json>",
  "pages": [
    {
      "page": 1,
      "blocks": [
        {"kind": "paragraph", "text": "Exact words visible on this original page."},
        {"kind": "table_cell", "text": "Exact cell text"},
        {"kind": "caption", "text": "Exact caption"}
      ]
    },
    {
      "page": 2,
      "blocks": [],
      "noTextReason": "This page is blank; the original page still requires visual checking."
    }
  ]
}
```

The illustrative ID, hash and text must be replaced with actual source evidence. Include **every original page, once, in order**; preserve reading order, numbers, symbols, table cells and captions. Do not describe unreadable or unsupported text as a blank page. Report it as missing input. Do not add summarisation, reasoning, invented content or a `verified` flag.

```bash
npm run routine -- build-transcript <private-workspace> transcript-plan.json
```

The bounded helper verifies the claimed context/lease, source ID/hash/bytes, original page count, input/output paths and element limits. It writes `outputs/<source-visibility>/source-transcript-<source-id>.json`, with purpose `source_transcript`. Add the returned file metadata to `result.json`. The file is created exclusively; it will not silently overwrite a previously packaged transcript. Before upload, explicitly remove only your own incorrect local output and rerun with the corrected plan, or use a fresh stage/revision. Stored artifacts remain immutable.

The original source classification is mandatory: private pricing inputs produce private transcripts. The server rechecks active pursuit source ownership, hash and classification at upload completion. Invalid association or attempted public reclassification is rejected. Source-revision changes require a current transcript; retired sources and their transcripts are excluded from new packets. Keep explanatory extraction/build reports as private `workpaper` artifacts.

## Independent verification

At a QC checkpoint, the server selects the latest completed transcript for each active source in the current revision (or the current stage's output), checks stored hashes and builds an immutable association between PDF ID/hash, transcript ID/hash and page count. Transcripts from a blocked earlier stage must be repackaged in the resumed stage; they are not silently promoted. Native PDF text, original-page visual checks and transcript paragraphs/cells/captions/words all remain in the inventory. Each transcript JSON is also retained as a reference for exact comparison; it does not satisfy baseline requirements by itself.

Each loop starts with a fresh `SOURCE_TRANSCRIPT` task. Other checkers cannot be leased while that task is queued or leased, including concurrent claims. It uses the normal isolated packet, hash, complete unique coverage, context and lease rules. The reviewer must visually check every page, omissions/additions, reading order, tables, captions, exact numbers/symbols and any no-text explanation. Any finding, including minor errors, or missing input holds the run. A clean report permits ordinary QC tasks; it does not mutate the transcript's `unverified` status or approve company claims. The durable review report is the evidence of that check for that exact packet and loop. Subsequent loops repeat the transcription check in another fresh context.

The portal labels these files as source transcripts and shows the transcription pass before ordinary QC. Internal transcripts and associated findings retain existing pursuit/role restrictions. Existing explicit clean-loop and maximum-loop settings still apply. No policy default, human approval, client release or email send is created.

Bounds: 2 MB per transcript, 150 original pages, 2,000 blocks per page, 12,000 characters per block; the entire packet still must fit 30 files, 64 MB and 40,000 elements. Native builder inputs remain at most 32 MB per PDF. A transcript does not make an oversized packet acceptable.

## Evidence and limits

`tests/source-transcript.test.ts` checks association, classification, page contract, original visuals, countable words, no-text pages, draft/reference rejection, original-byte validation and contained/exclusive output. `scripts/test_local_transcripts.ts` uses the owned local database and synthetic image-only PDFs to exercise the actual native helper, uploads, review queue, concurrent-claim barrier, ten fresh synthetic contexts over two loops, missing/partial holds, private access, minor-error rejection, expiry, revision cancellation and zero human approvals. Its optional compiled browser check covers desktop/mobile labels, ordered progress and page errors. Existing independent-review and private-source fixtures remain regression checks.

Synthetic reports validate the protocol. Actual fresh Codex transcription judgments and real W1–W8 acceptance remain unrun. No supplied company asset or claim is approved by these tests.
