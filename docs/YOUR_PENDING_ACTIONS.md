# Remaining inputs and decisions

**16 October update:** the existing-proposal diagnostic entry is implemented; no additional transcript or proposal upload is owed for Pentagon. Native fresh-reviewer dispatch remains the unresolved runtime dependency. See [EXISTING_PROPOSAL_REVIEW.md](EXISTING_PROPOSAL_REVIEW.md).

**16 October update:** development has resumed on main. Advait’s three file/progress issues are addressed in [SOURCE_CONTEXT_AND_PROGRESS.md](SOURCE_CONTEXT_AND_PROGRESS.md). Advait clarified at 15:21 Dubai that the description is physical-meeting notes and the proposal is the draft for QC. No transcript is owed; see NOTES_AND_EXISTING_DRAFTS.md. Claude’s hourly dispatcher last recorded a wake at 12:01 Dubai on 16 October when checked during this release; its provider-side task needs a status check. Earlier no-runtime statements below are historical; use [ZORA_HANDOFF.md](ZORA_HANDOFF.md) for current state.

Updated **16 October 2026 (Dubai)**. Codex development has resumed while preserving Claude’s existing runtime. No new Microsoft or Vercel secret is required. A new workspace still needs secure access to existing bindings/private sources.

**Received from Advait:** CompareIQ Word layout, seven PowerPoint files, Indigrid/Parker/Coty pilot packs, tender code, demo transcripts/Drive library and four team contacts. All thirteen attachments are imported as private drafts, and the Word/PDF format trial passed. See [the received-input inventory](ADVAIT_INPUTS.md). Do not ask for these files again.

**Mailbox monitoring is live:** verified Microsoft notifications plus a five-minute Vercel schedule. The portal shows last-sync and scheduled-heartbeat status. It continues collecting mail without an open Codex chat.

| Remaining item | Owner | Specific action |
|---|---|---|
| Work-account sign-in acceptance | Saurabh, Advait, Ganesh | Test the existing work-account sign-in at https://zora-mindmap.vercel.app and report an exact error if one occurs. Entra setup is already confirmed. |
| Responsibility mapping | Advait | Identify which of Shiva Shankar, Faiyaz, Nischal and Amarnath build demos, and name the sales/bid owners. No new permissions have been granted from the ambiguous list. |
| Working demo and reuse details | Advait | Supply direct app links/access for a first W6/W7 demo, expected test outputs/tolerances, maturity and any client-data/branding reuse limits. The Drive recordings and transcripts are already accessible. |
| Existing recording/voice/editing tools | Advait | Identify approved tools/licences. No accent preference is recorded; a fixed meeting is not required. |
| Additional historical clarifications | Advait, if available | Any missing Indigrid buyer answers/RFI/addenda. Parker's RFP, questionnaire, buyer answers, transcript and response are already received. |
| Existing Pentagon proposal review | Zora | Use the supplied meeting notes and existing draft. Initial diagnostic review is prepared; formal existing-draft QC entry and fresh reviewer execution remain engineering/runtime work. No transcript request is pending with Advait. |
| Claude dispatcher health | Saurabh / Claude scheduled-task owner | Inspect task `trig_01FStjqDrd8Bm92CqUg3Zuec` for an error, usage limit or paused state. Last database wake was 12:01 Dubai on 16 October when checked. Intake and dispatch are implemented; the provider-side recurrence needs diagnosis. Existing Microsoft/Vercel credentials are sufficient. |

Zora sent the authorised progress email to Advait at **07:16 Dubai on 15 October**, visibly copying Saurabh, and verified it in Sent Items. The receipt and details are in BUILD_STATUS.md and ZORA_HANDOFF.md. Do not send duplicate progress emails automatically. Every authorised outgoing email to others Ccs `saurabh@mindmapdigital.ai` and retains the magenta stripe/orb.

## Deferred business settings

Currency/rate rules, AI reduction ranges, tolerances, question caps, recency/scoring thresholds and email limits/hype lists remain explicit per-workflow inputs where not supplied. Claude added default QC settings through `ZORA_QC_POLICY`; inspect the recorded case policy before asking for QC settings again. Missing values hold affected stages; existing proposal numbers are not defaults.

## Engineering owned by Zora

ESC-4 return-point review/checklist updates and controlled escalation closure are implemented. Changed-source/pre-draft escalation continuation, original-producer resumption, real fresh semantic reviews and full W1–W8 acceptance remain engineering/testing work. These are not requests for Saurabh to resupply credentials or repeatedly prompt the agent.

## Environment housekeeping

The saved cloud notification-bypass binding is malformed, but the native transport securely resolves the existing production value using supplied Vercel credentials. No new secret is needed. Keep the existing checkout and private source originals. Saved cloud draft revision 16 has startup pointing to ZORA_HANDOFF.md; earlier writes returned INVALID_ARGUMENT and should not be retried blindly.
