/**
 * Core utilities for GalleryMode plugin
 * Extracted for testability
 */

const STORAGE_KEY = 'stash_plugin_gallery_settings';
const PLUGIN_ID = 'GalleryMode';
const DEFAULT_GALLERY_PREFETCH_STEP_SECONDS = 5;
const DEFAULT_GALLERY_PREFETCH_OFFSETS_SECONDS = '5';
const DEFAULT_GALLERY_PREFETCH_WINDOW_SECONDS = 30;
const GALLERY_TIME_EPSILON = 0.05;
const MIN_GALLERY_CACHE_ENTRIES = 24;
const GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS = [0.5, 1, 5, 30];
const GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS = [0.5, 1, 5];

/**
 * Check if two gallery timestamps are effectively equal (within epsilon).
 * @param {number} a
 * @param {number} b
 * @param {number} epsilon
 * @returns {boolean}
 */
function isSameGalleryTime(a, b, epsilon = GALLERY_TIME_EPSILON) {
    return a !== null && b !== null && Math.abs(a - b) <= epsilon;
}

/**
 * Normalize a gallery time to a non-negative finite number.
 * @param {number} time
 * @returns {number}
 */
function normalizeGalleryTime(time) {
    return Number.isFinite(time) ? Math.max(0, time) : 0;
}

/**
 * Clamp a time value between 0 and duration (if duration > 0).
 * @param {number} time
 * @param {number} duration
 * @returns {number}
 */
function clampGalleryTime(time, duration) {
    const nextTime = normalizeGalleryTime(time);
    return (duration > 0) ? Math.min(nextTime, duration) : nextTime;
}

/**
 * Round a time value to 3 decimal places for use as a cache key.
 * @param {number} time
 * @returns {number}
 */
function normalizeGalleryCacheTime(time) {
    return Math.round(normalizeGalleryTime(time) * 1000) / 1000;
}

/**
 * Build a cache key string for a frame.
 * @param {number} time
 * @param {string|null} sceneId
 * @param {number} scale
 * @returns {string|null}
 */
function getGalleryCacheKey(time, sceneId, scale) {
    if (!sceneId) return null;
    return `${sceneId}::${scale}::${normalizeGalleryCacheTime(time).toFixed(3)}`;
}

/**
 * Parse a comma/space-separated list of prefetch offsets.
 * @param {string|Array} value
 * @param {number} defaultStep
 * @returns {number[]}
 */
function parseGalleryPrefetchOffsets(value, defaultStep = DEFAULT_GALLERY_PREFETCH_STEP_SECONDS) {
    const raw = Array.isArray(value)
        ? value
        : String(value ?? '').split(/[,\s]+/);
    const offsets = raw
        .map((entry) => parseFloat(entry))
        .filter((entry) => Number.isFinite(entry) && entry > 0)
        .map((entry) => Math.round(entry * 1000) / 1000);
    const uniqueOffsets = Array.from(new Set(offsets)).sort((a, b) => a - b);
    return uniqueOffsets.length > 0 ? uniqueOffsets : [defaultStep];
}

/**
 * Return the priority index of a delta within a sorted offset list.
 * Lower index = higher priority.
 * @param {number} delta
 * @param {number[]} offsets
 * @param {number} epsilon
 * @returns {number}
 */
function getGalleryPrefetchPriorityIndex(delta, offsets, epsilon = GALLERY_TIME_EPSILON) {
    const absDelta = Math.abs(delta);
    const matchIndex = offsets.findIndex((offset) => isSameGalleryTime(offset, absDelta, epsilon));
    return matchIndex >= 0 ? matchIndex : offsets.length;
}

/**
 * Build a prioritized list of times to prefetch around a center time.
 * @param {number} centerTime
 * @param {string|null} sceneId
 * @param {number} scale
 * @param {number[]} prefetchOffsets
 * @param {number} windowSeconds
 * @param {number} duration
 * @param {function(number, string, number): boolean} hasCachedFrame
 * @returns {number[]}
 */
function buildGalleryPrefetchQueue(
    centerTime,
    sceneId,
    scale,
    prefetchOffsets,
    windowSeconds,
    duration,
    hasCachedFrame
) {
    if (!sceneId || !(windowSeconds > 0) || prefetchOffsets.length === 0) return [];

    const offsets = Array.from(new Set([
        ...prefetchOffsets,
        ...GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS,
        ...GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS
    ])).sort((a, b) => a - b);

    const candidates = new Map();
    offsets.forEach((offset) => {
        const maxDistance = Math.floor(windowSeconds / offset);
        for (let distance = 1; distance <= maxDistance; distance += 1) {
            [-1, 1].forEach((direction) => {
                const rawTarget = centerTime + (distance * offset * direction);
                const targetTime = clampGalleryTime(rawTarget, duration);
                const key = getGalleryCacheKey(targetTime, sceneId, scale);
                if (!key || candidates.has(key) || hasCachedFrame(targetTime, sceneId, scale) || isSameGalleryTime(targetTime, centerTime)) {
                    return;
                }
                const delta = targetTime - centerTime;
                const isForwardControl = delta > 0
                    && GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS.some((controlOffset) => isSameGalleryTime(controlOffset, delta));
                const isBackwardControl = delta < 0
                    && GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS.some((controlOffset) => isSameGalleryTime(controlOffset, Math.abs(delta)));
                candidates.set(key, {
                    time: targetTime,
                    delta,
                    distance: Math.abs(targetTime - centerTime),
                    phase: isForwardControl ? 0 : (isBackwardControl ? 1 : 2),
                    priorityIndex: isForwardControl
                        ? getGalleryPrefetchPriorityIndex(delta, GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS)
                        : (isBackwardControl
                            ? getGalleryPrefetchPriorityIndex(delta, GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS)
                            : getGalleryPrefetchPriorityIndex(delta, offsets))
                });
            });
        }
    });

    return Array.from(candidates.values())
        .sort((a, b) => {
            if (a.phase !== b.phase) return a.phase - b.phase;
            if (a.phase !== 2) {
                return a.priorityIndex - b.priorityIndex || a.time - b.time;
            }
            const aForward = a.delta > 0 ? 0 : 1;
            const bForward = b.delta > 0 ? 0 : 1;
            return a.distance - b.distance || aForward - bForward || a.priorityIndex - b.priorityIndex || a.time - b.time;
        })
        .map((candidate) => candidate.time);
}

/**
 * Compute the number of cache entries to keep based on prefetch offsets and window.
 * @param {number[]} prefetchOffsets
 * @param {number} windowSeconds
 * @returns {number}
 */
function getGalleryCacheEntryLimit(prefetchOffsets, windowSeconds) {
    const offsets = Array.from(new Set([
        ...prefetchOffsets,
        ...GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS,
        ...GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS
    ]));
    const windowEntries = offsets.reduce((total, offset) => {
        return total + (Math.floor(windowSeconds / offset) * 2);
    }, 0);
    return Math.max(MIN_GALLERY_CACHE_ENTRIES, windowEntries * 3);
}

/**
 * Parse percent-based translateX transform value.
 * @param {string} transform
 * @returns {number|null}
 */
function parseScrubberPercentTransform(transform) {
    const match = (transform || '').match(/translateX\(([-\d.]+)%\)/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Parse pixel-based translateX transform value.
 * @param {string} transform
 * @returns {number|null}
 */
function parseScrubberPixelTransform(transform) {
    const match = (transform || '').match(/translateX\(([-\d.]+)px\)/);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Format a number for display in the debug panel (3 decimal places).
 * @param {number} value
 * @returns {string}
 */
function formatGalleryDebugNumber(value) {
    return normalizeGalleryCacheTime(value).toFixed(3);
}

/**
 * Format an array of offsets for display in the debug panel.
 * @param {number[]} offsets
 * @returns {string}
 */
function formatGalleryDebugOffsets(offsets) {
    return offsets.map((offset) => String(offset)).join(', ');
}

/**
 * Extract scene ID from URL path.
 * @param {string} pathname
 * @returns {string|null}
 */
function extractSceneId(pathname) {
    const match = pathname.match(/\/scenes\/(\d+)/);
    return match ? match[1] : null;
}

/**
 * Parse plugin settings from GraphQL response data.
 * @param {object} data
 * @param {string} pluginId
 * @param {object} defaults
 * @returns {object}
 */
function parseGalleryPluginSettings(data, pluginId = PLUGIN_ID, defaults = {}) {
    const allPlugins = data?.configuration?.plugins;
    if (!allPlugins || !allPlugins[pluginId]) return { ...defaults };
    return { ...defaults, ...allPlugins[pluginId] };
}

// Export for testing and module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEY,
        PLUGIN_ID,
        DEFAULT_GALLERY_PREFETCH_STEP_SECONDS,
        DEFAULT_GALLERY_PREFETCH_OFFSETS_SECONDS,
        DEFAULT_GALLERY_PREFETCH_WINDOW_SECONDS,
        GALLERY_TIME_EPSILON,
        MIN_GALLERY_CACHE_ENTRIES,
        GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS,
        GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS,
        isSameGalleryTime,
        normalizeGalleryTime,
        clampGalleryTime,
        normalizeGalleryCacheTime,
        getGalleryCacheKey,
        parseGalleryPrefetchOffsets,
        getGalleryPrefetchPriorityIndex,
        buildGalleryPrefetchQueue,
        getGalleryCacheEntryLimit,
        parseScrubberPercentTransform,
        parseScrubberPixelTransform,
        formatGalleryDebugNumber,
        formatGalleryDebugOffsets,
        extractSceneId,
        parseGalleryPluginSettings
    };
}
