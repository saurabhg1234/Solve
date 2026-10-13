# Independent review contract

The portal now queues independent reviewer tasks and enforces byte-bound coverage. This is an implemented protocol, not evidence that actual fresh Codex reviewers or the complete pilot have passed acceptance.

## Creation and review

The native bridge uses the actual `CODEX_THREAD_ID` supplied by the cloud runtime. It allows one claim per native task. A creator result cannot include independent reviewer reports. At a review checkpoint, the server prepares an immutable packet from stored sources, selected draft files and reference/baseline files, then queues the checkpoint's BRD checker passes.

Generated outputs declare `purpose` as `draft`, `reference` or `workpaper`. The default is draft for client-visible output and workpaper for internal output. A reference must contain the register/baseline or approved comparison material, not drafter reasoning. Internal estimates can be marked draft for their own technical review while remaining internal. Workpapers and previous reports never enter the reviewer packet. `reviewArtifactIds` can select exact draft artifacts; otherwise the latest draft-producing stage is selected. W3/W4 technical/document QC requires a reference baseline tied to the requirement gate in the current source revision.

Each reviewer receives the sources, selected references/drafts, BRD checklist and server inventory. It receives no creator result, prior reasoning or earlier reports. Its file endpoints permit only its exact packet IDs/hashes. Creator contexts and every reviewer context already used on that pursuit are excluded from further reviewer claims, including expired attempts. Revisions cancel existing review leases. Reviewer completion requires its claimed task identity, active lease, packet hash, every expected ID exactly once and findings on valid IDs.

Task IDs are supplied through the trusted bridge and checked for uniqueness; they are not a cryptographic attestation of an empty model context. Real standalone cloud tasks must verify that fresh context and local workspaces are isolated. Reviewers must not read other private session directories. No schedule creation or real native-review acceptance is claimed by the local fixtures.

## Element inventory

The server derives the inventory itself from the stored bytes: paragraphs/words, table cells, captions and image/diagram elements in DOCX/PPTX; page text/words and complete-page visual checks in PDF; text/JSON/code lines and words; inert HTML text/table/image elements; complete images. It retains original files for actual visual review. Enumerating an element is not checking it.

PDF sources have text plus complete-page visual coverage; tagged structure also contributes cell/caption/image IDs. PDF drafts without structural IDs hold for a tagged PDF or verified editable review copy, rather than silently claiming cell/caption coverage. Pages without extractable text require a hash-bound, complete page transcript and a fresh SOURCE_TRANSCRIPT check before downstream QC; without that association they hold. See [source transcripts](SOURCE_TRANSCRIPTS.md). Encrypted/malformed documents, unsupported media, embedded programs/documents, oversized archives and absent review material hold explicitly. Current bounds are 30 files, 64 MB total, 40,000 elements and 150 PDF pages per packet, plus the existing 32 MB file limit. Larger inputs need bounded review sections; unsupported formats do not receive invented coverage. Full-frame video and executable-demo acceptance remain pending.

Inventory pages transfer in batches of 1,000 elements. The native workspace writes `inventory.json`, `sources.json`, `artifacts.json` and `result.schema.json`. Review results contain `packetHash`, `checkedElementIds`, `summary`, `findings` with element IDs/severity/kind/evidence, and `missingInputs`. They have no self-declared pass or release flag.

## Findings, loops and humans

Any finding or missing input holds for a fix/decision. Minor issues also need fixing before a human gate. D2/D3 contradictions before the first draft record an escalation. Findings are never voted away. A corrected draft receives new reviewer contexts; second-pass compliance findings request a third independent pass on the corrected packet. Human gate feedback now persists exact file evidence and supports ordinary correction routes through new checks and human approvals. Document-gate major/critical issues and QC escapes create durable escalation holds across revisions. See [gate feedback](GATE_FEEDBACK.md). Original producer tasks can now record immutable ESC-2 explanations; see [ESCALATION_EXPLANATIONS.md](ESCALATION_EXPLANATIONS.md). Their details remain internal and are excluded from ordinary independent-review packets. Automatic original-task resumption, fixes and the fresh-drafter/root-cause-check sequence remain pending.

Clean loops use exactly the same immutable packet. The server counts completed required passes, queues fresh passes for the next loop, enforces the explicitly configured maximum and advances only after the configured exit rule. The BRD's proposed exit/max values remain unconfirmed: no two/five defaults are silently applied. The owner/admin can explicitly set a pursuit's review policy while awaiting confirmation or blocked. Without confirmed settings, recorded review evidence holds before progression.

QC completion advances to the applicable human gate; it never writes a human approval, sends mail or submits a bid. Reports concerning internal files are restricted to authorised internal roles; other pursuit members see progress/counts and a generic hold. Source and artifact hashes, reviewer task/pass identities, loop counts, findings and events are retained for audit.

## Verified evidence and remaining work

21 domain/parser tests pass, including real supplied PPT/PDF inventory and scanned-PDF holds. Local authenticated fixtures pass for two clean loops across eight distinct synthetic reviewer identities, a native review-completion bridge invocation, self-review/file/coverage/hash/context/replay rejection, missing-policy holds, internal finding privacy, revision cancellation and role-gated human release. Compiled browser checks verify visible progress/findings, internal-role privacy and mobile layout. All synthetic records are removed.

Actual standalone Codex reviewers, semantic finding quality, disagreements/fix automation, full ESC protocol, complete large-document/demo/video paths and W1–W8 acceptance are still unverified or pending. A protocol fixture is not a client proposal or real reviewer judgment.

The inventory also counts XLSX shared/inline/numeric cells, words, formulas and drawing/chart elements without evaluating formulas or following external workbook links. Imported PPT master/layout text is inventoried alongside generated slides. Expanded Office bounds are 96 MB total and 32 MB per member, covering the supplied reference deck’s 17.4 MB vector-heavy slide XML. At W5-11 the scoped internal rfi_review cross-check workbook enters the packet as a reference; assigned consultants/bid owners can see those findings, while other internal/commercial packets stay restricted.
