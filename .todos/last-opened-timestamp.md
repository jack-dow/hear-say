# Last Opened Timestamp

Show "Last opened 2 days ago" on document cards; sort by recency.

## Schema
Add `lastOpenedAt: v.optional(v.number())` to `documents` table.

## Convex functions (`packages/convex/convex/documents.ts`)
- `touchDocument(docId)` mutation: sets `lastOpenedAt = Date.now()`

## UI
- Call `touchDocument` when reader route loads
- Document cards on home page: show relative time ("3 hours ago", "Last week")
- Default sort: by `lastOpenedAt` desc, fall back to `_creationTime`

## Key files
- `packages/convex/convex/schema.ts`
- `packages/convex/convex/documents.ts`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/reader.$docId.tsx`
