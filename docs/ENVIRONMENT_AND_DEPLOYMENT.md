# Environment variables, Codex runner and Vercel deployment

Zora’s content engine uses Codex sessions. Do **not** add `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, model endpoints or an AI SDK. Microsoft Graph and hosting/queue transport remain infrastructure connections.

## Current verified deployment

`https://zora-mindmap.vercel.app` is deployed in Saurabh's existing Vercel team, with deployment protection retained. Microsoft credentials, the Zora folder ID, application origin, initial team access, session/runner/webhook/maintenance secrets and the service callback's Vercel automation bypass are securely configured in that project. The deployment's Microsoft connector, unsigned-access denial and webhook validation checks pass.

Production storage and the always-on Codex/maintenance runner are not configured. The application still opens as a protected foundation preview; this is not a completed automatic pilot. A separate local PostgreSQL 16 database has passed migration repeatability, email-to-pursuit/source integrity, duplicate prevention, leased jobs, replay denial and QC-hold tests using synthetic local fixtures.

## Variables and where they belong

| Variable | Required for | Secret? | Notes |
|---|---|---|---|
| `ZORA_APP_URL` | Portal, callbacks, worker | No | Actual stable HTTPS deployment origin in production |
| `DATABASE_URL` | Persistent case/queue/mail state | Yes | Managed PostgreSQL connection with provider TLS; provider/region pending |
| `ZORA_SESSION_SECRET` | Work-account sessions | Yes | At least 32 random characters |
| `ZORA_ALLOWED_EMAILS` | Sign-in | No | Approved work emails separated by commas; empty denies access |
| `ZORA_ROLE_MAP` | Human gates | No | JSON email-to-role mapping; pricing access is explicit |
| `ZORA_RUNNER_TOKEN` | Portal ↔ runner | Yes | At least 32 random characters, separate from session/webhook secrets |
| `ZORA_NOTIFICATION_BYPASS` | Microsoft callback on protected Vercel hosting | Yes | Already configured; use the Vercel automation token, not an AI/session credential |
| `CRON_SECRET` | Mail renewal and catch-up | Yes | At least 32 random characters, stored in portal and maintenance runner |
| `Tenant` or `MS_TENANT_ID` | Microsoft | No | Existing binding is present |
| `Client` or `MS_CLIENT_ID` | Microsoft | No | Existing binding is present |
| `Client_secret` or `MS_CLIENT_SECRET` | Microsoft | Yes | Existing binding is present; use secure entry |
| `Object` or `MS_SERVICE_PRINCIPAL_OBJECT_ID` | Provisioning | No | Confirm service principal, not app registration Object ID |
| `EMAIL` or `MS_ZORA_MAILBOX` | Mail intake | No | Existing `EMAIL` matches `apex.ap@mindmapdigital.ai` |
| `MS_ZORA_FOLDER_ID` | Mail intake | No | Actual Zora folder ID |
| `ZORA_SUBJECT_TAG` | Shared mailbox routing | No | Proposed `[ZORA]` marker |
| `VERCEL_TOKEN` | Deployment tooling only | Yes | Present in this cloud environment; do not put it in the web app |
| `VERCEL_ORG_ID` | Targeted deployment | No | Obtain from the intended Vercel account/team |
| `VERCEL_PROJECT_ID` | Targeted deployment | No | Obtain from the intended project |
| `ZORA_WORKER_ID` | Runner | No | Stable descriptive runner identity |
| `ZORA_WORK_ROOT` | Runner | No | Private session/output directory, never a public web directory |
| `ZORA_REPO_ROOT` | Runner | No | Existing Solve checkout with BRD and templates |

Do not prefix server variables with `NEXT_PUBLIC_`. Enter secret values securely in hosting settings. Do not commit `.env.local`, paste credentials in chat, print the environment or publish session authentication files. Existing bindings should be reused after their operations are verified.

Supported role names are `consultant`, `bid_owner`, `architect`, `delivery_lead`, `pricing_owner`, `domain_owner`, `demo_builder`, and `admin`. For example, the shape of the role map is:

```json
{
  "<consultant work email>": ["consultant"],
  "<architect work email>": ["architect"],
  "<pricing owner work email>": ["pricing_owner"]
}
```

Those are shape examples, not actual configured accounts. An admin can access pursuits but cannot approve a role-specific gate merely by being an admin. The current foundation permits owner/admin pursuit access; assigning a full cross-role pursuit team is part of the next implementation milestone.

## 1. Review the cloud network draft

The environment draft now includes these required destinations, preserving the package-manager preset:

```text
www.mindmapdigital.ai
mindmapdigital.ai
learn.microsoft.com
vercel.com
api.vercel.com
login.microsoftonline.com
graph.microsoft.com
zora-mindmap.vercel.app
```

Native Microsoft token checks, Vercel account access and official website/docs retrieval now succeed. The initial proxy `403` failures were network-policy failures, not evidence of invalid credentials. The new deployment hostname was added to the draft and deployed HTTP checks now pass through the project's supported automation bypass. Review/save the remaining draft changes and publish the prepared cloud environment as appropriate; draft saving alone is not publication.

The database destination cannot be listed until the actual provider/host is selected. Codex authentication/networking belongs on the managed runner through its supported signed-in route; never tunnel around network policy.

## 2. Prepare durable storage and access

Choose a PostgreSQL provider and region approved for Mindmap’s presales client data. Supply `DATABASE_URL` securely. Run `npm run db:migrate` against that chosen database after reviewing `db/001_init.sql`. The migration is additive and repeatable. Live database validation has not been performed yet.

Supply the allowlist, role map, secrets, callback origin and Microsoft folder variables. The current portal is a safe preview until its database and identity are configured; it contains no live client records when unauthenticated. Data isolation, artifact/source storage and team access must pass the acceptance plan before production use.

## 3. Build and deploy the portal

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The intended **zora-mindmap** Vercel project is created and linked locally through ignored `.vercel/project.json`. It uses the Next.js preset and repository root. Its stable protected hostname is available; continuous Microsoft monitoring still needs production storage and maintenance before registration.

Deployment has been confirmed by Vercel's READY result and deployed HTTP checks. Reuse the existing token and project link for subsequent deployments. Root-only `.vercelignore` exclusions preserve the hosted `app/api/worker` routes while excluding the local worker, test scripts and original document assets.

After deployment, register the exact Microsoft redirect URI and configure `ZORA_APP_URL` to that stable origin. Verify the deployed HTTP response, sign-in, authenticated database operations and webhook verification. A successful build alone is not a deployment test.

## 4. Provide the Codex runner

For automatic processing, use a dedicated always-on Mindmap-controlled machine with Node, Codex CLI, Python document tooling and appropriate browser/media tools. The account and its data region/usage policies must suit the team. Vercel hosts the portal; it does not host the permanent Codex session process.

1. Install the official Codex CLI on the runner using its supported distribution.
2. Sign in interactively with the designated Codex account on that machine. Do not extract or upload its OAuth/session files to Vercel.
3. Use the existing Solve checkout. A cloud task is already isolated; do not create another Git worktree unless requested.
4. Configure `ZORA_APP_URL`, `ZORA_RUNNER_TOKEN`, `CRON_SECRET`, runner identity and private work/repository directories on the runner.
5. Prepare PDF/DOCX/PPTX/Pillow/PyMuPDF and English Tesseract tools. W6 needs browser/test tooling; W7 needs an agreed local voice/recording/editing toolchain. Raw audio transcription tools must also be selected before expecting recording-only requests to work.
6. Complete artifact import, independent QC orchestration and revision/resume implementation before allowing automatic delivery progression.
7. Run `npm run worker` under an OS service manager and monitor lease loss, failures and queued jobs. Do not use sandbox bypass flags or expose infrastructure secrets inside content-generation sessions.

The current runner scaffold uses a new `codex exec` session per stage, a structured output schema and five-minute leases renewed every minute. It invokes the CLI directly without shell interpolation. It withholds deployment/mail/database/runner credentials from child sessions. It checks generated paths against the session workspace. It intentionally blocks file-delivery and QC stages while their verified importer/orchestrator is pending.

For a manual pilot, an authorised user can download a Codex request pack and open a session themselves. A result/approval import path still needs completion before the portal can reflect that work. Manual handoff is not automatic email-to-Codex dispatch.

## 5. Validate all connected operations

Use [Advait’s pilot plan](ADVAIT_PILOT.md). Required evidence includes mailbox isolation/duplicate/catch-up tests, actual session launch, source/attachment hashes, reviewed artifacts, independent QC pass and element IDs, permission checks, human decisions bound to versions and all eight workflow outcomes. Record failed, blocked, skipped and unrun checks separately.

For this foundation, TypeScript, domain tests, production build and HTTP/browser checks pass. Microsoft authentication/folder reads, local PostgreSQL migrations and local queue/intake checks, plus deployed connector/access/webhook checks have also passed. Production database transactions, continuous notification delivery, interactive Entra sign-in, automatic Codex dispatch and all-eight deliverables remain unverified.
