# In-Document Search

Find text across all sentences; jump to match; highlight results.

## Approach
Client-side only — sentences already loaded in `doc.pages[].sentences[]`.

## UI (`apps/web/src/routes/reader.$docId.tsx`)
- `Cmd+F` / `Ctrl+F` opens search bar (floating or top-of-reader)
- Filter sentences by `text.toLowerCase().includes(query)`
- Show match count: "3 of 12"
- Prev/Next match navigation → scroll + highlight matched sentence
- Escape closes, clears highlights

## State
```ts
const [searchQuery, setSearchQuery] = useState("")
const matches = useMemo(() => /* filter sentences */, [sentences, searchQuery])
const [matchIndex, setMatchIndex] = useState(0)
```

## Key files
- `apps/web/src/routes/reader.$docId.tsx`
