# Real-time automatic intake

Microsoft's change notification for the Zora folder already triggers an immediate mailbox sync (with the five-minute cron as backup). After each sync, `autoIntake()` (`lib/triage.ts`) now processes new tagged messages without a person opening the portal.

| Message | Outcome |
|---|---|
| From an approved consultant, bid owner or admin, with one clear workflow (`W1`–`W8` in the subject, or unambiguous wording such as RFP, transcript, clarification questions, draft an email) | Pursuit created with the original email and attachments as sources, requested by the sender. W1/W3–W7 wait at **Confirm workflow** (routing confirmation is never fabricated); W2/W8 queue, as RT7 specifies |
| Reply in a thread that already has a pursuit (same Microsoft `conversationId`) | Marked **related** to that pursuit; no duplicate pursuit. A consultant decides whether it changes the sources |
| Unknown sender, non-creating role (for example the pricing owner), no clear workflow or several workflows | **Needs triage**, with the reason and any suggested workflow; create it manually as before |
| Sent by the Zora mailbox itself | Ignored |
| Received before this release | Marked **pre-existing** once by the migration; never back-processed |

Each message is claimed atomically (`FOR UPDATE SKIP LOCKED`), so notification and cron runs cannot create duplicates; each run handles at most five. Failures (for example a Graph attachment error) leave the message in **Needs triage** with the reason. Nothing is sent, marked read, moved or categorised; Jarvis mail is still excluded upstream. The client name is set to “Client to confirm”.

This is intake only. Stage work still needs an agent runtime to claim queued jobs; see the handoff.

Migration: `zora_inbox.conversation_id`, `zora_inbox.triage` (with a one-time pre-existing mark) and two indexes. Checks: `tests/triage.test.ts`; `scripts/test_local_auto_intake.ts` (run with `NODE_ENV=development MS_ZORA_MAILBOX=local-fixture` and `--import ./scripts/local_graph_fixture.mjs`).
