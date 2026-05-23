# SpriteTab

A [Stash](https://github.com/stashapp/stash) plugin that adds a **Sprites** tab to scene pages, showing the full sprite sheet as a navigable grid. Clicking any sprite seeks the video to that timestamp.

For photo-gallery-style still-image viewing, install the companion [GalleryMode](../GalleryMode/) plugin — when both are active, clicking a sprite opens the corresponding frame as a gallery image instead of seeking the video.

## Features

- Sprite grid tab on every scene page
- Hover tooltip with magnified preview
- Timestamp overlay on each sprite
- Adjustable grid column count via toolbar slider or fixed setting
- Compact view (removes gaps between sprites)
- Auto-scroll to the current sprite during playback
- Touch support: long-press a sprite to show the tooltip; tap to seek
- All display preferences saved per-browser (localStorage), separately from plugin settings

## Installation

### Via Stash Plugin Manager (recommended)

Add this repository to **Stash → Settings → Plugins → Available Plugins** source list, then install **Sprite Tab** from the list.

### Manual

Download `SpriteTab.yml`, `core.js`, and `sprites.js` into a `SpriteTab` folder inside your Stash plugins directory, then reload Stash plugins.

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
| Default State | String | `remember` | When to open the Sprites tab on scene load. One of `remember` (default), `always_on`, `always_off` |

## Toolbar

The toolbar appears at the top of the Sprites tab.

- **Columns slider** — adjusts the grid width. Only shown when **Grid Columns** is not fixed in plugin settings.

## Touch / Mobile

- **Tap** a sprite to seek the video to that timestamp.
- **Long-press** a sprite to show the magnified tooltip; drag to other sprites to preview them.
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
| `core.js` | Pure utility functions extracted for testability (time formatting, settings, tooltip positioning, grid math). Loaded before `sprites.js` and exposed at `window.SpriteTabCore` |
| `SpriteTab.yml` | Plugin manifest and settings schema |
| `__tests__/` | Jest test suite (unit + integration) |
