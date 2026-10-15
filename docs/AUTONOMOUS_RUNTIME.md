# Completing Zora's unattended runtime

**Transfer update:** after this recommendation, Saurabh asked Claude to take over development because the proposed setup was too burdensome. Read [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md). No route below was activated, and the receiving team should establish the actual supported runtime before promising autonomy.

Design and official-documentation check: **15 October 2026**. This is a deployment plan, not an activated worker. The five-minute Vercel mailbox monitor is already live; no unattended Codex dispatcher is deployed.

## Why incoming mail does not yet produce a proposal

Vercel receives Microsoft notifications and stores Zora mail. Its cron renews monitoring and catches missed mail. Neither operation starts a Codex execution. A live Codex cloud task can process work, but this chat has no task-scheduling/creation tool, and its shell processes are not an independently operated production worker.

There is also an intake gap: a received email is an inbox record, not automatically an executable workflow job. The current native bridge claims queued stages/reviews; it does not perform incoming-email classification or create a pursuit. The current human workflow-confirmation and pricing/release gates remain intentional. Scheduling `routine claim` alone does not turn a raw email into a proposal.

## Recommended architecture for the Codex-only custom build

Microsoft 365 → existing Vercel webhook/cron → durable Zora inbox → intake triage → queued workflow stage → supervised Codex worker → isolated review session → Zora artifacts and human gates.

Use a persistent Linux VM or a managed background-worker service with persistent private storage. Start with approximately 4 vCPU and 8–16 GB RAM for document conversion and browser checks; this is an initial sizing estimate, not a measured requirement or vendor quote. Keep Vercel for the portal, webhooks and monitor, and Neon for durable state/files.

The supervisor stays available, but Codex sessions run only when there is useful work. It restarts on machine/process failure, records heartbeats, retries transient errors with backoff, and surfaces auth/usage-limit failures. Every claim has an expiring lease and duplicate protection. Each independent reviewer starts with its own isolated source/draft packet and actual new Codex context.

The official `codex exec` interface is documented for scripts, scheduled jobs and pipelines. It supports structured output and JSON events including `thread.started`. It can use ChatGPT-managed authentication; a Platform model API key is not required for that path. The app-server/WebSocket option is currently documented as experimental/unsupported for production workloads, so do not use it as the default production foundation.

## Setup sequence

1. Provision the persistent worker in Mindmap's chosen cloud account with a private disk and service restart policy. The current task has GitHub/Vercel/Microsoft bindings, not verified access to such a worker host. Keep original source assets and deployment credentials separate from task input packets.
2. Install the official Codex CLI and the tested Solve toolchain: Node/npm, Python document environment, LibreOffice, required fonts and document/image tools. Check out the existing project branch without resetting user work. Apply the repository's actual installation/startup instructions.
3. Authenticate the worker using an account/workspace entitled to Codex. **ChatGPT Business/Enterprise:** an administrator can enable local Codex and token creation, then create an access token scoped to **Codex** for the designated workflow owner/service identity. **Personal Plus/Pro:** use the supported interactive/device login on the worker; validate refresh, persistence and unattended runs. Subscription usage limits still apply.
4. Bind the existing Zora transport settings securely on the worker. Do not regenerate them or paste them into task prompts. The Codex credential belongs on the worker, not in the Vercel frontend.
5. Upgrade the dispatcher to match the current queue protocol before enabling it. `worker/run.ts` is a legacy prototype: it does not implement the current native context/reviewer contract and must not be launched unchanged as the production worker. Bind claims to real Codex thread identities, retain producer contexts for explanations, and start separate fresh reviewer/drafter contexts as required.
6. Add unattended intake triage. Create a proposed pursuit/workflow from explicit Zora requests, identify missing inputs, link follow-up emails by thread, deduplicate retries and preserve Jarvis isolation. Continue automatically where the configured workflow allows it; pause at existing human confirmation, pricing and release gates. Do not silently remove those gates to demonstrate autonomy.
7. Register the tested supervisor with the host's service manager. It should handle restarts, timeouts, heartbeats, retry limits and a visible paused/error state. This is outside an active Codex task, not a nested CLI launched from this onboarding chat.
8. Prove the full chain with a tagged test email while no chat is open: automatic intake, appropriate routing, real Codex session, saved draft hashes, separate reviewer session and a correctly recorded human gate. Restart the worker mid-task and verify lease recovery without duplicate artifacts or email. Record the actual run IDs, timestamps and outcomes.

## Authentication and bindings

| Binding | Where | Source |
|---|---|---|
| `ZORA_APP_URL` | Worker | Existing production origin |
| `ZORA_RUNNER_TOKEN` | Trusted queue transport | Existing value, securely reused |
| `ZORA_NOTIFICATION_BYPASS` | Trusted transport | Existing valid production automation bypass; do not copy the malformed saved cloud display binding |
| `ZORA_WORK_ROOT`, `ZORA_REPO_ROOT`, `ZORA_WORKER_ID` | Worker | Private paths and descriptive host identity |
| Codex account sign-in or Codex-scoped access token | Worker authentication | Account/workspace owner; distinct from the Zora runner token and from a Platform API key |

The hosted mailbox cron already owns subscription maintenance. Do not duplicate Microsoft/Vercel administration credentials into every drafting process. Reuse authenticated portal transport and scoped file access. Never invent CODEX_THREAD_ID values to satisfy the current bridge's native-session check.

## OpenAI-hosted alternatives

Official Scheduled tasks documentation supports standalone runs; desktop project tasks need the computer awake and app running. Web tasks use uploaded files/connected tools and do not preserve a local folder. The documentation does not establish that this particular Solve cloud environment is available to a scheduled task. Test actual shell/document-tool/environment access before selecting this path; do not present an unverified UI choice as an already-supported integration.

Team Tasks are documented to run in the cloud using a team service account and configured connections. Availability/permissions and access to Zora's repository, document tools and isolated review packets must be verified for the actual workspace.

OpenAI also documents a **Workspace Agents API** that triggers a published ChatGPT workspace agent (`POST https://api.chatgpt.com/v1/workspace_agents/{id}/trigger`) with a **Workspace Agents**-scoped token. This is not a generic endpoint for resuming this Codex chat or evidence that it provides the Solve execution environment. Its agent text response cannot currently be retrieved through that API; a Zora integration would need approved tools to write artifacts/status to the portal. Consider it only after confirming workspace availability and compatibility with the user's Codex-session requirement. It is not interchangeable with a Codex-scoped token or a Platform model API key.

## Remaining product work

An unattended runtime does not complete the eight BRD workflows. ESC-4, source-change reconciliation, actual fresh semantic review, demo/video execution and end-to-end acceptance still need implementation/testing. A separate engineering queue can request bounded build/test tasks when approved client work is idle; changes should retain their code/test/deployment evidence. Do not describe a running dispatcher as completed proposal capability.

## Official references checked

- [Non-interactive Codex](https://developers.openai.com/codex/noninteractive)
- [Codex authentication](https://developers.openai.com/codex/auth)
- [Codex access tokens and supported workspace plans](https://developers.openai.com/codex/enterprise/access-tokens)
- [Scheduled tasks](https://developers.openai.com/codex/app/automations)
- [Team Tasks](https://developers.openai.com/codex/enterprise/teams)
- [Workspace agent triggers](https://developers.openai.com/workspace-agents/trigger-runs)
- [Workspace Agent token scope](https://developers.openai.com/workspace-agents/authentication)
- [App-server transport maturity](https://developers.openai.com/codex/app-server)
