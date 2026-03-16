# Bookmarks & Notes

Pin sentences with optional annotations; jump-to and export.

## Schema
Add `bookmarks` table to `packages/convex/convex/schema.ts`:
```ts
bookmarks: defineTable({
  userId: v.id("users"),
  docId: v.string(),
  sentenceId: v.string(),
  note: v.optional(v.string()),
}).index("by_user_doc", ["userId", "docId"])
```

## Convex functions (`packages/convex/convex/bookmarks.ts`)
- `addBookmark(docId, sentenceId, note?)` mutation
- `removeBookmark(bookmarkId)` mutation
- `listBookmarks(docId)` query

## UI (`apps/web/src/routes/reader.$docId.tsx`)
- Bookmark icon button next to active sentence
- Side panel / drawer listing bookmarks with jump-to
- Note edit inline (click bookmark → edit text)
- Export button: download bookmarks+notes as markdown

## Key files
- `packages/convex/convex/schema.ts`
- `packages/convex/convex/bookmarks.ts` (new)
- `apps/web/src/routes/reader.$docId.tsx`
