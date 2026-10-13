# Private pricing and internal source inputs

Pursuit source files now have an explicit access classification. Ordinary request files are shared with the assigned pursuit team. Private inputs are restricted to the existing internal-review roles, including Ganesh's pricing role and Saurabh's administrator role, plus authorised native stage/reviewer leases. An internal role alone does not grant access to an unassigned pursuit. No new human role or business pricing value is introduced.

## Add inputs

The pursuit owner assigns Ganesh through **Pursuit team** and pauses/opens the appropriate revision before source changes. When the pursuit is awaiting routing confirmation or blocked, Ganesh can use **Add private inputs**. The files retain their exact bytes/hash, uploader and source revision. His pricing role does not grant general pursuit management or permission to change ordinary team inputs.

Saurabh can use either **Add files** for ordinary pursuit evidence or **Add private inputs** for restricted material. Source changes during running stages or approvals still require a paused revision. Real pricing policies should use the private option and the explicit format in `NATIVE_COSTS.md`; their existence does not approve effort, rates, final price or S1-G2.

Private source names, hashes, provenance and byte downloads are excluded from ordinary consultant/sales/demo views and downloaded request packs. The native queue retains the source classification with actual hashes. Private inputs can feed internal workpapers and COST review. Word/source extraction preserves the classification; email client-claim citations reject private sources. Source confidentiality remains a content obligation for Codex and independent commercial/QC checks; storage permissions cannot prove that generated prose contains no disclosure.

## Propagation and disclosures

A source's classification cannot be changed through a duplicate upload. Identical bytes with a different requested classification fail explicitly. Private sources cannot be proposed for the firm-wide reusable library, even by an administrator; an approved library attachment also cannot reclassify a matching private pursuit file. If a reusable/public statement is needed, provide a separately reviewed, suitably redacted source with its own bytes and provenance.

Reviewer packets retain source visibility. Findings from a packet containing private inputs remain restricted to internal reviewers. For a pursuit with private sources, ordinary users receive a generic blocked-stage explanation rather than a native summary that might quote internal details. Audit events still show that someone added a file; they do not expose its private filename or content in the pursuit activity view.

The W5 `rfi_review` exception must not become a way to publish pricing workpapers to consultants. The native RFI exporter holds when its source packet contains private inputs, and the server rejects that exception on a pursuit containing private sources. Keep pricing analysis in restricted workpapers and use a separate suitable source packet/pursuit for a buyer question sheet. Private input classification does not make the existing email intake infer which attachments are commercial; imported mail and its attachments remain ordinary pursuit sources. Use the dedicated private upload for rates, policies and internal commercial files.

## Validation

The additive migration adds `zora_sources.visibility` with existing sources retaining their ordinary team classification. No source bytes, source approvals or account roles are rewritten. Migration repeatability is checked before deployment.

`tests/files.test.ts` checks role/unknown-classification behavior. Email and Python fixtures verify private citation/RFI holds and preservation of extraction metadata. `scripts/test_local_private_sources.ts` tests actual pricing-role uploads, membership and byte ranges, metadata/request-pack exclusion, blocked-summary and review-finding privacy, duplicate/library conflicts, native lease access, the scoped RFI guard, and compiled browser upload/mobile privacy. All inputs and local consent records are synthetic and deleted. The cost integration uses a private policy source and verifies both its native use and human-role restrictions.

Real work-account sign-in, actual Ganesh policy input and the complete S1/all-eight pilot remain acceptance work. No production business settings or human approvals are created by these tests.
