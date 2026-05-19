/**
 * Gallery session selectors.
 *
 * Derive UI-facing values from reducer state.
 * No DOM references, no side effects.
 */

const { GALLERY_MIN_ZOOM_SCALE } = require('./gallerySessionState');
const {
    isSameGalleryTime: isSameTime,
    normalizeGalleryTime: normalizeTime,
    clampGalleryTime: clampTime
} = require('./core');

// --- Session selectors ---

function isOpen(state) {
    return state.session.open;
}

function isFullscreen(state) {
    return state.session.fullscreen || state.session.pseudoFullscreen;
}

function isControlsVisible(state) {
    return state.session.controlsVisible;
}

function getMediaMode(state) {
    return state.session.mediaMode;
}

// --- Navigation selectors ---

function getRequestedTime(state) {
    return state.navigation.requestedTime;
}

function getDisplayedTime(state) {
    return state.navigation.displayedTime;
}

// --- Render selectors ---

function hasVisibleFrame(state) {
    return state.render.hasVisibleFrame;
}

function isLoading(state) {
    return state.render.loadingVisible;
}

function getLoadingMessage(state) {
    return state.render.loadingMessage;
}

function getErrorMessage(state) {
    return state.render.errorMessage;
}

function getImageSrc(state) {
    return state.render.imageSrc;
}

function getImageScale(state) {
    return state.render.imageScale;
}

function isFullResolutionPending(state) {
    return state.render.fullResolutionPending;
}

// --- Jump button selectors ---

/**
 * Get the state of each jump button: { delta, disabled, cached }.
 * `hasCachedFrame` is injected so the selector stays pure (no cache access).
 */
function getJumpButtonStates(state, jumpButtons, hasCachedFrame) {
    const time = normalizeTime(state.navigation.requestedTime ?? 0);
    const duration = state.environment.duration;

    return jumpButtons.map(({ delta }) => {
        const targetTime = clampTime(time + delta, duration);
        const disabled = isSameTime(targetTime, time)
            || (duration > 0 && (targetTime < 0 || targetTime > duration));
        const cached = !disabled && hasCachedFrame(targetTime);
        return { delta, disabled, cached };
    });
}

// --- Scrubber selectors ---

function getScrubberState(state, spriteInterval) {
    const duration = state.environment.duration;
    const time = normalizeTime(state.navigation.requestedTime ?? 0);
    return {
        min: 0,
        max: duration,
        value: time,
        step: spriteInterval > 0 ? spriteInterval : 0.1,
        disabled: duration <= 0
    };
}

// --- Fullscreen button selectors ---

function getFullscreenButtonState(state) {
    return {
        active: isFullscreen(state),
        visible: state.session.open
    };
}

// --- Zoom selectors ---

function isZoomed(state) {
    return state.interaction.zoomScale > GALLERY_MIN_ZOOM_SCALE;
}

function getZoomScale(state) {
    return state.interaction.zoomScale;
}

function getPan(state) {
    return { x: state.interaction.panX, y: state.interaction.panY };
}

// --- Full-resolution button selector ---

function canRequestFullResolution(state) {
    if (!state.session.open) return false;
    if (state.render.fullResolutionPending) return false;
    if (state.session.mediaMode !== 'image') return false;
    if (state.render.imageScale !== null && state.render.imageScale >= 1 && state.render.imageSrc) return false;
    return state.navigation.requestedTime !== null;
}

// --- Environment selectors ---

function isLowBandwidth(state) {
    return state.environment.lowBandwidth;
}

function isDebugEnabled(state) {
    return state.environment.debugEnabled;
}

function getDuration(state) {
    return state.environment.duration;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isOpen, isFullscreen, isControlsVisible, getMediaMode,
        getRequestedTime, getDisplayedTime,
        hasVisibleFrame, isLoading, getLoadingMessage,
        getErrorMessage, getImageSrc, getImageScale, isFullResolutionPending,
        getJumpButtonStates, getScrubberState, getFullscreenButtonState,
        isZoomed, getZoomScale, getPan,
        canRequestFullResolution,
        isLowBandwidth, isDebugEnabled, getDuration
    };
}
