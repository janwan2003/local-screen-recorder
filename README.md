# Diskreel

A free screen recorder that runs entirely in the browser and saves **MP4** to your own disk.
Screen, window or tab, with a round webcam bubble and microphone. No account, no upload,
no watermark, no time limit.

- Web app: https://janwan2003.github.io/local-screen-recorder/app/
- Website: https://janwan2003.github.io/local-screen-recorder/
- Chrome/Edge extension: `dist/diskreel-<version>.zip` (store listing pending)

## How it works

| Step | Where | What |
|---|---|---|
| Capture | `src/app/capture.js` (page) | `getDisplayMedia` + `getUserMedia`; mic and tab/system audio mixed in an `AudioContext`; each track becomes a frame stream (`MediaStreamTrackProcessor`) handed to the worker |
| Compose + encode | `src/app/worker.js` (dedicated worker, not throttled in background tabs) | screen frame + mirrored webcam circle on an `OffscreenCanvas`; WebCodecs encodes H.264 (VP9/AV1/VP8 fallback) and AAC (Opus fallback) via [Mediabunny](https://mediabunny.dev) (MPL-2.0) |
| Store | worker → OPFS | fragmented MP4 written straight to the origin private file system with a sync access handle, so a crash keeps everything up to the last fragment and memory use stays flat |
| Export | `src/app/library.js` | remux to a regular fast-start MP4, or transcode to WebM; trims copy packets (cut snaps to a key frame, every 2 s) instead of re-encoding |

The extension (`src/extension/`) is the same app opened in a tab from the toolbar button
(Alt+Shift+R). It requests no permissions.

## Develop

```
corepack pnpm install
pnpm test            # unit tests (node --test)
pnpm e2e             # build + real-Chromium end-to-end test (needs ffmpeg/ffprobe)
node scripts/screenshots.js shots --site   # desktop/phone screenshots, refresh site images
node scripts/icons.js                      # re-render extension icons from src/app/icon.svg
```

`pnpm e2e` records through the web app and the extension with Chromium's fake camera,
microphone and screen, then checks every output with ffprobe/ffmpeg: codecs, duration with a
pause excluded, a trimmed fast-start MP4, a WebM export, rename/delete, camera-only mode,
reload persistence and a tab closed mid-recording.

## Licence

MIT. Mediabunny is bundled unmodified under MPL-2.0 (`vendor/MEDIABUNNY-LICENSE.txt`).
