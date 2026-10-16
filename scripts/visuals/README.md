# Proposal visuals

Read [the design standard](../../docs/PROPOSAL_DESIGN_STANDARD.md) before building a proposal. These helpers generate new vector diagrams with explicit text and geometry; they do not edit supplied reference artwork.

- `proposal_diagrams.py`: colour tokens, line icons, cards, lanes, connectors, captions and SVG output. Text wrapping uses actual Liberation Sans font metrics. Text/box overflow raises an error; inspect connectors and composition visually as well.
- `render_proposal_figures.mjs`: renders self-contained generated SVGs locally with Playwright; all network requests are blocked. Supply the installed Playwright module and Chromium executable. It does not load credentials into the browser child.
- `word_figures.py`: embeds an SVG in DOCX with a PNG fallback, title and description. Rejects active SVG content and external references. Modern Word and the verified LibreOffice PDF export use the vector version.

Dependencies: Python 3, Pillow, python-docx and lxml; Liberation Sans fonts; Node and a separately installed Playwright/Chromium. PDF export/inspection uses the existing LibreOffice and PyMuPDF toolchain. These are document tools, not runtime web-app dependencies.

```bash
node scripts/visuals/render_proposal_figures.mjs \
  /private/proposal/figures \
  /installed/playwright/index.mjs \
  /installed/chromium
```

The optional fourth argument is fallback raster scale (default 1). It does not change the SVG or printed figure dimensions. Use `add_vector_figure(document, paragraph, svg_path, png_path, width_inches, description, title)` when assembling Word. Retain the SVGs separately so their text and geometry can be edited.

Keep source-specific content, generated figures, Word/PDF files and delivery receipts outside Git. Render and inspect the complete final document, verify figure counts/alt text and output hashes, and follow the normal delivery and approval boundaries.
