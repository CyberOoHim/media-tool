# Video Tool

Local **video player**, **frame capture**, and **image bench** — crop, convert, and compress stills to a size budget. Everything runs in the browser. Nothing is uploaded.

Original HTML prototypes live in [`refs/`](./refs/) and were rebuilt here as a modular TanStack Start app.

## Workspace

| Route | What |
| --- | --- |
| `/` | Combined workspace: player + bench + capture strip |
| `/player` | Video player and captures |
| `/bench` | Image optimizer |

## Features

**Player**

- Drag-drop or pick a local video
- Play / pause, ±10s, jump to start / end
- Frame step, playback rate, volume, mute, fullscreen
- Seek bar (mouse + touch), jump to `HH:MM:SS`
- Capture current frame → session strip **and** the bench
- Copy frame to clipboard
- Keyboard: `Space` `←/→` `,` `.` `[` `]` `S` `C` `M` `F`

**Bench**

- Drag-drop, click, or paste an image (or receive a captured frame)
- Target size (KB), quality, format (Auto / JPEG / PNG / WebP)
- Cover-crop presets: banners, Open Graph, YouTube thumb, 1:1, 16:9, 4:3, 9:16, custom
- Quality-then-scale compression until the byte budget fits
- Source vs output stats and download / copy

Processing never leaves the device.

## Local development

```bash
npm ci
npm run dev
```

Then `npm run typecheck` and `npm run build` before a release.

## GitHub Actions

One workflow: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

- Every push and pull request: `npm ci`, typecheck, and a GitHub Pages build
- Push to `main`: deploy that build to GitHub Pages (Actions source)

No Vercel secrets. Pages URL after the first deploy:

`https://cyberoohim.github.io/video-tool/`

In the repo: **Settings → Pages → Source = GitHub Actions**.

## Layout (for contributors)

```
src/features/player   Video player, capture, keyboard
src/features/bench    Image optimizer UI
src/features/strip    Session capture gallery
src/features/media    Shared types, store, compress / crop / clipboard
src/components        Shell + UI primitives
src/routes            /  /player  /bench
refs/                 Original HTML tools
```

Add a feature as its own folder under `src/features/` and compose it from a route. Do not collapse new tools into a single HTML file.
