# Video Tool

Local **video player**, **frame capture**, and **image bench** — crop, convert, and compress stills to a size budget. Everything runs in the browser. Nothing is uploaded.

Original HTML prototypes live in [`refs/`](./refs/) and were rebuilt here as a modular TanStack Start app.

## Workspace

| Route | What |
| --- | --- |
| `/` | Combined workspace: player + bench + capture strip |
| `/player` | Video player and captures |
| `/bench` | Image optimizer |
| `/login` | Optional Google / X sign-in (tools work signed out) |

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

## GitHub Actions deploy (Vercel)

This repo ships two workflows:

- [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — typecheck + production build on every push and PR
- [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) — production deploy to Vercel on `main` (and manual **Run workflow**)

### One-time Vercel secrets

1. Create a Vercel project linked to this private repo (or an empty project; Actions will deploy into it).
2. In Vercel → Account Settings → Tokens, create a token.
3. Copy the **Organization ID** and **Project ID** from the project settings (`.vercel/project.json` after `vercel link`, or the Vercel dashboard URL).
4. In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Vercel access token |
| `VERCEL_ORG_ID` | Vercel org / team id |
| `VERCEL_PROJECT_ID` | Vercel project id |

Push to `main` (or run **Deploy** manually). CI still runs even if deploy secrets are missing; deploy will fail with a setup message until they are set.

Alternatively, skip the deploy workflow and use Vercel’s GitHub integration — it will build with `npm run build` (Nitro `vercel` preset).

## Layout (for contributors)

```
src/features/player   Video player, capture, keyboard
src/features/bench    Image optimizer UI
src/features/strip    Session capture gallery
src/features/media    Shared types, store, compress / crop / clipboard
src/components        Shell + UI primitives
src/routes            /  /player  /bench  /login
refs/                 Original HTML tools
```

Add a feature as its own folder under `src/features/` and compose it from a route. Do not collapse new tools into a single HTML file.
