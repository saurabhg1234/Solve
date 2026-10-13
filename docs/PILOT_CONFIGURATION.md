# Pilot roles and environment values

The original roles come from the supplied BRD. Saurabh's pilot allocation supersedes that human-role model:

| Responsibility | Owner |
|---|---|
| Administrator / consultant | Saurabh; Advait as consultant |
| Bid owner | Named sales accounts, requested from Advait |
| Architecture, domain and technical effort review | Zora in Codex; independently reviewed tasks, not a fake human identity |
| Delivery approval | Outside this pilot phase |
| Pricing | Ganesh Thyagarajan, `ganesh@mindmapdigital.ai` |
| Demo building and human demo acceptance | Advait's nominated team |

Set `ZORA_APPROVAL_POLICY=mindmap-pilot`. W3-G2, W4-G2, S1-G1 and W6-G1 become independent Codex review checkpoints and retain QC holds. W6-G2 still requires consultant and demo-builder approval. Pricing and consultant/sales release remain human decisions. `brd` retains the original human allocation; missing policy defaults to `brd`, and an unknown value fails closed.

## Values to enter in cloud settings

`ZORA_ROLE_MAP` is this JSON value, without surrounding shell quotes:

```json
{"saurabh@mindmapdigital.ai":["admin","consultant"],"advait.mahajan@mindmapdigital.ai":["consultant"],"ganesh@mindmapdigital.ai":["pricing_owner"]}
```

`ZORA_ALLOWED_EMAILS`:

```text
saurabh@mindmapdigital.ai,advait.mahajan@mindmapdigital.ai,ganesh@mindmapdigital.ai
```

Extend both with verified sales/demo work addresses when Advait supplies them. Do not grant all roles to everybody or create a human architect/domain-owner identity for Zora. Pursuit-specific team assignment is still implementation work; an allowlist alone does not grant every case.

| Variable | Value / source |
|---|---|
| `ZORA_APP_URL` | `https://zora-mindmap.vercel.app` |
| `DATABASE_URL` | Actual approved Neon connection string, entered privately; never `[SENSITIVE]` from a redacted CLI download |
| `ZORA_SESSION_SECRET` | Existing session-signing secret, matching Vercel and cloud |
| `ZORA_RUNNER_TOKEN` | Existing queue/session transport token, matching Vercel and cloud; not a Codex login/API key |
| `ZORA_WEBHOOK_SECRET` | Existing Graph verification secret, matching Vercel and cloud; 32–128 characters |
| `CRON_SECRET` | Existing maintenance bearer secret, matching Vercel and cloud; it authenticates a run but does not create a schedule |
| `ZORA_NOTIFICATION_BYPASS` | Existing Zora-project Vercel automation bypass, already private in Vercel; reuse in cloud settings for protected service requests |
| `ZORA_APPROVAL_POLICY` | `mindmap-pilot` |
| `ZORA_SUBJECT_TAG` | `[ZORA]` |
| `MS_ZORA_FOLDER_ID` | Reuse the saved Zora folder ID suggestion |
| `VERCEL_ORG_ID` | `team_5DBsUWiufrEcP2odn32rtSJD` |
| `VERCEL_PROJECT_ID` | `prj_CMo2oudsZpGIt0JiuYLjV5mPjcyA` |

The four application secrets are now supplied in the cloud runtime and securely synchronised to Vercel. They are distinct and meet the minimum 32-character length. Keep those values; do not regenerate them independently or paste them into chat. Their values are intentionally absent from saved draft suggestions, the repository and routine prompt. Existing Microsoft credentials and `VERCEL_TOKEN` remain valid; no model API key is required.

## Advait coordination

An authorised email was sent from `apex.ap@mindmapdigital.ai` to `advait.mahajan@mindmapdigital.ai`, subject **[ZORA] Pilot inputs and team details — all eight workflows**, with Zora's magenta stripe and orb. Microsoft accepted sending and the saved message has `isDraft=false` and a send timestamp. It requests the Word template, historical RFP/RFI/response sets, tender-agent code, demo/video assets, sample pursuits/transcripts, video-tool preferences, sales/demo names and test availability. No reply or meeting is confirmed yet.

Other BRD business settings are deferred at Saurabh's request. Missing values must hold the relevant stage; never turn a guess into a client commitment.
