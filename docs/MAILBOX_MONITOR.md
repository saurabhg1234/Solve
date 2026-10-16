# Zora mailbox monitor

The Microsoft Graph subscription delivers notifications for the dedicated Zora folder. The notification handler persists each signal and performs bounded catch-up after acknowledging Microsoft. Only explicitly tagged Zora messages enter intake; Jarvis-tagged messages are excluded. Mail is never marked read, moved, categorised or deleted.

`vercel.json` adds a production check every five minutes at `/api/microsoft/maintenance`. Vercel invokes GET with the existing `CRON_SECRET` bearer credential. The same authenticated handler supports the native bridge's POST check. Each run renews the subscription when needed, catches up the delta cursor, clears expired temporary uploads and records success/failure in `zora_events`. The existing sync lease prevents competing scans and the receipt key prevents duplicate intake. This uses the existing Pro plan and introduces no secret, model API or separate host.

The Connections screen reads the private `/api/mailbox/status` endpoint. Consultants, bid owners and administrators see the last inbox scan, scheduled heartbeat and pending intake count. The status says active only with an unexpired subscription and a successful, recent scheduled run. Requests refresh their mailbox list every fifteen seconds while open. Public previews and other roles receive no mailbox metadata.

A deployed cron definition is configuration evidence; an actual `vercel-cron` heartbeat after deployment is execution evidence. Verify both before claiming the schedule is live. Manual POST checks are recorded separately. Runtime logs and the private release receipt retain the production checks.

This monitor collects incoming mail even when a Codex chat has ended. It does **not** launch a Codex session or generate/approve/send proposals. Native cloud recurrence still requires a supported Codex scheduling capability. Do not describe mailbox cron as a recurring Codex worker.

Email source intake accepts up to 24 file/inline attachments, 32 MB per file and 64 MB combined. This accommodates Advait's 13-file pilot pack. Linked/nested attachments remain held for actual file copies. Archives are retained as original source bytes; importing does not execute their code or approve client content for reuse.

Validation: `npm test`, `npm run build`, and `scripts/test_local_mail_monitor.ts` against the isolated local database/server with `ZORA_LOCAL_MONITOR=1`. The monitor fixture checks GET/POST authentication, durable separate manual/scheduled records, idempotence, Jarvis exclusion and status role/privacy boundaries. Use the local Graph fixture only in development; never preload it in production.

## Registered Zora conversations — 16 October 2026

Advait’s 13:23 UTC reply reached the Zora folder but was recorded as ignored because its subject was `Re: Zora update: ...`, without the literal `[ZORA]` tag. The five-minute folder scan was running correctly but excluded this correspondence. Direct inspection found the missed reply.

Maintenance now also polls **explicitly registered Zora conversation IDs** in `zora_mail_threads`. Operators register a verified thread against an existing pursuit, retaining the authorizing actor/message in an audit event. There is no broad subject/body inference or public registration endpoint. Register only correspondence the user authorized Zora to handle; a shared mailbox or an address alone does not establish ownership. New unregistered requests still require normal tagged routing.

Each maintenance run scans one page (50 messages) of the oldest eligible registered thread. An expiring lease prevents competing scans; a stored continuation link and scan window preserve pagination across cron runs. Successful scans overlap by one minute and use immutable-message receipts to avoid duplicates. A failed page leaves its cursor unchanged. The scan is deferred if earlier maintenance consumed 30 seconds. Threads can be disabled without deleting mail or history.

Only exact conversation matches are accepted. Sent mail from Zora’s own address, drafts, removed items, `[JARVIS]` subjects and Jarvis categories are excluded. An already ignored receipt can be promoted only through this explicit registration. A captured reply is linked correspondence in `zora_inbox`; it does not automatically create a pursuit, change sources/versions, approve a gate, claim a review or send mail. Attachment notices require deliberate source review. Linked correspondence list/detail access follows pursuit membership; general unlinked intake remains available to the existing triage roles.

`mailbox.maintenance.data.threads` records checked/imported counts; `mailbox.reply_received` records each new linked reply. The native `routine -- check` also displays thread counts. This is durable email collection, **not a fresh agent-session scheduler or automatic reply generator**. The overdue provider dispatcher remains a separate dependency.

Verification: 58 TypeScript tests and production build passed. `scripts/test_mail_threads.ts` uses only local PostgreSQL, mocked Graph responses and local signed API sessions. It covers missing-tag recovery, exact conversation scope, exclusion of Jarvis/own/draft/unrelated messages, duplicate and pagination behavior, concurrent leases, failed-page retry, unsafe continuation rejection, disabled threads, linked-message access restrictions, and unchanged pursuit/source/job/approval records. A read-only real Graph query for the known Advait thread also succeeded before deployment. No new secret is required; the repeatable migration adds the registry table.

Live verification on 16 October: registered Advait’s exact existing Zora thread at 14:07 UTC, recovered his 13:23:48 UTC feedback once, then observed the **automatic** 14:10:07 UTC Vercel run import his new leave acknowledgement. The original feedback remained a single inbox copy, the continuation cursor was clear, and the pursuit/source versions and queued reviewers were unchanged. The acknowledgement was retained as correspondence and did not trigger a reply. Private proof is `zora-registered-thread-cron-receipt.json` under `/workspace/solve-environment`.
