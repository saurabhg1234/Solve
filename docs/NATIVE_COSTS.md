# Native internal cost worksheets

The S1-6 formatter calculates and renders internal effort/cost drafts inside the current leased Codex task. It uses exact decimal arithmetic, keeps every output under `outputs/internal` and records no pricing approval or client quotation. Saurabh deferred business settings: missing values hold, and neither a test fixture nor a tool's existence configures production.

```bash
npm run routine -- build-costs <private-workspace> cost-plan.json
```

The bridge restricts this command to S1-6, checks the actual task identity/workspace and maintains the lease. Independent reviewers cannot edit the estimate with it. The document child receives only the supported local tool environment; infrastructure credentials are withheld.

## Required inputs

The plan selects a `policySourceId` from actual downloaded **sources** and an `effortArtifactId` from actual prior **artifacts**. Both must contain JSON, stay within the private workspace and match their stored SHA-256. The policy is not inferred from BRD example values or generated as a hidden tool default.

The policy source explicitly defines:

- `currency`: the supplied three-letter currency code.
- `minorUnits` (zero to four) and `rounding` (`HALF_UP`, `HALF_EVEN` or `DOWN`).
- `blendedRate`: a positive finite decimal string or exact integer.
- `overheadRange`: explicit `min`/`max` ratios.
- `aiReductionRanges`: configured `min`/`max` ratios by actual AI task type.

Each effort `packages` row has a unique row/package allocation ID, description, estimated role, nonempty baseline `requirements`, explicit `hours`, `aiTaskType`, `aiReduction`, task-specific `aiBasis` and scope `assumptions`. For multiple roles in one package, use distinct allocation IDs and retain the same requirement mapping. A description or boolean claiming that hours are reviewed is not actual review evidence: S1-3/S1-4 and Zora's independent effort review still apply.

The plan supplies `overhead`, a sourced `overheadReason` and optionally a simple `outputName`. It accepts no client price or margin parameter. Decimal fractions are strings; binary float inputs, missing policy fields, invalid ranges, unknown AI types, zero/negative hours, duplicate IDs, absent requirement maps and changed file hashes hold explicitly. The range checks validate the supplied policy; policy validity and human confirmation remain review obligations.

## Calculation and output

The formatter sums hours and computes the **hours-weighted** AI reduction. It calculates human cost first, subtracts package AI savings, then applies overhead to the reduced cost. Exact package totals reconcile with the aggregate. Money rounds once at the aggregate using the explicit currency policy; any difference from separately rounded package displays is recorded as a display rounding adjustment.

Two draft files are produced: an internal XLSX workbook and an authoritative JSON build-up. They retain source hashes, package/requirement mapping, inputs, rationale, exact/rounded amounts and the required-review flags. Spreadsheet content is literal text, including formula-like source strings. This preserves the decimal ledger and does not evaluate untrusted formulas. Cell overflow holds instead of truncating evidence.

Declare both files as **internal** and purpose **draft** at S1-6 so the COST checker reviews their actual bytes. Saving them is not an approval. Consultants/bid owners do not receive private hours, rates or cost files; authorised pricing/internal reviewers retain their existing access. Ganesh's S1-G2 decision still approves/sets price, AI reduction, overhead, infrastructure presentation and applicable revenue share. The helper does not infer infrastructure costs, revenue-share models, client prices, margins or Gantt dates.

## Evidence and remaining work

Four Python fixtures verify weighted reduction/calculation order, aggregate/currency rounding, explicit-input/range/float holds, mapping/duplicate/hash checks and internal literal output. `scripts/test_local_costs.ts` verifies actual S1-6 leasing, context/stage rejection, two byte-exact persisted drafts, real workbook/JSON QC inventory, pricing-role access and consultant denial. These use synthetic local inputs only; no actual business settings or prices are applied.

A full S1 acceptance run still needs approved scope/effort, confirmed pricing rules, fresh effort/COST reviewers, actual architecture/volume evidence, Ganesh's decision and the client table/deep QC. Client-specific estimation, infrastructure/revenue-share modelling and consultant-quality acceptance are not established by arithmetic tests.
