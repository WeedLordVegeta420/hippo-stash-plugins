/**
 * Tests for GalleryMode core utility functions
 */

const {
    STORAGE_KEY,
    PLUGIN_ID,
    DEFAULT_GALLERY_PREFETCH_STEP_SECONDS,
    GALLERY_TIME_EPSILON,
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
} = require('../src/core');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
    it('STORAGE_KEY is expected value', () => {
        expect(STORAGE_KEY).toBe('stash_plugin_gallery_settings');
    });

    it('PLUGIN_ID is expected value', () => {
        expect(PLUGIN_ID).toBe('GalleryMode');
    });

    it('DEFAULT_GALLERY_PREFETCH_STEP_SECONDS is 5', () => {
        expect(DEFAULT_GALLERY_PREFETCH_STEP_SECONDS).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// isSameGalleryTime
// ---------------------------------------------------------------------------

describe('isSameGalleryTime', () => {
    it('returns true for identical values', () => {
        expect(isSameGalleryTime(30, 30)).toBe(true);
    });

    it('returns true when difference is within epsilon', () => {
        expect(isSameGalleryTime(30, 30.04)).toBe(true);
        expect(isSameGalleryTime(30, 29.96)).toBe(true);
    });

    it('returns false when difference exceeds epsilon', () => {
        expect(isSameGalleryTime(30, 30.06)).toBe(false);
        expect(isSameGalleryTime(30, 29.94)).toBe(false);
    });

    it('returns false for null inputs', () => {
        expect(isSameGalleryTime(null, 30)).toBe(false);
        expect(isSameGalleryTime(30, null)).toBe(false);
        expect(isSameGalleryTime(null, null)).toBe(false);
    });

    it('respects custom epsilon', () => {
        expect(isSameGalleryTime(30, 30.1, 0.2)).toBe(true);
        expect(isSameGalleryTime(30, 30.3, 0.2)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// normalizeGalleryTime
// ---------------------------------------------------------------------------

describe('normalizeGalleryTime', () => {
    it('returns the value unchanged for positive finite numbers', () => {
        expect(normalizeGalleryTime(30.5)).toBe(30.5);
        expect(normalizeGalleryTime(0)).toBe(0);
    });

    it('clamps negative values to 0', () => {
        expect(normalizeGalleryTime(-5)).toBe(0);
    });

    it('returns 0 for non-finite values', () => {
        expect(normalizeGalleryTime(NaN)).toBe(0);
        expect(normalizeGalleryTime(Infinity)).toBe(0);
        expect(normalizeGalleryTime(-Infinity)).toBe(0);
        expect(normalizeGalleryTime(null)).toBe(0);
        expect(normalizeGalleryTime(undefined)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// clampGalleryTime
// ---------------------------------------------------------------------------

describe('clampGalleryTime', () => {
    it('clamps to duration when time exceeds it', () => {
        expect(clampGalleryTime(120, 100)).toBe(100);
    });

    it('clamps negative to 0', () => {
        expect(clampGalleryTime(-5, 100)).toBe(0);
    });

    it('returns time unchanged when within range', () => {
        expect(clampGalleryTime(50, 100)).toBe(50);
    });

    it('returns time unchanged when duration is 0', () => {
        expect(clampGalleryTime(50, 0)).toBe(50);
    });
});

// ---------------------------------------------------------------------------
// normalizeGalleryCacheTime
// ---------------------------------------------------------------------------

describe('normalizeGalleryCacheTime', () => {
    it('rounds to 3 decimal places', () => {
        expect(normalizeGalleryCacheTime(30.1234)).toBeCloseTo(30.123, 3);
        expect(normalizeGalleryCacheTime(30.9999)).toBeCloseTo(31.0, 3);
    });

    it('handles zero', () => {
        expect(normalizeGalleryCacheTime(0)).toBe(0);
    });

    it('clamps negatives to 0', () => {
        expect(normalizeGalleryCacheTime(-5)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// getGalleryCacheKey
// ---------------------------------------------------------------------------

describe('getGalleryCacheKey', () => {
    it('returns null when sceneId is falsy', () => {
        expect(getGalleryCacheKey(30, null, 1)).toBeNull();
        expect(getGalleryCacheKey(30, '', 1)).toBeNull();
    });

    it('builds a valid key string', () => {
        const key = getGalleryCacheKey(30.5, '123', 1);
        expect(key).toBe('123::1::30.500');
    });

    it('includes scale in key', () => {
        const keyFull = getGalleryCacheKey(30, '123', 1);
        const keyHalf = getGalleryCacheKey(30, '123', 0.5);
        expect(keyFull).not.toBe(keyHalf);
    });

    it('normalizes time in key', () => {
        const key1 = getGalleryCacheKey(30.0, '123', 1);
        const key2 = getGalleryCacheKey(30.0001, '123', 1);
        expect(key1).toBe(key2);
    });
});

// ---------------------------------------------------------------------------
// parseGalleryPrefetchOffsets
// ---------------------------------------------------------------------------

describe('parseGalleryPrefetchOffsets', () => {
    it('parses comma-separated string', () => {
        expect(parseGalleryPrefetchOffsets('0.5, 1, 5')).toEqual([0.5, 1, 5]);
    });

    it('parses space-separated string', () => {
        expect(parseGalleryPrefetchOffsets('1 5 10')).toEqual([1, 5, 10]);
    });

    it('returns default for empty string', () => {
        expect(parseGalleryPrefetchOffsets('')).toEqual([DEFAULT_GALLERY_PREFETCH_STEP_SECONDS]);
    });

    it('deduplicates and sorts values', () => {
        expect(parseGalleryPrefetchOffsets('5, 1, 5, 1')).toEqual([1, 5]);
    });

    it('filters out non-positive values', () => {
        expect(parseGalleryPrefetchOffsets('-1, 0, 5')).toEqual([5]);
    });

    it('accepts an array', () => {
        expect(parseGalleryPrefetchOffsets([1, 5, 10])).toEqual([1, 5, 10]);
    });

    it('returns default for empty array', () => {
        expect(parseGalleryPrefetchOffsets([])).toEqual([DEFAULT_GALLERY_PREFETCH_STEP_SECONDS]);
    });

    it('respects custom default step', () => {
        expect(parseGalleryPrefetchOffsets('', 3)).toEqual([3]);
    });
});

// ---------------------------------------------------------------------------
// getGalleryPrefetchPriorityIndex
// ---------------------------------------------------------------------------

describe('getGalleryPrefetchPriorityIndex', () => {
    const offsets = [0.5, 1, 5];

    it('returns 0 for the smallest offset', () => {
        expect(getGalleryPrefetchPriorityIndex(0.5, offsets)).toBe(0);
        expect(getGalleryPrefetchPriorityIndex(-0.5, offsets)).toBe(0);
    });

    it('returns correct index for middle offset', () => {
        expect(getGalleryPrefetchPriorityIndex(1, offsets)).toBe(1);
    });

    it('returns offsets.length when delta does not match any offset', () => {
        expect(getGalleryPrefetchPriorityIndex(3, offsets)).toBe(3);
        expect(getGalleryPrefetchPriorityIndex(0, offsets)).toBe(3);
    });

    it('uses epsilon for matching', () => {
        expect(getGalleryPrefetchPriorityIndex(0.501, offsets)).toBe(0);
        expect(getGalleryPrefetchPriorityIndex(0.6, offsets)).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// buildGalleryPrefetchQueue
// ---------------------------------------------------------------------------

describe('buildGalleryPrefetchQueue', () => {
    const sceneId = '42';
    const scale = 1;
    const prefetchOffsets = [1, 5];
    const windowSeconds = 10;
    const duration = 120;
    const noCached = () => false;

    it('returns empty array when sceneId is falsy', () => {
        expect(buildGalleryPrefetchQueue(30, null, scale, prefetchOffsets, windowSeconds, duration, noCached)).toEqual([]);
    });

    it('returns empty array when window is 0', () => {
        expect(buildGalleryPrefetchQueue(30, sceneId, scale, prefetchOffsets, 0, duration, noCached)).toEqual([]);
    });

    it('returns empty array when offsets are empty', () => {
        expect(buildGalleryPrefetchQueue(30, sceneId, scale, [], windowSeconds, duration, noCached)).toEqual([]);
    });

    it('produces a non-empty list for valid inputs', () => {
        const queue = buildGalleryPrefetchQueue(60, sceneId, scale, prefetchOffsets, windowSeconds, duration, noCached);
        expect(queue.length).toBeGreaterThan(0);
    });

    it('skips already-cached times', () => {
        const hasCached = (time) => isSameGalleryTime(time, 61);
        const queue = buildGalleryPrefetchQueue(60, sceneId, scale, [1], windowSeconds, duration, hasCached);
        expect(queue).not.toContain(expect.closeTo(61, 1));
    });

    it('does not include the center time itself', () => {
        const queue = buildGalleryPrefetchQueue(60, sceneId, scale, prefetchOffsets, windowSeconds, duration, noCached);
        expect(queue.every((t) => !isSameGalleryTime(t, 60))).toBe(true);
    });

    it('clamps times to duration', () => {
        const queue = buildGalleryPrefetchQueue(118, sceneId, scale, [5], 20, 120, noCached);
        expect(queue.every((t) => t <= 120)).toBe(true);
    });

    it('prioritises control offsets before window offsets', () => {
        const queue = buildGalleryPrefetchQueue(60, sceneId, scale, prefetchOffsets, windowSeconds, duration, noCached);
        // Forward control offsets (0.5, 1, 5, 30) should come first
        const firstTime = queue[0];
        const controlOffsets = [...GALLERY_FORWARD_CONTROL_PREFETCH_OFFSETS, ...GALLERY_BACKWARD_CONTROL_PREFETCH_OFFSETS];
        const delta = Math.abs(firstTime - 60);
        expect(controlOffsets.some((o) => isSameGalleryTime(o, delta))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// getGalleryCacheEntryLimit
// ---------------------------------------------------------------------------

describe('getGalleryCacheEntryLimit', () => {
    it('returns at least MIN_GALLERY_CACHE_ENTRIES', () => {
        expect(getGalleryCacheEntryLimit([], 0)).toBeGreaterThanOrEqual(24);
    });

    it('increases with larger windows', () => {
        const small = getGalleryCacheEntryLimit([1, 5], 10);
        const large = getGalleryCacheEntryLimit([1, 5], 60);
        expect(large).toBeGreaterThan(small);
    });

    it('combines prefetch offsets with built-in control offsets', () => {
        const withExtra = getGalleryCacheEntryLimit([0.1], 10);
        const withoutExtra = getGalleryCacheEntryLimit([], 10);
        // Adding a very small offset (0.1) yields many more entries per window
        expect(withExtra).toBeGreaterThan(withoutExtra);
    });
});

// ---------------------------------------------------------------------------
// parseScrubberPercentTransform
// ---------------------------------------------------------------------------

describe('parseScrubberPercentTransform', () => {
    it('parses positive percent transform', () => {
        expect(parseScrubberPercentTransform('translateX(42.5%)')).toBeCloseTo(42.5);
    });

    it('parses negative percent transform', () => {
        expect(parseScrubberPercentTransform('translateX(-10%)')).toBeCloseTo(-10);
    });

    it('returns null for pixel transform', () => {
        expect(parseScrubberPercentTransform('translateX(42px)')).toBeNull();
    });

    it('returns null for empty/null input', () => {
        expect(parseScrubberPercentTransform('')).toBeNull();
        expect(parseScrubberPercentTransform(null)).toBeNull();
        expect(parseScrubberPercentTransform(undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// parseScrubberPixelTransform
// ---------------------------------------------------------------------------

describe('parseScrubberPixelTransform', () => {
    it('parses positive pixel transform', () => {
        expect(parseScrubberPixelTransform('translateX(100px)')).toBeCloseTo(100);
    });

    it('parses negative pixel transform', () => {
        expect(parseScrubberPixelTransform('translateX(-50px)')).toBeCloseTo(-50);
    });

    it('returns null for percent transform', () => {
        expect(parseScrubberPixelTransform('translateX(42%)')).toBeNull();
    });

    it('returns null for empty/null input', () => {
        expect(parseScrubberPixelTransform('')).toBeNull();
        expect(parseScrubberPixelTransform(null)).toBeNull();
        expect(parseScrubberPixelTransform(undefined)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// formatGalleryDebugNumber
// ---------------------------------------------------------------------------

describe('formatGalleryDebugNumber', () => {
    it('formats to 3 decimal places', () => {
        expect(formatGalleryDebugNumber(30.5)).toBe('30.500');
        expect(formatGalleryDebugNumber(0)).toBe('0.000');
    });

    it('rounds correctly', () => {
        expect(formatGalleryDebugNumber(30.1239)).toBe('30.124');
    });
});

// ---------------------------------------------------------------------------
// formatGalleryDebugOffsets
// ---------------------------------------------------------------------------

describe('formatGalleryDebugOffsets', () => {
    it('formats array as comma-separated string', () => {
        expect(formatGalleryDebugOffsets([0.5, 1, 5])).toBe('0.5, 1, 5');
    });

    it('returns empty string for empty array', () => {
        expect(formatGalleryDebugOffsets([])).toBe('');
    });
});

// ---------------------------------------------------------------------------
// extractSceneId
// ---------------------------------------------------------------------------

describe('extractSceneId', () => {
    it('extracts scene ID from valid path', () => {
        expect(extractSceneId('/scenes/123')).toBe('123');
        expect(extractSceneId('/scenes/456789')).toBe('456789');
    });

    it('returns null for non-scene paths', () => {
        expect(extractSceneId('/')).toBeNull();
        expect(extractSceneId('/performers/123')).toBeNull();
    });

    it('handles paths with additional segments', () => {
        expect(extractSceneId('/scenes/123/edit')).toBe('123');
    });

    it('returns null for invalid scene paths', () => {
        expect(extractSceneId('/scenes/')).toBeNull();
        expect(extractSceneId('/scenes/abc')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// parseGalleryPluginSettings
// ---------------------------------------------------------------------------

describe('parseGalleryPluginSettings', () => {
    it('returns defaults for null data', () => {
        const result = parseGalleryPluginSettings(null, 'GalleryMode', { enabled: true });
        expect(result.enabled).toBe(true);
    });

    it('returns defaults when plugin not found', () => {
        const data = { configuration: { plugins: {} } };
        const result = parseGalleryPluginSettings(data, 'GalleryMode', { enabled: true });
        expect(result.enabled).toBe(true);
    });

    it('merges plugin settings over defaults', () => {
        const data = {
            configuration: {
                plugins: {
                    GalleryMode: { enabled: false, frame_server_port: 9999 }
                }
            }
        };
        const result = parseGalleryPluginSettings(data, 'GalleryMode', { enabled: true, frame_server_port: 9876 });
        expect(result.enabled).toBe(false);
        expect(result.frame_server_port).toBe(9999);
    });

    it('keeps default for missing individual settings', () => {
        const data = {
            configuration: {
                plugins: {
                    GalleryMode: { enabled: false }
                }
            }
        };
        const result = parseGalleryPluginSettings(data, 'GalleryMode', { enabled: true, frame_server_port: 9876 });
        expect(result.enabled).toBe(false);
        expect(result.frame_server_port).toBe(9876);
    });
});
