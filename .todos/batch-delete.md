# Batch Delete

Select multiple documents on the home page and delete in one action.

## Convex functions (`packages/convex/convex/documents.ts`)
- `deleteDocuments(docIds: string[])` mutation — loops existing delete logic

## UI (`apps/web/src/routes/index.tsx`)
- Checkbox on each document card (visible on hover or via "Select" mode toggle)
- Sticky bottom bar appears when ≥1 selected: "Delete 3 documents" button + deselect all
- Confirmation dialog before executing

## Key files
- `packages/convex/convex/documents.ts`
- `apps/web/src/routes/index.tsx`
