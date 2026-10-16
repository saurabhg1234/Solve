# Diagram design references

Saurabh selected these repositories on 16 October 2026. The Mindmap implementation adapts their design methods; it does not install Claude, call an inference API, load CDN scripts or copy their sample business content.

- [Cocoon AI — Process Flow Diagram Generator](https://github.com/Cocoon-AI/process-flow-diagram-generator), commit `6e0c72a3b4b46f87ac01ed1291f646bf77beafb0`: process sequencing, explicit decisions, actor distinctions, exception/rework loops and standalone delivery. Copyright (c) 2025 Cocoon AI, MIT. Full notice: `licenses/Cocoon-AI-MIT.txt`.
- [Cathryn Lavery — Diagram Design](https://github.com/cathrynlavery/diagram-design), commit `b46c9701f035844a20b13ab0551315977188933b`: semantic type selection, restrained focal emphasis, grouped architecture boundaries, 4-unit geometry, orthogonal rounded routing, accessible SVG and geometry checks. Copyright (c) 2025 Cathryn Lavery, MIT. Full notice: `licenses/Cathryn-Lavery-MIT.txt`.

The Python/HTML renderer is an original Mindmap implementation of these methods, built on Zora's existing SVG/Word helpers. It is not a vendored copy of either renderer and does not claim conformance with every upstream style token or checker. The user-supplied proposal defines branding: white, navy, blue, restrained orange for action/decisions, readable Liberation Sans / Arial. The existing source reference, editable Word and vector PDF workflow remain authoritative for proposal delivery.

Upstream examples were read and visually inspected. Adaptations deliberately use local fonts, no remote scripts, print-sized labels, checked source/target ports and an offline atlas. The skills' default colour/font palettes, Claude installation flows and external export dependencies are not prerequisites for this project. Upstream changes require deliberate review, not automatic execution.
