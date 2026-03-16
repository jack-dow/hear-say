# Retry Failed OCR

Surface error state on document cards and let user trigger a retry.

## Current state
`documents` table has `status: "error"` and `errorMessage` fields — but no UI surfaces this or allows retry.

## Convex functions (`packages/convex/convex/documents.ts`)
- `retryOcr(docId)` mutation: reset `status → "processing"`, clear `errorMessage`, increment `retryCount`, trigger internal OCR action

## UI (`apps/web/src/routes/index.tsx`)
- Document card: if `status === "error"` show red badge + error message snippet
- "Retry" button → calls `retryOcr` mutation
- Cap retries at 3 (already have `retryCount` in schema) — show "Retry limit reached" beyond that

## Key files
- `packages/convex/convex/documents.ts`
- `apps/web/src/routes/index.tsx`
