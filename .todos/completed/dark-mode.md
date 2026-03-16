# Dark Mode

System-preference-aware dark mode with manual toggle.

## Approach
Tailwind v4 `dark:` variant + CSS custom properties. Store preference in `localStorage`.

## Implementation
- Add `darkMode: 'class'` strategy (or Tailwind v4 equivalent `@variant dark`)
- Hook `useDarkMode`: reads `localStorage`, listens to `prefers-color-scheme`, sets `class="dark"` on `<html>`
- Toggle button in app header/nav

## Key files
- `apps/web/src/app.css` (or root layout) — add dark-mode CSS vars
- `apps/web/src/hooks/useDarkMode.ts` (new)
- `apps/web/src/routes/__root.tsx` — apply hook, add toggle button
- Audit all route files for `dark:` variants on bg/text colors
