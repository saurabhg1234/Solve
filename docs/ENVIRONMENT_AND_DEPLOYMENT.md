# Environment variables, Codex runner and Vercel deployment

**Current handoff:** Saurabh selected Claude to continue development on 15 October 2026. Read [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md) for the consolidated setup, live evidence and private asset recovery. The existing content bridge targets Codex sessions and has no model API integration. Moving development to Claude does not itself deploy a new production provider/runtime. Microsoft Graph and hosting/queue transport remain infrastructure connections.

**Current runtime:** Neon is migrated and the four cloud application secrets match Vercel. Microsoft notifications and a five-minute Vercel maintenance cron are live and verified. Automatic agent dispatch is not deployed. Saurabh previously selected native cloud scheduling, but access to the required execution environment and recurrence were never verified. See [runtime options and gaps](AUTONOMOUS_RUNTIME.md), [the existing bridge](CLOUD_ROUTINE.md) and [current roles/variables](PILOT_CONFIGURATION.md). Attachments, team access, revisions and the independent review protocol are implemented; real fresh semantic review, ESC-4, complete document/demo/video production and all-eight acceptance remain pending.

## Current verified deployment

`https://zora-mindmap.vercel.app` is deployed in Saurabh's existing Vercel team, with deployment protection retained. Microsoft credentials, the Zora folder ID, application origin, initial team access, session/runner/webhook/maintenance secrets and the service callback's Vercel automation bypass are securely configured in that project. The deployment's Microsoft connector, unsigned-access denial and webhook validation checks pass.

Production Neon storage is configured; repeatable migrations use supported HTTPS. The additive file/team/revision schema is migrated. Vercel verifies its database connection and schema. Native bridge transport now downloads and persists files with hashes; recurrence is unverified. Local synthetic checks cover lease/pursuit isolation, chunked file storage, internal permissions and revisions. The application remains a foundation rather than an accepted automatic pilot.

## Variables and where they belong

| Variable | Required for | Secret? | Notes |
|---|---|---|---|
| `ZORA_APP_URL` | Portal, callbacks, worker | No | Actual stable HTTPS deployment origin in production |
| `DATABASE_URL` | Persistent case/queue/mail/private files | Yes | Existing Neon PostgreSQL connection with provider TLS |
| `ZORA_SESSION_SECRET` | Work-account sessions | Yes | At least 32 random characters |
| `ZORA_ALLOWED_EMAILS` | Sign-in | No | Approved work emails separated by commas; empty denies access |
| `ZORA_ROLE_MAP` | Human gates | No | JSON email-to-role mapping; pricing access is explicit |
| `ZORA_RUNNER_TOKEN` | Portal ↔ runner | Yes | At least 32 random characters, separate from session/webhook secrets |
| `ZORA_WEBHOOK_SECRET` | Graph notification client-state verification | Yes | Existing secret, 32–128 characters |
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

Those are shape examples, not actual configured accounts. An admin can access pursuits but cannot approve a role-specific gate merely by being an admin. Pursuit team assignment is implemented; it does not replace account allowlists or role-specific access checks.

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

Use the existing Neon database destination. Native Codex sessions use the published cloud environment and supported network transport; never tunnel around network policy.

## 2. Prepare durable storage and access

Saurabh connected Neon and supplied `DATABASE_URL` securely. Use `NODE_USE_ENV_PROXY=1 npm run db:migrate` in this cloud workspace: direct PostgreSQL sockets are unavailable, so verified Neon hostnames use supported HTTPS transport with explicit statement boundaries and a transaction. Both migrations and the live Vercel connection are verified. The portal keeps PostgreSQL connections from Vercel.

Supply the allowlist, role map, secrets, callback origin and Microsoft folder variables. The current portal is a safe preview until its database and identity are configured; it contains no live client records when unauthenticated. Data isolation, artifact/source storage and team access must pass the acceptance plan before production use.

## 3. Build and deploy the portal

```bash
npm ci
npm run typecheck
npm test
npm run build
```

The **zora-mindmap** Vercel project is linked through ignored `.vercel/project.json`, using the Next.js preset and repository root. Its protected stable hostname, production storage and registered Microsoft subscription are available. Recurring mailbox maintenance is verified; unattended reasoning/processing remains unfinished.

Deployment has been confirmed by Vercel's READY result and deployed HTTP checks. Reuse the existing token and project link for subsequent deployments. Root-only `.vercelignore` exclusions preserve the hosted `app/api/worker` routes while excluding the local worker, test scripts and original document assets.

After deployment, register the exact Microsoft redirect URI and configure `ZORA_APP_URL` to that stable origin. Verify the deployed HTTP response, sign-in, authenticated database operations and webhook verification. A successful build alone is not a deployment test.

## 4. Optional separate Codex CLI runner

The earlier native cloud schedule was never verified. The separate CLI design below is historical planning, not an active or launch-ready service. **Do not run the existing `npm run worker` unchanged:** it predates the current context/reviewer protocol. Use [the current runtime plan](AUTONOMOUS_RUNTIME.md) and [Claude handoff](CLAUDE_HANDOFF.md) before choosing or implementing a dispatcher. Vercel hosts the portal and mailbox monitor.

1. Install the official Codex CLI on the runner using its supported distribution.
2. Sign in interactively with the designated Codex account on that machine. Do not extract or upload its OAuth/session files to Vercel.
3. Use the existing Solve checkout. A cloud task is already isolated; do not create another Git worktree unless requested.
4. Configure `ZORA_APP_URL`, `ZORA_RUNNER_TOKEN`, `CRON_SECRET`, runner identity and private work/repository directories on the runner.
5. Prepare PDF/DOCX/PPTX/Pillow/PyMuPDF and English Tesseract tools. W6 needs browser/test tooling; W7 needs an agreed local voice/recording/editing toolchain. Raw audio transcription tools must also be selected before expecting recording-only requests to work.
6. Complete independent QC orchestration and all-eight acceptance before allowing automatic delivery progression.
7. Only after upgrading and testing the dispatcher against the current queue/reviewer/continuation contract, register the new worker with a service manager and verify lease recovery, failures and queued jobs. Do not expose infrastructure secrets inside content-generation sessions.

The optional CLI runner uses a new `codex exec` session per stage, structured results and five-minute leases renewed every minute. It withholds infrastructure credentials from child sessions, validates paths and imports actual files through the same chunked transport as the native bridge. This optional legacy runner does not attest a native task identity; use the chosen native bridge for the new independent reviewer queue. Missing identity/evidence/policy holds QC.

For a manual pilot, an authorised user can download a request pack and open an appropriate session. The current native bridge persists actual results/files and independent-review reports, and human approvals remain portal actions. Another provider needs an adapter preserving those contracts. Manual handoff is not automatic email-to-agent dispatch.

## 5. Validate all connected operations

Use [Advait’s pilot plan](ADVAIT_PILOT.md). Required evidence includes mailbox isolation/duplicate/catch-up tests, actual session launch, source/attachment hashes, reviewed artifacts, independent QC pass and element IDs, permission checks, human decisions bound to versions and all eight workflow outcomes. Record failed, blocked, skipped and unrun checks separately.

For this foundation, TypeScript, domain tests, production build and HTTP/browser checks pass. Microsoft authentication/folder reads, local PostgreSQL migrations and local queue/intake checks, deployed connector/access/webhook checks, durable production source imports and recurring mailbox maintenance have passed. Interactive Entra sign-in, automatic reasoning-agent dispatch, real fresh semantic reviews and all-eight deliverables remain unaccepted. See the dated handoff/build evidence for checks actually rerun.
