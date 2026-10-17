# Pentagon invoice reconciliation demonstration

Requested by Saurabh on 17 October 2026 as additional deliverables on the existing Pentagon pursuit: an Agent 5 demo and a two-minute narrated, animated walkthrough. Scope follows the delivered proposal v3.0 and presentation v3.1. The demonstration is directly built in the active Codex session; it does not claim that automatic multi-workflow scheduling or W6/W7 formal acceptance is complete.

## App

`/demos/pentagon` requires an approved work-account session and membership of Pentagon pursuit `b7719635-8f9d-4d4c-9a36-f8588b013c99` (or its existing administrator access). The pursuit's Completed work section links to it. No new role, credential or model API integration is required.

The blue/white interface carries both official logos. Seven synthetic invoice scenarios cover an exact match, price variance, partial receipt, duplicate copy, missing purchase order, tax mismatch and unit mismatch. Every record exposes its sample invoice/order/receipt evidence and the team responsible for an exception.

The demonstration uses an **illustrative 0.50% price tolerance**, exact units/tax, and quantity checks against remaining order/received balances. These are not approved Pentagon accounting rules. All money is integer paise; invoice amounts are computed from the fixtures. Identical invoice identities are normalized within supplier, company and financial year. A repeated receipt is ignored. A later valid receipt resumes the same invoice. Matching, approval and simulated voucher actions produce an exportable session audit.

Demo approval is explicitly a simulated finance role, bound to the current evidence. A changed payload invalidates that approval. The timeout scenario retains an uncertain result and requires read-back of the existing simulated voucher; retrying does not create another voucher. This is browser logic for demonstration, not a production authorization/security mechanism.

**Boundaries:** no live Tally, OCR, email document extraction, persistent client transactions or external model API. State is held in memory and resets on page refresh or the confirmed Reset action. The supplied vendors, orders and invoices are synthetic. There are no production financial writes. Public logo assets are exact copies of the previously verified official-site assets; private proposal files and generated media remain outside Git.

## Implementation and checks

- `lib/demos/reconciliation.ts`: pure matching, receipt, approval, voucher recovery and audit logic.
- `components/demos/pentagon-demo.*`: responsive interactive interface and accessible source/policy dialogs.
- `app/demos/pentagon/page.tsx`: existing session and pursuit-access enforcement.
- `tests/reconciliation-demo.test.ts`: boundary tolerances, duplicate identity, late-receipt replay, no posting before approval, evidence invalidation, partial order consumption and timeout recovery.

Development checks use the existing **local-only** test database/config and a synthetic case fixture. Do not insert test transactions or test approvals into production. Runtime receipts, captures and media are private under `/workspace/solve-environment/pentagon-demo-2026-10-17`. The handoff records the final deployment, video checks and send receipt once delivery is verified.

## Walkthrough

The film shows the working app, with opening/closing motion graphics, animated chapter callouts, pointer interactions, narration and captions. It covers the queue, exact match, price exception, late receipt, duplicate block, approval, uncertain posting/recovery and the audit trail. Tally remains visibly simulated. Do not replace app behavior with fabricated screen states or imply that a film proves live integration.

Narration is rendered locally with Apache-2.0 Kokoro-82M weights and a supplied generic British English voice, without an external generation API or imitation of a person. Private model provenance retains upstream hashes and licence material. FFmpeg handles timing, captions, normalization and encoding; Chromium/Playwright records actual interactions. Reusable media guidance is in `scripts/media/README.md`.
