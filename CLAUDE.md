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
```

Build the plugin index (from repo root):
```bash
./build_site.sh       # Generates index.yml and plugin zips
```

## Test Coverage Requirements

Tests require 100% coverage for functions, lines, and statements, with 80% branch coverage. The test suite uses jsdom for DOM simulation.

## Architecture

**Core separation pattern**: Testable utility functions live in `src/core.js`, while DOM manipulation and Stash API integration live in the main plugin file (`sprites.js`).

### plugins/SpriteTab/

- **sprites.js** - Main plugin entry point. Handles DOM rendering, event listeners, GraphQL queries to Stash API, and plugin lifecycle. Contains configuration constants and initialization logic with race condition prevention.

- **src/core.js** - Pure utility functions extracted for testability: time formatting, settings management (localStorage), tooltip positioning with viewport bounds checking, sprite grid calculations, and URL/GraphQL parsing helpers.

- **SpriteTab.yml** - Plugin manifest defining metadata and user-configurable settings (sprite_size, tooltip_enabled, tooltip_width).

- **__tests__/** - Jest tests split into unit tests (core.test.js) and integration tests (integration.test.js) for DOM interactions.

## Key Patterns

- Plugin uses localStorage for client-side user preferences
- GraphQL queries communicate with Stash server API
- Touch-aware event handling filters synthetic mouse events
- Tooltip positioning algorithm prevents viewport overflow
