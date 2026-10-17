# Reusable Mindmap company slides

Saurabh requested these as a standing proposal convention on 17 October 2026. Place a concise company section after the cover/About Mindmap slide, before the client's priorities. Follow the full [proposal design standard](PROPOSAL_DESIGN_STANDARD.md). Generic credentials do not add services to a project's priced scope.

## Default sequence

| Slide | Content | Source in October business deck |
| --- | --- | --- |
| About Mindmap | Enterprise AI engineering; document intelligence, workflow automation, integration and controlled deployment | Pages 2, 7, 15 |
| What we do | AI Centres of Excellence; Service-as-a-Software; sovereign AI solutions; industry solutions | Pages 11–14 |
| Engineering practices | Test automation; intelligent automation/RPA; data and analytics; digital engineering; work management; managed support; staff augmentation; AI skilling and learning | Page 15 |
| Our global footprint | Presence in India, UAE, UK, Europe and USA; location labels below | Pages 2 and 19 |
| Our customers | Actual customer logo artwork, supported company statistics and current/past identification qualification | Page 17 |
| Final closing slide | Thank you / Let's build; both logos; client-specific outcome statement; verified company contact and website | Contact details on page 19 |

Put the closing slide at the **actual end**, after any technical/agent appendix. A next-steps page near the end of the main narrative is useful but does not replace the final close.

## Current source facts

Reference: `AI_Solutioning_Agent_BRD_v1.0/MindMap AI Business Deck Oct 2026.pdf`, SHA-256 `4cc6771215d3da1739176b3fe92414984583a4a0bdcba21870d9a5a6d41bbf26`. Visually checked on 17 October 2026. These are company-provided claims, not independently audited figures; refresh them when a newer business deck is supplied. Keep this provenance in the internal build record, not as authoring commentary in the client slides.

- 50+ enterprise customers across 10 industries.
- 117 MindMap OS accelerators.
- 184 forward deployed engineers.
- 20+ customers with Mindmap for 3+ years.
- Presence: Hyderabad, Bengaluru and Noida (India); Dubai (UAE); London (UK); Amsterdam (Europe); Lewes (USA). Avoid treating Europe as a country or a list of regions as a count of offices.
- Closing contact: Saurabh Goenka, Co-Founder & CEO; `saurabh@mindmapdigital.ai`; `www.mindmapdigital.ai`.

Page 17 identifies current **or past** customers. Retain that distinction and the “no endorsement implied” qualification. It shows Atlantic Health, Apple, Deloitte, Wio, HSBC, Worksoft, Abbotsford, Capgemini, Franklin Madison, Dyson, Verizon, Airtel, Jubilant Industries, Shriram Finance, Edelweiss, State Street, Adani, Larsen & Toubro, Tata Consumer Products, ST Engineering Aerospace, Coty, United Therapeutics, KPMG, Sandoz, Pepsi, Infosys, MYND and Wipro. Use the actual supplied artwork with correct proportions; never ask an image generator to recreate customer logos. Do not attach a logo/name to an anonymised outcome story or imply every customer bought the proposed solution.

Do not copy broad model-production counts, certification badges, absolute data-boundary promises or unrelated outcome metrics without reconciling their evidence. Model statuses and engagement-model differences are documented in [Mindmap knowledge notes](MINDMAP_KNOWLEDGE.md). Generic offerings and the proposed client architecture must remain consistent; for example, available managed-support capability does not create a 24×7 SLA for a proposal that excludes it.

## Layout and checks

Use editable headings, company facts, service cards and location labels in PowerPoint. Logo artwork may be an embedded image or a native picture crop from the source deck; preserve its source bytes and note the source page internally. The Pentagon v3.1 build uses a native crop of the page-17 logo grid, with an editable qualification beneath it.

Run `scripts/visuals/client_proposal_preflight.py`. It checks section presence and the closing/contact slide in **actual presentation order**, alongside branding and client-language checks. These are packaging checks, not verification of a company claim or visual layout. Inspect all rendered slides, including logos, qualifiers, the final close and any changed slide numbers.

The current private working example is `/workspace/solve-environment/pentagon-company-2026-10-17`, built by `.zora/build-pentagon-company-slides.py`. Preserve its published files; create a new version for changes. Keep client-populated files outside Git.
