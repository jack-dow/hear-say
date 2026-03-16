# Processing Progress Indicator

Show meaningful progress during OCR instead of a generic spinner.

## Approach
Emit progress updates from Python API back to Convex during OCR.

## Python API (`apps/api/src/routers/ocr.py`)
- After processing each page, POST progress to Convex HTTP endpoint:
  `{ docId, pagesComplete, totalPages }`

## Convex HTTP (`packages/convex/convex/http.ts`)
- Add `POST /ocr-progress` route → mutation to update document progress fields

## Schema (`packages/convex/convex/schema.ts`)
- Add `processingProgress: v.optional(v.object({ done: v.number(), total: v.number() }))`

## UI (`apps/web/src/routes/index.tsx`)
- Document card in "processing" state: progress bar `done/total pages`
- e.g. "Processing... 4 / 12 pages"

## Key files
- `packages/convex/convex/schema.ts`
- `packages/convex/convex/http.ts`
- `apps/api/src/routers/ocr.py`
- `apps/web/src/routes/index.tsx`
