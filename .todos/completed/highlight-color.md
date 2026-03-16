# Highlight Color Customization

Let users pick the active-sentence highlight color for accessibility / preference.

## Approach
CSS custom property + `localStorage`.

## Implementation
- Define `--highlight-color` CSS var in root styles, used by active sentence styles
- Settings popover: preset swatches (yellow, green, blue, pink, orange) + custom color input
- `useReaderPrefs` stores selected color, applies to `document.documentElement` style on mount/change

## Key files
- `apps/web/src/app.css` (or equivalent global styles)
- `apps/web/src/hooks/useReaderPrefs.ts`
- `apps/web/src/routes/reader.$docId.tsx`
