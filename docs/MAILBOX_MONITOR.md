# Zora mailbox monitor

The Microsoft Graph subscription delivers notifications for the dedicated Zora folder. The notification handler persists each signal and performs bounded catch-up after acknowledging Microsoft. Only explicitly tagged Zora messages enter intake; Jarvis-tagged messages are excluded. Mail is never marked read, moved, categorised or deleted.

`vercel.json` adds a production check every five minutes at `/api/microsoft/maintenance`. Vercel invokes GET with the existing `CRON_SECRET` bearer credential. The same authenticated handler supports the native bridge's POST check. Each run renews the subscription when needed, catches up the delta cursor, clears expired temporary uploads and records success/failure in `zora_events`. The existing sync lease prevents competing scans and the receipt key prevents duplicate intake. This uses the existing Pro plan and introduces no secret, model API or separate host.

The Connections screen reads the private `/api/mailbox/status` endpoint. Consultants, bid owners and administrators see the last inbox scan, scheduled heartbeat and pending intake count. The status says active only with an unexpired subscription and a successful, recent scheduled run. Requests refresh their mailbox list every fifteen seconds while open. Public previews and other roles receive no mailbox metadata.

A deployed cron definition is configuration evidence; an actual `vercel-cron` heartbeat after deployment is execution evidence. Verify both before claiming the schedule is live. Manual POST checks are recorded separately. Runtime logs and the private release receipt retain the production checks.

This monitor collects incoming mail even when a Codex chat has ended. It does **not** launch a Codex session or generate/approve/send proposals. Native cloud recurrence still requires a supported Codex scheduling capability. Do not describe mailbox cron as a recurring Codex worker.

Email source intake accepts up to 24 file/inline attachments, 32 MB per file and 64 MB combined. This accommodates Advait's 13-file pilot pack. Linked/nested attachments remain held for actual file copies. Archives are retained as original source bytes; importing does not execute their code or approve client content for reuse.

Validation: `npm test`, `npm run build`, and `scripts/test_local_mail_monitor.ts` against the isolated local database/server with `ZORA_LOCAL_MONITOR=1`. The monitor fixture checks GET/POST authentication, durable separate manual/scheduled records, idempotence, Jarvis exclusion and status role/privacy boundaries. Use the local Graph fixture only in development; never preload it in production.
