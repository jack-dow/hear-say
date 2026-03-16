# Document Rename

Let users set a friendly display name for uploaded documents.

## Schema
Add `displayName` field to `documents` table in `packages/convex/convex/schema.ts`:
```ts
displayName: v.optional(v.string())
```
Fall back to `filename` when not set.

## Convex functions (`packages/convex/convex/documents.ts`)
- `renameDocument(docId, displayName)` mutation

## UI
- Document card on home page: click name → inline edit input → blur/Enter saves
- Reader header: same inline edit

## Key files
- `packages/convex/convex/schema.ts`
- `packages/convex/convex/documents.ts`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/reader.$docId.tsx`
