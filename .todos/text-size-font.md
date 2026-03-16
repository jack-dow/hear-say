# Text Size & Font Controls

Adjustable font size and font family in text view.

## Approach
Store preference in `localStorage` (no backend needed).

## State / hook (`apps/web/src/hooks/useReaderPrefs.ts` — new)
```ts
type ReaderPrefs = { fontSize: number; fontFamily: "sans" | "serif" | "mono" }
```
Read/write via `localStorage`, expose setter.

## UI (`apps/web/src/routes/reader.$docId.tsx`)
- Toolbar button opens small popover:
  - Font size: `A-` / `A+` buttons (range 14–24px)
  - Font family: 3-way toggle (Sans / Serif / Mono)
- Apply via inline style or CSS custom property on reader container

## Key files
- `apps/web/src/hooks/useReaderPrefs.ts` (new)
- `apps/web/src/routes/reader.$docId.tsx`
