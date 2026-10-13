# Connect Zora to Microsoft 365 without disturbing Jarvis

The requested mailbox already exists: **apex.ap@mindmapdigital.ai**. Jarvis also uses it. Reuse it; do not create another mailbox, rename the shared identity globally, change Jarvis’s secret, or replace existing mailbox rules as part of Zora setup.

The cloud has `Tenant`, `Client`, `Client_secret`, `Object`, and `EMAIL`. Native application authentication and mailbox-folder access now pass. The deployed Vercel connector also authenticates successfully and reads the Zora folder. These credentials were reused and configured securely in the Zora Vercel project.

## Verified status and remaining email steps

- Portal deployed at `https://zora-mindmap.vercel.app`, retaining the team's Vercel deployment protection.
- Dedicated **Zora** folder created in `apex.ap@mindmapdigital.ai`; `MS_ZORA_FOLDER_ID` configured in Vercel.
- Advait located in the tenant: `advait.mahajan@mindmapdigital.ai`. His consultant access and Saurabh's initial administrator/consultant/pricing-owner access are configured in the portal's allowlist/role map. Other approver roles still need assignment.
- Microsoft folder delta queries pass repeatedly against the local development database. The new folder currently contains no messages; this does not validate incoming-request processing.
- Deployed mailbox connector returns authenticated access; unsigned case requests return 401; webhook validation returns the expected plain text.
- Inbox-rule metadata access returns **403 ErrorAccessDenied**. The credential grants mailbox read/write, but not the settings permission needed to administer rules. Use the Outlook rule below; no new secret is needed.
- Continuous production monitoring is **not active**: production `DATABASE_URL` and the maintenance/dispatch runner remain unconfigured. The full Codex workflow and artifact/QC implementation is also still in progress.

In Outlook, create an Inbox rule: **subject contains `[ZORA]` → move to `Zora`**. Keep Jarvis routing separate. In the Entra application, add the Web redirect URI **`https://zora-mindmap.vercel.app/api/auth/callback`** before testing interactive sign-in. The app token's successful authentication does not prove that this new redirect URI is registered.

## 1. Establish Zora ownership

Recommended pilot routing, awaiting final confirmation:

1. Open the shared mailbox in Outlook on the web.
2. Use the **Zora** folder already created under that mailbox.
3. Add an Inbox rule for subjects containing **[ZORA]**, moving them into **Zora**.
4. Check existing Jarvis routing with its owner. A request must have one owner; Jarvis’s rules should exclude Zora requests. Do not overwrite other rules or change unread flags as an ownership mechanism.
5. Use subjects such as `[ZORA] W4 – RFP response for Example Company`. An explicit workflow is useful, but the consultant must confirm it against the sources.
6. Send test messages through the normal human mailbox tools: one Zora request, one Jarvis request, one ordinary email and one containing both markers. Only the Zora-only message should enter Zora’s queue.

The application rejects a Jarvis category or `[JARVIS]` subject marker even if a Zora marker is present. It does not process the entire Inbox. The application code does not mark messages read, move, delete or categorise them.

A dedicated alias or separate mailbox can be used instead if the team prefers. Configure its own routing before changing the monitored folder; keep the old sync state recoverable.

## 2. Verify the existing Entra application

In **Microsoft Entra admin center → App registrations**, locate the app matching `Client`. Verify that it belongs to the tenant matching `Tenant`. Keep credentials in secure environment settings.

`Object` is ambiguous until checked: Exchange application RBAC needs the **Enterprise application/service principal Object ID**, not the Object ID of the app registration. Open **Enterprise applications → the matching app → Overview** to verify it. Do not replace an existing binding just because its name is different from the new canonical names.

If this app is also used by Jarvis, establish whether its current permissions and scope can safely serve both agents. Do not remove permissions Jarvis needs. If separate app identity is required, register a distinct single-tenant app named **Zora – Mindmap Digital** and give it its own credential and scope. The current credentials should be tested first; a second app is not automatically required.

## 3. Restrict mailbox access

Zora’s implemented email transport only needs **read access** to the requested mailbox, including its attachments. It has no `sendMail` implementation. Do not add `Mail.Send` for this phase. Folder selection in application code provides agent routing; it does not create a Microsoft permission boundary between two agents sharing the same mailbox.

Ask the tenant admin to review effective Entra permissions and Exchange application RBAC. Prefer an Exchange **Application Mail.Read** role scoped to `apex.ap@mindmapdigital.ai`. Permissions can be additive: adding a scoped RBAC role does not narrow an existing unscoped Entra grant.

These are admin-side provisioning commands, using the verified app ID and **service principal** Object ID. They are not runtime commands and should not be run blindly on an existing shared app:

```powershell
Connect-ExchangeOnline

$appId = "<verified Application (client) ID>"
$servicePrincipalObjectId = "<verified Enterprise application Object ID>"

# Check existing service principal, scope and assignments before creating any.
Get-ServicePrincipal | Where-Object { $_.AppId -eq $appId }
Get-ManagementScope -Identity "ZoraMailbox" -ErrorAction SilentlyContinue
Get-ManagementRoleAssignment | Where-Object { $_.Name -eq "ZoraMailboxRead" }

# Only when these are absent and the existing app/permissions have been reviewed:
New-ServicePrincipal -AppId $appId -ObjectId $servicePrincipalObjectId -DisplayName "Zora Mail Reader"
New-ManagementScope -Name "ZoraMailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'apex.ap@mindmapdigital.ai'"
$exchangePrincipal = Get-ServicePrincipal | Where-Object { $_.AppId -eq $appId }
New-ManagementRoleAssignment -Name "ZoraMailboxRead" -Role "Application Mail.Read" -App $exchangePrincipal.Identity -CustomResourceScope "ZoraMailbox"

Test-ServicePrincipalAuthorization -Identity $exchangePrincipal.Identity -Resource "apex.ap@mindmapdigital.ai"
```

The admin should also test an unrelated mailbox outside the scope. `Test-ServicePrincipalAuthorization` tests RBAC assignments; separately audit Entra grants. Existing app access policy configurations may need their own verification. The official Microsoft documentation linked below is the authority for the tenant’s current supported setup.

## 4. Enable work-account sign-in

For the Entra app used by the portal:

1. Configure a **Web** redirect URI: `https://<Zora deployment hostname>/api/auth/callback`.
2. Use a single-tenant registration for the Mindmap tenant.
3. For local development only, also register `http://localhost:3000/api/auth/callback` if needed.
4. The portal requests `openid profile email` and checks issuer, tenant, client audience, nonce and PKCE/state.
5. The initial allowlist already includes Saurabh and Advait's verified work addresses. Extend it only for authorised team accounts. An empty allowlist denies access.
6. The initial `ZORA_ROLE_MAP` is configured; complete assignment of the remaining BRD approver roles. Admin access does not bypass an architect or pricing approval.

Use a separate sign-in app if your existing mailbox daemon app must not support interactive login. That separation requires a small configuration extension; do not change Jarvis’s app registration blindly.

## 5. Identify the Zora folder

With the existing app’s authenticated read access, list folders through Microsoft Graph:

```text
GET https://graph.microsoft.com/v1.0/users/apex.ap@mindmapdigital.ai/mailFolders?$select=id,displayName
```

Select the ID of the **Zora** folder and save it as `MS_ZORA_FOLDER_ID`. The folder ID is not a credential. If the folder is nested, traverse the parent’s `childFolders` instead of guessing an ID. Do not paste tokens into chat or command history.

## 6. Configure the deployed environment

Use the existing alias names or their canonical equivalents:

| Canonical name | Existing cloud alias | Purpose |
|---|---|---|
| `MS_TENANT_ID` | `Tenant` | Tenant-specific sign-in/token endpoint |
| `MS_CLIENT_ID` | `Client` | App identity |
| `MS_CLIENT_SECRET` | `Client_secret` | Secure app credential |
| `MS_SERVICE_PRINCIPAL_OBJECT_ID` | `Object` | Verified Enterprise application ID, for provisioning |
| `MS_ZORA_MAILBOX` | `EMAIL` | `apex.ap@mindmapdigital.ai` |
| `MS_ZORA_FOLDER_ID` | None | Folder monitored only by Zora |
| `ZORA_SUBJECT_TAG` | None | `[ZORA]`, unless routing changes |
| `ZORA_WEBHOOK_SECRET` | None | Random 32–128 character notification verification secret |

The hosting runtime also needs the database, session secret, team allowlist and maintenance secret listed in [the environment guide](ENVIRONMENT_AND_DEPLOYMENT.md). Cloud task variables do not automatically populate a Vercel project. Proxy-injected placeholders must not be copied out as if they were raw credentials.

## 7. Connect notifications and catch-up

The deployed endpoints are:

```text
POST /api/microsoft/notifications
POST /api/microsoft/maintenance
```

The notification endpoint returns Microsoft's validation token as plain text. Subsequent notifications must match the stored subscription and the secret `clientState`. Accepted signals are persisted before acknowledgement; background sync reads the configured Zora folder through delta queries, deduplicates immutable message IDs, and retains its cursor.

The project retains Vercel deployment protection. `ZORA_NOTIFICATION_BYPASS` is configured privately for Microsoft's callback, and the subscription URL includes that automation token only when needed. Do not publish a full token-bearing callback URL. The portal's normal protection remains enabled. The protected-hosting validation endpoint has been verified, but a production Graph subscription has not been registered while durable production storage is absent.

The maintenance endpoint requires `Authorization: Bearer <CRON_SECRET>`. The signed-in worker scaffold calls it once a minute when configured. It renews subscriptions, handles reauthorisation/removal notifications and catches up missed mail. If you use manual request packs, provide a separate regular maintenance scheduler. Do not assume that a subscription lives forever or that Vercel runs a persistent inbox daemon. Do not add a Vercel paid scheduler silently; choose the schedule supported by your actual plan.

The code uses a five-day basic notification subscription, without rich notification payloads. Verify Microsoft’s current resource limits before connected deployment. It does not claim zero-latency mail delivery; record actual latency during the pilot.

## 8. Verify with Advait

Validate sign-in, allowed/denied users, mailbox scope, folder routing, webhook verification, duplicate delivery, a downtime/catch-up scenario and subscription renewal. Test attachment retrieval before expecting Zora to draft from an emailed RFP: the current foundation records an attachment notice but the ingestion/import path still needs implementation. A queued email does not prove its attachments were read or a Codex session started.

For emails created by Zora, verify the magenta stripe at the top and orb/signature in Outlook web, Outlook desktop and a mobile client. The shared account remains `apex.ap@mindmapdigital.ai`; Jarvis keeps its own branding. Release and sending remain human actions.

## Official references

- [Create a shared mailbox](https://learn.microsoft.com/en-us/microsoft-365/admin/email/create-a-shared-mailbox)
- [Exchange application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
- [Microsoft Graph webhook delivery](https://learn.microsoft.com/en-us/graph/webhooks)
- [Subscription properties and lifetimes](https://learn.microsoft.com/en-us/graph/api/resources/subscription)
- [Message delta query](https://learn.microsoft.com/en-us/graph/delta-query-messages)
- [Application client credentials](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)

The official Exchange application RBAC and Graph subscription references were retrieved successfully once network access was enabled. They confirm additive permission grants, a 128-character maximum `clientState`, and the need to renew subscriptions. Scope changes to the shared app remain an administrator task and must preserve Jarvis's requirements.
