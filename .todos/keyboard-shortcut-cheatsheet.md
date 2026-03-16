# Keyboard Shortcut Cheatsheet

Discoverable `?` key opens a modal listing all shortcuts.

## Current shortcuts (from codebase)
- `Space` — play/pause
- `←` / `→` — prev/next sentence
- `PageUp` / `PageDown` — prev/next page
- `[` / `]` — speed down/up

## Implementation
- Add `?` keydown listener in reader
- Opens a simple modal/dialog with a table of all shortcuts
- Group by category: Playback, Navigation, Speed
- Also add a `?` icon button in toolbar for mouse users

## Key files
- `apps/web/src/routes/reader.$docId.tsx`
- Possibly extract shortcut definitions to `apps/web/src/lib/shortcuts.ts` for single source of truth
