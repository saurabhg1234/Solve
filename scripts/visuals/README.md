# Proposal visuals

Read [the design standard](../../docs/PROPOSAL_DESIGN_STANDARD.md) before building a proposal. These helpers generate new vector diagrams with explicit text and geometry; they do not edit supplied reference artwork.

- `proposal_diagrams.py`: colour tokens, line icons, cards, lanes, connectors, captions and SVG output. Text wrapping uses actual Liberation Sans font metrics. Text/box overflow raises an error; inspect connectors and composition visually as well.
- `render_proposal_figures.mjs`: renders self-contained generated SVGs locally with Playwright; all network requests are blocked. Supply the installed Playwright module and Chromium executable. It does not load credentials into the browser child.
- `word_figures.py`: embeds an SVG in DOCX with a PNG fallback, title and description. Rejects active SVG content and external references. Modern Word and the verified LibreOffice PDF export use the vector version.
- `diagram_scene.py`: semantic nodes and explicit orthogonal routes, title/description, geometry validation and JSON CLI. Rejects node/route/label collisions, disconnected or shared ports, and overflowing text. This is an authored layout system, not an automatic graph layout engine.
- `build_diagram_atlas.py`: offline searchable HTML with all figures, keyboard-accessible navigation, enlargement, native SVG/2× PNG download and print. Blocks active/external SVG content. No CDN or model API.
- `example.scene.json`: neutral authoring example, containing no client information.
- `client_proposal_preflight.py`: local Office-package checks for exact logo identity, cover artwork, repeating Word headers, all-slide branding, About Mindmap, company services/presence/customers, a closing/contact slide in actual presentation order, internal-language leaks and review residue. Accepts `--word`, `--slides`, `--brand-logo`, `--client-logo` and optional `--output`. Complements final visual inspection; it does not certify claims, quality or approval. The reusable company content specification is [MINDMAP_COMPANY_SLIDES.md](../../docs/MINDMAP_COMPANY_SLIDES.md).

Read [the diagram workflow](../../docs/DIAGRAM_WORKFLOW.md) and [source notices](THIRD_PARTY_NOTICES.md). The project-local `mindmap-diagrams` skill and native document instructions route future proposal work here.

```bash
python scripts/visuals/diagram_scene.py scripts/visuals/example.scene.json /private/output/example.svg
python -m unittest discover -s scripts/visuals -p 'test_*.py'
python scripts/visuals/build_diagram_atlas.py /private/output/figures /private/output/figure-manifest.json /private/output/atlas.html --title 'Solution diagrams'
```

An atlas manifest is an array of records with `id` (matching the SVG basename), `title`, `alt` and optional `type`. `Scene.save()` returns these fields plus geometry/check metadata. Keep client manifests private. SVG sources remain editable independently of the HTML; Word figures are not native Word drawing objects.

Dependencies: Python 3, Pillow, python-docx and lxml; Liberation Sans fonts; Node and a separately installed Playwright/Chromium. PDF export/inspection uses the existing LibreOffice and PyMuPDF toolchain. These are document tools, not runtime web-app dependencies.

```bash
node scripts/visuals/render_proposal_figures.mjs \
  /private/proposal/figures \
  /installed/playwright/index.mjs \
  /installed/chromium
```

The optional fourth argument is fallback raster scale (default 1). It does not change the SVG or printed figure dimensions. Use `add_vector_figure(document, paragraph, svg_path, png_path, width_inches, description, title)` when assembling Word. Retain the SVGs separately so their text and geometry can be edited.

Keep source-specific content, generated figures, Word/PDF files and delivery receipts outside Git. Render and inspect the complete final document, verify figure counts/alt text and output hashes, and follow the normal delivery and approval boundaries.
