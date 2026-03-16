# Reading Stats

Track time spent, sentences/words read, and per-doc completion %.

## Schema
Add `readingSessions` table to `packages/convex/convex/schema.ts`:
```ts
readingSessions: defineTable({
  userId: v.id("users"),
  docId: v.string(),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  sentencesRead: v.number(),
}).index("by_user_doc", ["userId", "docId"])
```

## Convex functions (`packages/convex/convex/stats.ts`)
- `startSession(docId)` mutation → returns sessionId
- `endSession(sessionId, sentencesRead)` mutation
- `getDocStats(docId)` query → total time, sentences, completion %

## UI
- Reader: start session on play, end on pause/navigate away
- Document card on home page: show "43% complete · 12 min read"
- Stats drawer/modal in reader: breakdown per session

## Key files
- `packages/convex/convex/schema.ts`
- `packages/convex/convex/stats.ts` (new)
- `apps/web/src/routes/reader.$docId.tsx`
- `apps/web/src/routes/index.tsx`
