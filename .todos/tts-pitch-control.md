# TTS Pitch Control

Allow user to adjust voice pitch to make robotic voices more natural.

## Approach
Depends on TTS backend. Two paths:

### If using Piper TTS (Python API)
- Piper supports `--noise_scale` and `--length_scale` flags
- Add `pitch` / `lengthScale` params to `/api/tts` endpoint
- Pass through from frontend request

### If using Transformers.js (client-side)
- SpeechT5 and similar support `speakerEmbeddings` manipulation
- May be limited — check model API for pitch shift support

## UI
- Toolbar popover (alongside speed control): pitch slider −2 to +2 semitones (or 0.5–2.0 scale)
- Store in `useReaderPrefs` (see text-size-font.md)

## Key files
- `apps/web/src/routes/reader.$docId.tsx`
- `apps/web/src/lib/api.ts`
- `apps/api/src/routers/tts.py` (if server TTS)
- `apps/api/src/services/tts.py` (if server TTS)
