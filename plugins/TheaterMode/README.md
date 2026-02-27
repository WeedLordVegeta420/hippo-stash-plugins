# Theater Mode

A [Stash](https://github.com/stashapp/stash) plugin that adds a theater mode button to the scene video player, similar to YouTube's theater mode.

## What it does

On a scene detail page, a theater mode button appears in the video player control bar, to the left of the playback speed control.

**Normal layout** (≥1200 px viewport): the scene details panel sits in a 450 px sidebar beside the player.

**Theater mode**: the player expands to the full page width and the details panel moves below it, giving the video as much horizontal space as possible without going fullscreen.

The button turns gold when theater mode is active. Clicking it again (or pressing **T**) restores the normal layout.

## Installation

1. In Stash, go to **Settings → Plugins**.
2. Add the URL of this repository's plugin index as a source, then install **Theater Mode** from the list.

   Alternatively, download `theater.js` and `TheaterMode.yml` and place them together in a subfolder of your Stash plugin directory, then click **Reload plugins**.

## Usage

| Action | Result |
|---|---|
| Click the theater mode button in the player controls | Toggle theater mode on/off |
| Press **T** | Toggle theater mode on/off |

The keyboard shortcut is suppressed when focus is on a text input, textarea, select, or any `contentEditable` element.

Theater mode is automatically disabled when you navigate away from the scene page.

## Development

All commands run from `plugins/TheaterMode/`.

```bash
npm install          # Install dev dependencies (Jest)
npm test             # Run the test suite
npm run test:watch   # Run Jest in watch mode
npm run test:coverage  # Run tests with coverage report
```

Sync the plugin to a running Stash instance:

```bash
STASH_PLUGIN_DIR=/path/to/stash/plugins/TheaterMode npm run sync
```

`npm run sync` performs a clean install: it removes the destination directory before copying, so stale files from previous versions don't accumulate.

### File layout

```
plugins/TheaterMode/
├── TheaterMode.yml        # Plugin manifest
├── theater.js             # Main plugin (self-contained IIFE, no bundler needed)
├── src/
│   └── core.js            # Extracted utility functions (testable in Node.js)
└── __tests__/
    ├── setup.js           # Jest setup — resets DOM before each test
    └── theater.test.js    # 43 tests across 8 suites
```

### Architecture

`theater.js` is a self-contained IIFE that runs in the browser. It uses a `MutationObserver` to detect when a scene page is loaded and injects a button into the Video.js control bar.

Two algorithms that contain non-trivial logic are mirrored in `src/core.js` so they can be unit-tested independently of the DOM:

- **`findInsertionPoint(container, selector)`** — walks up from a `querySelector` result to find the direct child of `container` that should be passed to `insertBefore`.
- **`shouldHandleKeydown(key, tagName, isContentEditable)`** — returns `true` only when the keydown event should trigger the theater mode toggle.

Layout changes are applied by toggling the CSS class `stash-theater-mode` on `document.body`. The injected stylesheet overrides Stash's flex layout to make `.scene-player-container` and `.scene-tabs` each take 100 % width and stack vertically (player first, details below).
