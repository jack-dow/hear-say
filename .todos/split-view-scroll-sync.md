# Split View Scroll Sync

PDF pane and text pane scroll together in side-by-side mode.

## Approach
Already have page-level sync (both show same page). Extend to sentence-level scroll sync.

## Implementation (`apps/web/src/routes/reader.$docId.tsx`)
- When active sentence changes, scroll text pane to sentence (already done via `scrollIntoView`)
- Also scroll PDF pane: use sentence `bbox` to compute Y offset within the page canvas → `pdfContainer.scrollTop = ...`
- On manual text scroll: detect which sentence is ~centered in viewport → update active page if crosses boundary
- Debounce scroll handlers to avoid loops

## Key files
- `apps/web/src/routes/reader.$docId.tsx`
