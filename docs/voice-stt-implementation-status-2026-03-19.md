# Voice STT Implementation Status

Date: 2026-03-19
Project: USAN Desktop
Scope: `2.5 Voice STT`

## 1. Summary

Task `2.5 Voice STT` is now implemented for the current desktop stack.

The app now uses a local-first voice transcription path:

- local Whisper via `@kutalia/whisper-node-addon`
- automatic `ggml-base.bin` model resolution and first-run download
- OpenRouter Whisper fallback when local transcription is unavailable
- browser `SpeechRecognition` fallback for the Universal Composer when the preload voice bridge cannot start

This replaces the previous cloud-only STT path and removes the renderer's dependency on browser speech as the primary path.

## 2. What Changed

### Main-process STT engine

`apps/desktop/src/main/voice/stt-engine.ts` now:

- prefers local Whisper over cloud transcription
- resolves the local model from:
  - `USAN_WHISPER_MODEL_PATH`
  - `userData/models/whisper/ggml-base.bin`
  - bundled `resources/models/whisper/ggml-base.bin`
- downloads `ggml-base.bin` on first use when no local model is present
- falls back to OpenRouter Whisper only after local transcription fails

The implementation uses the Electron-friendly `@kutalia/whisper-node-addon` fork because it provides prebuilt Electron-compatible bindings and PCM input support on Windows.

### Voice flow integration

`apps/desktop/src/main/voice/wake-word-detector.ts` now emits the final `idle` voice event with transcript text attached.

This fixes the previous renderer integration problem where:

- STT could finish successfully
- the final event could still lose the transcript payload
- the Composer would miss or duplicate the returned text

### Universal Composer integration

`apps/desktop/src/renderer/src/pages/HomePage.tsx` now routes voice input like this:

1. try preload voice IPC first
2. use the main-process capture + STT path when available
3. fall back to browser `SpeechRecognition` only if the bridge cannot start

This means the Composer now prefers the same desktop voice path as the floating voice overlay instead of maintaining an unrelated renderer-only speech pipeline.

### Voice overlay behavior

`apps/desktop/src/renderer/src/components/voice/VoiceOverlay.tsx` no longer blocks the Stop button while `listenStart()` is waiting for the full transcription result.

Start is now fire-and-forget from the UI perspective, so the overlay can enter a listening state and still allow explicit stop.

## 3. Dependencies Added

The desktop package now includes:

- `@kutalia/whisper-node-addon`
- `node-record-lpcm16`

## 4. Validation

Passed:

- `npm run typecheck`
- `npm run test:unit`
- `npx vitest run tests/unit/stt-engine.test.ts tests/unit/home-page.test.tsx tests/unit/voice.store.test.ts tests/unit/voice-indicator.test.tsx`
- `npx eslint src/main/voice/stt-engine.ts src/main/voice/wake-word-detector.ts src/renderer/src/pages/HomePage.tsx src/renderer/src/components/voice/VoiceOverlay.tsx tests/unit/stt-engine.test.ts tests/unit/home-page.test.tsx`
- `npm run build`

## 5. Design Notes

- The local Whisper model defaults to multilingual `ggml-base.bin`, not `base.en`, because Korean is a first-class target.
- The renderer still keeps browser speech recognition as a fallback because it provides a practical online recovery path when the desktop voice bridge cannot start.
- The STT engine includes small test hooks for unit testing the local Whisper path without loading the native addon in test runtime.

## 6. Remaining Operational Notes

- `node-record-lpcm16` still depends on a working recorder backend such as SoX on Windows. If that capture path is unavailable, the app can still recover through the PowerShell dictation fallback or browser speech fallback for Composer use.
- The main-process Whisper path currently returns finalized utterances rather than continuously surfaced partial transcript chunks.
- If a team wants a fully bundled offline experience, `ggml-base.bin` should eventually be shipped as an installer-managed asset instead of first-run download only.
