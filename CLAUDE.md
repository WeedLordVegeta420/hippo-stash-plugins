# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stash plugin repository containing plugins for the Stash media server. Currently contains **SpriteTab** - a plugin that adds a sprite sheet viewer tab to scene pages.

## Commands

All commands run from `plugins/SpriteTab/`:

```bash
npm test              # Run Jest test suite
npm test:watch        # Run Jest in watch mode
npm test:coverage     # Run tests with coverage report
STASH_PLUGIN_DIR=/path/to/stash/plugins/SpriteTab npm run sync  # Sync plugin to Stash
```

Build the plugin index (from repo root):
```bash
./build_site.sh       # Generates index.yml and plugin zips
```

`npm run sync` performs a **clean install**: it removes the destination directory entirely before copying, so stale files from previous versions don't accumulate.

`build_site.sh` uses an **inclusion approach** for zipping: only `.yml`, `.js`, `.css`, `.py`, and `.sh` files at the plugin root level (no recursion, `*.config.js` excluded). Do not change this to `zip -r` without exclusions — Stash scans all `.yml` files in the plugin directory and will log errors for any it cannot parse as a plugin manifest. `node_modules` must never be present in a deployed plugin.

## Test Coverage Requirements

Tests require 100% coverage for functions, lines, and statements, with 80% branch coverage. The test suite uses jsdom for DOM simulation.

## Architecture

**Core separation pattern**: Testable utility functions live in `src/core.js`, while DOM manipulation and Stash API integration live in the main plugin file (`sprites.js`).

### plugins/SpriteTab/

- **sprites.js** - Main plugin entry point. Handles DOM rendering, event listeners, GraphQL queries to Stash API, and plugin lifecycle. Contains configuration constants and initialization logic with race condition prevention.

- **src/core.js** - Pure utility functions extracted for testability: time formatting, settings management (localStorage), tooltip positioning with viewport bounds checking, sprite grid calculations, URL/GraphQL parsing helpers, and mobile layout detection (`isMobileLayout`).

- **SpriteTab.yml** - Plugin manifest defining metadata and user-configurable settings: `tooltip_enabled`, `tooltip_width`, `show_timestamps`, `compact_view`, `auto_scroll`, `grid_columns`.

- **__tests__/** - Jest tests split into unit tests (core.test.js) and integration tests (integration.test.js) for DOM interactions.

## Key Patterns

- Plugin uses localStorage for client-side user preferences
- GraphQL queries communicate with Stash server API
- Touch-aware event handling filters synthetic mouse events
- Tooltip positioning algorithm prevents viewport overflow

## Mobile Touch Handling

Several non-obvious invariants must be preserved:

- **`lastTouchTime` is shared across all sprite cells** (declared once before the cell loop, not inside it). Per-cell timestamps would fail to block synthetic `mouseenter` events fired on neighbouring cells after a finger lift.
- **`isLongPress` gates scroll detection in `ontouchmove`**: when a long press is active the handler returns early, before any scroll-detection code runs. This allows the tooltip to follow the finger across cells. Do not move the scroll-detection block above the `isLongPress` check.
- **Mobile layout is detected via media query** (`window.matchMedia('(max-width: 767px)')`), not by touch capability. Tablets may have their own scroll containers and should behave like desktop. `isMobileLayout()` in `src/core.js` accepts an injectable `matchMediaFn` for testability.
- **Auto-scroll during playback is suppressed on mobile** to avoid hijacking the page scroll. On mobile, tapping a sprite seeks the video and (if auto-scroll is enabled) scrolls the player back into view instead.
