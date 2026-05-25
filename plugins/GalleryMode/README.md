# GalleryMode

A [Stash](https://github.com/stashapp/stash) plugin that turns a scene into a navigable photo gallery. Adds a **Gallery** button to the video player toolbar; when active, the current frame is captured and displayed as a still image with on-image scrubber, jump, and fullscreen controls. Pairs with [SpriteTab](../SpriteTab/) — clicking a sprite while gallery mode is on opens that timestamp as a gallery image.

## Features

- Toolbar button on every scene player that toggles gallery mode
- On-image controls: scrubber, time-jump (±1s / ±5s / etc.), fullscreen, close
- Pinch-zoom and pan on touch devices and tablets
- Prefetches neighboring frames in the background so jumps feel instant
- Two extraction modes: client-side (default) and server-side (experimental, see below)

## Installation

### Via Stash Plugin Manager (recommended)

Add this repository to **Stash → Settings → Plugins → Available Plugins** source list, then install **Gallery Mode** from the list.

### Manual

Download `GalleryMode.yml`, `gallery.js`, and `GalleryMode.py` into a `GalleryMode` folder inside your Stash plugins directory, then reload Stash plugins.

## How it works

By default, gallery mode runs entirely client-side: the browser captures the current video frame at the configured timestamp and displays it as a still image. This needs no extra setup — install the plugin, click the Gallery button, you're done.

Optional **low bandwidth mode** moves frame extraction onto the server, useful for content served through a slow network mount where browser-side seeking is impractical.

## Low bandwidth mode (experimental)

> ⚠️ **Experimental.** The server-side path is still rough around the edges and requires a manual start every time the Stash server restarts. Use the default client-side mode unless you have a specific reason to switch.

When **Low Bandwidth Mode** is enabled, the browser opens a WebSocket connection to a local Python frame-extraction server instead of capturing frames from the video element. The server uses `ffmpeg` to seek and extract a JPEG at the requested timestamp.

### Requirements

- `ffmpeg` and `ffprobe` must be installed on the host running Stash and available on `PATH`. The frame server shells out to them directly; there is no fallback if they are missing.
- Python 3 (Stash already requires it for plugins, so this is usually a no-op).

### Starting and stopping the frame server

The frame server does **not** start automatically. You must launch it manually after each Stash restart:

1. **Stash → Settings → Tasks → Start Frame Server** — spawns the server as a detached background process and returns immediately.
2. To stop it: **Stash → Settings → Tasks → Stop Frame Server**.

The server writes its PID to `frame_server.pid` in the plugin directory. Restarting it while an instance is already running will stop the old one first.

### Reverse proxy / HTTPS

If you access Stash over HTTPS, the browser will try to connect via `wss://`. The frame server only speaks plain `ws://`, so you need a TLS-terminating reverse proxy in front of the frame server port. Set **Frame Server Host** in the plugin settings to the hostname (and optional port) your proxy exposes — for example `myserver.example.com` or `myserver.example.com:9876`.

### Authentication

The frame server reads the API key directly from Stash's `config.yml` (two directories above the plugin folder). No manual key entry needed. If `config.yml` has no `api_key:` entry, authentication is assumed disabled.

## Settings

Configure in **Stash → Settings → Plugins → Gallery Mode**.

| Setting | Type | Default | Description |
|---|---|---|---|
| Default Mode | String | `remember` | Gallery mode state on page load: `remember` (restore last state), `always_on`, `always_off` |
| Show Debug Panel | Boolean | off | Show the gallery overlay's internal debug panel |
| Low Bandwidth Mode | Boolean | off | Use the server-side frame extractor instead of capturing frames in the browser (experimental — see above) |
| Frame Server Host *(Low-bandwidth mode only)* | String | — | Override hostname for the frame server. Needed when Stash is behind an HTTPS reverse proxy |
| Frame Server Port *(Low-bandwidth mode only)* | Number | 9876 | Port the frame server listens on |
| Prefetch Enabled *(Low-bandwidth mode only)* | Boolean | on | Prefetch neighboring frames in the background |
| Prefetch Offsets *(Low-bandwidth mode only)* | String | `5` | Comma-separated prefetch offsets in seconds, e.g. `0.5, 1, 5` |
| Prefetch Window *(Low-bandwidth mode only)* | Number | 30 | How far ahead/behind the current frame to prefetch (seconds) |

## Development

```bash
cd plugins/GalleryMode
npm install
npm test              # Run Jest test suite
npm run test:coverage # Coverage report
```

Sync to a local Stash instance:

```bash
STASH_PLUGIN_DIR=/path/to/stash/plugins/GalleryMode npm run sync
```

### Architecture

| File | Purpose |
|---|---|
| `gallery.js` | Main plugin entry point — toolbar button injection, overlay rendering, frame capture, prefetch scheduler |
| `src/gallerySession*.js` | Reducer-based session state (selectors, effects, events, store, renderer) |
| `src/core.js` | Pure utility functions extracted for testability |
| `GalleryMode.yml` | Plugin manifest and settings schema |
| `GalleryMode.py` | Optional frame extraction server (low bandwidth mode) — WebSocket server, `ffmpeg` frame capture |
| `__tests__/` | Jest test suite (unit + integration + reducer) |
