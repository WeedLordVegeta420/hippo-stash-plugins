# SpriteTab

A [Stash](https://github.com/stashapp/stash) plugin that adds a **Sprites** tab to scene pages, showing the full sprite sheet as a navigable grid. Clicking any sprite seeks the video to that timestamp. An optional **Image Gallery mode** displays a still image instead, useful for network-mounted or slow-streaming content.

## Features

- Sprite grid tab on every scene page
- Hover tooltip with magnified preview
- Timestamp overlay on each sprite
- Adjustable grid column count via toolbar slider or fixed setting
- Compact view (removes gaps between sprites)
- Auto-scroll to the current sprite during playback
- **Image Gallery mode**: click a sprite to capture a full-resolution still frame
  - Falls back to cropping the sprite sheet when the video stream is too slow to seek
  - Can prefetch neighboring frames in the background for faster jumps
  - Includes on-image scrubber, time-jump, and fullscreen controls
- Touch support: long-press a sprite to show the tooltip; tap to seek/capture
- All display preferences saved per-browser (localStorage), separately from plugin settings

## Installation

### Via Stash Plugin Manager (recommended)

Add this repository to Stash → Settings → Plugins → Available Plugins source list, then install **Sprite Tab** from the list.

### Manual

1. Download `SpriteTab.yml`, `sprites.js`, and (if using Gallery mode) `SpriteTab.py` into a `SpriteTab` folder inside your Stash plugins directory.
2. Reload Stash plugins.

## Settings

Configure in **Stash → Settings → Plugins → Sprite Tab**.

| Setting | Type | Default | Description |
|---|---|---|---|
| Tooltip Enabled | Boolean | on | Show magnified preview when hovering over a sprite |
| Tooltip Preview Width | Number | 300 | Width of the hover popup in pixels |
| Show Timestamps | Boolean | on | Overlay the timestamp on each sprite |
| Compact View | Boolean | off | Remove gaps and borders between sprites |
| Auto-Scroll | Boolean | on | Scroll to keep the current sprite in view during playback |
| Grid Columns | Number | — | Fix the number of columns (1–12). Leave empty to show the slider in the toolbar instead |
| Image Gallery Mode | Boolean | off | Enable gallery mode by default (can also be toggled per-browser from the toolbar) |
| Gallery Prefetch Enabled | Boolean | on | Prefetch neighboring gallery frames in the background while the current frame is displayed |
| Gallery Prefetch Offsets Seconds | String | `5` | Comma-separated gallery prefetch offsets in seconds, for example `0.5, 1, 5` to warm the matching jump targets |
| Gallery Prefetch Window Seconds | Number | 30 | Prefetch this many seconds before and after the current gallery frame |
| Frame Server Port | Number | 9876 | Port the frame extraction server listens on |
| Frame Server Host | String | — | Hostname (and optional port) for the frame server, e.g. `myserver.example.com`. Set this when accessing Stash over HTTPS/a reverse proxy, since the frame server runs a plain WebSocket and must be proxied separately. Overrides the default of using the current page hostname with Frame Server Port. |
| Stash API Key | String | — | Deprecated — the server now reads the key directly from Stash's `config.yml`. Leave blank. |

## Image Gallery Mode

Gallery mode replaces video seeking with on-demand still-image capture. This is useful when video seeking is slow or impractical, e.g. for content served through a network filesystem or remote mount.

### How it works

1. The browser opens a WebSocket connection to the **frame extraction server** (a local Python process).
2. The server asks Stash for the stream URL, then runs `ffmpeg` to extract a JPEG at the requested timestamp.
3. If `ffmpeg` takes too long (e.g. the content is behind a slow rclone/NFS mount), the server automatically falls back to cropping the pre-generated sprite sheet that Stash already has on disk. This always responds quickly.
4. The JPEG is sent back over the WebSocket and displayed over the video player.
5. When gallery prefetch is enabled, nearby frames are fetched in the background and jump controls highlight when their destination frame is already cached.

### Setup

The frame server requires Python 3 and `ffmpeg`/`ffprobe` on the server.

1. Go to **Stash → Tasks → Start Frame Server**. The task completes immediately; the server runs in the background.
2. Open a scene page, click the **Sprites** tab, and tick the **Gallery** checkbox in the toolbar (or enable **Image Gallery Mode** in plugin settings to default it on).
3. Click any sprite — a still image appears over the player. Hover the image on desktop, or tap it on mobile, to reveal the gallery controls. Use the browser’s normal image context menu / press-and-hold actions directly on the image for open/save actions.

To stop the server: **Stash → Tasks → Stop Frame Server**.

The server writes its PID to `frame_server.pid` in the plugin directory. Starting it again while one is already running will stop the old instance first.

### Reverse proxy / HTTPS

If you access Stash over HTTPS, the browser will attempt a `wss://` connection. The frame server speaks plain WebSocket (`ws://`), so you need a TLS-terminating reverse proxy in front of port 9876.

Set **Frame Server Host** in plugin settings to the hostname (and port if non-standard) your reverse proxy exposes, e.g. `myserver.example.com` or `myserver.example.com:9876`. The plugin will then connect to `wss://myserver.example.com` instead of the bare hostname.

### Authentication

The frame server reads the API key directly from Stash's `config.yml` (two directories above the plugins folder). No manual key entry is needed. If your `config.yml` has no `api_key:` entry, authentication is assumed to be disabled.

### Sprite sheet fallback

When `ffmpeg` cannot seek to the requested timestamp within ~12 seconds (common with rclone VFS `vfs_cache_mode: full`, which requires downloading up to the seek point), the server:

1. Reads the pre-generated sprite sheet Stash already stores in its cache.
2. Uses `ffprobe` to determine the sheet dimensions.
3. Calculates which sprite cell corresponds to the requested timestamp.
4. Crops and 2× upscales that cell using `ffmpeg`.

The result is lower resolution than a full frame extraction but responds in under a second, making Gallery mode usable even for remotely-mounted content that cannot be seeked.

## Toolbar

The toolbar appears at the top of the Sprites tab.

- **Gallery checkbox** — toggles Image Gallery mode for the current browser only (overrides the plugin setting locally).
- **Columns slider** — adjusts the grid width. Only shown when **Grid Columns** is not fixed in plugin settings.

## Touch / Mobile

- **Tap** a sprite to seek the video to that timestamp (or capture a frame in Gallery mode).
- **Long-press** a sprite to show the magnified tooltip; drag to other sprites to preview them.
- In **Gallery mode**, tap the image to show or hide the on-image controls.
- The **Fullscreen** control requests browser fullscreen and, on supported mobile browsers, also locks the image to landscape orientation.
- Auto-scroll during playback is suppressed on mobile to avoid fighting page scroll.

## Development

```bash
cd plugins/SpriteTab
npm install
npm test              # Run Jest test suite
npm run test:coverage # Coverage report (100% function/line/statement required)
```

Sync to a local Stash instance:

```bash
STASH_PLUGIN_DIR=/path/to/stash/plugins/SpriteTab npm run sync
```

### Architecture

| File | Purpose |
|---|---|
| `sprites.js` | Main plugin entry point — DOM rendering, event handling, GraphQL queries, plugin lifecycle |
| `src/core.js` | Pure utility functions extracted for testability (time formatting, settings, tooltip positioning, grid math) |
| `SpriteTab.yml` | Plugin manifest and settings schema |
| `SpriteTab.py` | Frame extraction server — WebSocket server, `ffmpeg` frame capture, sprite sheet fallback |
| `__tests__/` | Jest test suite (unit + integration) |
