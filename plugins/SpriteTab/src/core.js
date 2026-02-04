/**
 * Core utilities for SpriteTab plugin
 * Extracted for testability
 */

const STORAGE_KEY = 'stash_plugin_sprite_settings';
const PLUGIN_ID = 'SpriteTab';
const DEFAULT_PREVIEW_WIDTH = 300;
const DEFAULT_SPRITE_SIZE = 50;
const SPRITE_WIDTH_GUESS = 160;
const DEFAULTS = { cols: 4, showTime: true, compact: false, autoScroll: true };

/**
 * Format seconds into human-readable time string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "1:23" or "1:02:03")
 */
function formatTime(seconds) {
    if (!seconds) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Get settings from localStorage
 * @param {Storage} storage - Storage interface (defaults to localStorage)
 * @returns {object} Settings object with defaults applied
 */
function getSettings(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    try {
        if (!storage) return { ...DEFAULTS };
        const stored = storage.getItem(STORAGE_KEY);
        return { ...DEFAULTS, ...JSON.parse(stored) };
    } catch (e) {
        return { ...DEFAULTS };
    }
}

/**
 * Save settings to localStorage
 * @param {object} newSettings - New settings to merge
 * @param {Storage} storage - Storage interface (defaults to localStorage)
 * @returns {object} Merged settings object
 */
function saveSettings(newSettings, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    const merged = { ...getSettings(storage), ...newSettings };
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
}

/**
 * Calculate tooltip position with bounds checking
 * @param {number} clientX - Cursor/touch X position
 * @param {number} clientY - Cursor/touch Y position
 * @param {number} tooltipWidth - Width of tooltip
 * @param {number} tooltipHeight - Height of tooltip
 * @param {number} viewportWidth - Viewport width
 * @param {number} viewportHeight - Viewport height
 * @param {number} offset - Offset from cursor (default 20)
 * @param {number} edgePadding - Padding from viewport edges (default 10)
 * @returns {object} Position object with top and left properties
 */
function calculateTooltipPosition(
    clientX,
    clientY,
    tooltipWidth,
    tooltipHeight,
    viewportWidth,
    viewportHeight,
    offset = 20,
    edgePadding = 10
) {
    let left = clientX + offset;
    let top = clientY + offset;

    // If clipping right edge, flip to left of cursor
    if (left + tooltipWidth + edgePadding > viewportWidth) {
        left = clientX - tooltipWidth - offset;
    }
    // If still clipping left edge, align to left edge with padding
    if (left < edgePadding) {
        left = edgePadding;
    }

    // If clipping bottom edge, flip to above cursor
    if (top + tooltipHeight + edgePadding > viewportHeight) {
        top = clientY - tooltipHeight - offset;
    }
    // If still clipping top edge, align to top edge with padding
    if (top < edgePadding) {
        top = edgePadding;
    }

    return { top, left };
}

/**
 * Detect if a touch movement constitutes scrolling
 * @param {object} startPos - Starting position { x, y }
 * @param {object} currentPos - Current position { x, y }
 * @param {number} threshold - Movement threshold in pixels (default 10)
 * @returns {boolean} True if movement exceeds threshold
 */
function isScrollGesture(startPos, currentPos, threshold = 10) {
    if (!startPos || !currentPos) return false;
    const dx = Math.abs(currentPos.x - startPos.x);
    const dy = Math.abs(currentPos.y - startPos.y);
    return dx > threshold || dy > threshold;
}

/**
 * Check if an event is a synthetic mouse event following a touch
 * @param {number} lastTouchTime - Timestamp of last touch event
 * @param {number} currentTime - Current timestamp (default Date.now())
 * @param {number} threshold - Time threshold in ms (default 500)
 * @returns {boolean} True if this is likely a synthetic event
 */
function isSyntheticMouseEvent(lastTouchTime, currentTime = Date.now(), threshold = 500) {
    return currentTime - lastTouchTime < threshold;
}

/**
 * Calculate sprite grid dimensions from image
 * @param {number} imageWidth - Natural width of sprite sheet
 * @param {number} imageHeight - Natural height of sprite sheet
 * @param {number} spriteWidthGuess - Estimated width of single sprite (default 160)
 * @returns {object} Grid info { cols, rows, totalSprites, singleHeight }
 */
function calculateSpriteGrid(imageWidth, imageHeight, spriteWidthGuess = SPRITE_WIDTH_GUESS) {
    const cols = Math.round(imageWidth / spriteWidthGuess);
    const singleHeight = (imageWidth / cols) * (9 / 16);
    const rows = Math.round(imageHeight / singleHeight);
    const totalSprites = cols * rows;
    return { cols, rows, totalSprites, singleHeight };
}

/**
 * Calculate background position for a sprite in the grid
 * @param {number} index - Sprite index (0-based)
 * @param {number} cols - Number of columns in grid
 * @param {number} rows - Number of rows in grid
 * @returns {string} CSS background-position value
 */
function calculateSpritePosition(index, cols, rows) {
    const colIdx = index % cols;
    const rowIdx = Math.floor(index / cols);
    const xPercent = cols > 1 ? (colIdx / (cols - 1)) * 100 : 0;
    const yPercent = rows > 1 ? (rowIdx / (rows - 1)) * 100 : 0;
    return `${xPercent}% ${yPercent}%`;
}

/**
 * Calculate time for a sprite based on its index
 * @param {number} index - Sprite index
 * @param {number} totalSprites - Total number of sprites
 * @param {number} duration - Video duration in seconds
 * @returns {number} Time in seconds
 */
function calculateSpriteTime(index, totalSprites, duration) {
    return (index / totalSprites) * duration;
}

/**
 * Parse plugin settings from GraphQL response
 * @param {object} data - GraphQL response data
 * @param {string} pluginId - Plugin identifier
 * @returns {object} Plugin settings with defaults
 */
function parsePluginSettings(data, pluginId = PLUGIN_ID) {
    const defaults = {
        sprite_size: DEFAULT_SPRITE_SIZE,
        tooltip_enabled: true,
        tooltip_width: DEFAULT_PREVIEW_WIDTH
    };

    const allPlugins = data?.configuration?.plugins;
    if (!allPlugins || !allPlugins[pluginId]) {
        return defaults;
    }

    const settings = allPlugins[pluginId];
    return {
        sprite_size: settings.sprite_size ?? defaults.sprite_size,
        tooltip_enabled: settings.tooltip_enabled ?? defaults.tooltip_enabled,
        tooltip_width: settings.tooltip_width ?? defaults.tooltip_width
    };
}

/**
 * Parse scene data from GraphQL response
 * @param {object} data - GraphQL response data
 * @returns {object|null} Scene data or null if not found
 */
function parseSceneData(data) {
    const scene = data?.findScene;
    if (!scene) return null;

    return {
        id: scene.id,
        duration: scene.files?.[0]?.duration || 0,
        spritePath: scene.paths?.sprite || null
    };
}

/**
 * Extract scene ID from URL path
 * @param {string} pathname - URL pathname
 * @returns {string|null} Scene ID or null if not a scene page
 */
function extractSceneId(pathname) {
    const match = pathname.match(/\/scenes\/(\d+)/);
    return match ? match[1] : null;
}

// Export for testing and module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEY,
        PLUGIN_ID,
        DEFAULT_PREVIEW_WIDTH,
        DEFAULT_SPRITE_SIZE,
        SPRITE_WIDTH_GUESS,
        DEFAULTS,
        formatTime,
        getSettings,
        saveSettings,
        calculateTooltipPosition,
        isScrollGesture,
        isSyntheticMouseEvent,
        calculateSpriteGrid,
        calculateSpritePosition,
        calculateSpriteTime,
        parsePluginSettings,
        parseSceneData,
        extractSceneId
    };
}
