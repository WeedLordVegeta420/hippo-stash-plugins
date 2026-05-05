/**
 * Gallery session reducer.
 *
 * Pure state transition logic. Takes (state, event) and returns
 * { state, effects } where effects is an array of command objects.
 *
 * No side effects, no DOM, no timers, no network.
 */

const { cloneState, GALLERY_MIN_ZOOM_SCALE } = require('./gallerySessionState');
const {
    GALLERY_TIME_EPSILON,
    isSameGalleryTime: isSameTime,
    normalizeGalleryTime: normalizeTime,
    clampGalleryTime: clampTime
} = require('./core');
const Events = require('./gallerySessionEvents');
const Effects = require('./gallerySessionEffects');

function hasPendingExplicitTarget(nav, env) {
    return env.lowBandwidth && nav.pendingExplicitTarget !== null;
}

function shouldHoldPendingTarget(time, nav, env) {
    if (!hasPendingExplicitTarget(nav, env)) return false;
    const t = normalizeTime(time);
    if (isSameTime(t, nav.pendingExplicitTarget)) return false;
    if (nav.pendingExplicitSource === null) return true;
    const minT = Math.min(nav.pendingExplicitSource, nav.pendingExplicitTarget) - GALLERY_TIME_EPSILON;
    const maxT = Math.max(nav.pendingExplicitSource, nav.pendingExplicitTarget) + GALLERY_TIME_EPSILON;
    return t >= minT && t <= maxT;
}

/**
 * Apply low-bandwidth pending-target logic to next state and effects.
 * Shared by OPEN_GALLERY, JUMP_BY, and SEEK_TO.
 */
function applyLowBandwidthTarget(next, effects, time, controllerTime) {
    if (next.environment.lowBandwidth && !isSameTime(controllerTime, time)) {
        next.navigation.ignoredPlayerTime = time;
        next.navigation.pendingExplicitSource = controllerTime;
        next.navigation.pendingExplicitTarget = time;
        effects.push(Effects.setControllerTime(time));
    } else if (next.environment.lowBandwidth) {
        next.navigation.ignoredPlayerTime = null;
        next.navigation.pendingExplicitTarget = null;
        next.navigation.pendingExplicitSource = null;
    } else {
        next.navigation.pendingExplicitTarget = null;
        next.navigation.pendingExplicitSource = null;
    }
}

function reduce(state, event) {
    switch (event.type) {

    case Events.OPEN_GALLERY: {
        const next = cloneState(state);
        const effects = [];

        next.session.open = true;
        next.session.sceneId = event.sceneId;
        next.session.mediaMode = event.mediaMode || 'image';

        const time = normalizeTime(event.time);
        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.navigation.requestedTime = time;
        next.render.imageSrc = '';
        next.render.imageScale = null;
        next.render.hasVisibleFrame = next.session.mediaMode === 'video' ? state.render.hasVisibleFrame : false;
        next.render.fullResolutionPending = false;
        next.render.errorMessage = null;

        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.bindPlayerListeners());
        effects.push(Effects.pauseController());
        applyLowBandwidthTarget(next, effects, time, state.navigation.controllerTime);

        effects.push(Effects.resetImageTransform());
        effects.push(Effects.render());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.requestFrame(next.requests.activeRequestId, time, next.environment.cacheScale));

        return { state: next, effects };
    }

    case Events.EXIT_GALLERY: {
        const next = cloneState(state);
        const effects = [];

        next.session.open = false;
        next.session.fullscreen = false;
        next.session.pseudoFullscreen = false;
        next.session.controlsVisible = false;
        next.navigation.requestedTime = null;
        next.navigation.ignoredPlayerTime = null;
        next.navigation.pendingExplicitTarget = null;
        next.navigation.pendingExplicitSource = null;
        next.navigation.controlledSeekTarget = null;
        next.render.imageSrc = '';
        next.render.imageScale = null;
        next.render.hasVisibleFrame = false;
        next.render.fullResolutionPending = false;
        next.render.errorMessage = null;

        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.cancelPrefetch());
        effects.push(Effects.closeSocket());
        effects.push(Effects.unbindPlayerListeners());
        effects.push(Effects.syncScrollLock(false));
        effects.push(Effects.resetImageTransform());
        effects.push(Effects.destroyOverlay());

        return { state: next, effects };
    }

    case Events.JUMP_BY: {
        if (!state.session.open) return { state, effects: [] };

        const baseTime = state.navigation.requestedTime ?? state.navigation.controllerTime ?? 0;
        const time = clampTime(normalizeTime(baseTime + event.delta), state.environment.duration);

        if (isSameTime(time, state.navigation.requestedTime)) {
            return { state, effects: [] };
        }

        const next = cloneState(state);
        const effects = [];
        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.navigation.requestedTime = time;
        next.render.imageSrc = '';
        next.render.imageScale = null;
        next.render.hasVisibleFrame = next.session.mediaMode === 'video' ? state.render.hasVisibleFrame : false;
        next.render.fullResolutionPending = false;
        next.render.errorMessage = null;

        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.pauseController());
        applyLowBandwidthTarget(next, effects, time, state.navigation.controllerTime);

        effects.push(Effects.resetImageTransform());
        effects.push(Effects.render());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.requestFrame(next.requests.activeRequestId, time, next.environment.cacheScale));

        return { state: next, effects };
    }

    case Events.SEEK_TO: {
        if (!state.session.open) return { state, effects: [] };

        const time = normalizeTime(event.time);

        if (isSameTime(time, state.navigation.requestedTime)) {
            return { state, effects: [] };
        }

        const next = cloneState(state);
        const effects = [];
        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.navigation.requestedTime = time;
        next.render.imageSrc = '';
        next.render.imageScale = null;
        next.render.hasVisibleFrame = next.session.mediaMode === 'video' ? state.render.hasVisibleFrame : false;
        next.render.fullResolutionPending = false;
        next.render.errorMessage = null;

        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.pauseController());
        applyLowBandwidthTarget(next, effects, time, state.navigation.controllerTime);

        effects.push(Effects.resetImageTransform());
        effects.push(Effects.render());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.requestFrame(next.requests.activeRequestId, time, next.environment.cacheScale));

        return { state: next, effects };
    }

    case Events.SCRUB_INPUT: {
        if (!state.session.open) return { state, effects: [] };

        const time = normalizeTime(event.time);
        if (isSameTime(time, state.navigation.requestedTime)) {
            return { state, effects: [] };
        }

        // External scrub outside pending target range preempts jump ownership
        const next = cloneState(state);
        if (hasPendingExplicitTarget(next.navigation, next.environment)) {
            if (!shouldHoldPendingTarget(time, next.navigation, next.environment)) {
                next.navigation.pendingExplicitTarget = null;
                next.navigation.pendingExplicitSource = null;
            }
        }

        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.navigation.requestedTime = time;
        next.render.imageSrc = '';
        next.render.imageScale = null;
        next.render.hasVisibleFrame = next.session.mediaMode === 'video' ? state.render.hasVisibleFrame : false;
        next.render.fullResolutionPending = false;
        next.render.errorMessage = null;

        const effects = [];
        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.resetImageTransform());
        effects.push(Effects.render());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.requestFrame(next.requests.activeRequestId, time, next.environment.cacheScale));

        return { state: next, effects };
    }

    case Events.CONTROLLER_TIME_UPDATE: {
        if (!state.session.open) return { state, effects: [] };

        const next = cloneState(state);
        const effects = [];
        const time = normalizeTime(event.time);
        next.navigation.controllerTime = time;

        // HB mode: ignore updates at the controlled seek target
        if (!next.environment.lowBandwidth
            && next.navigation.controlledSeekTarget !== null
            && isSameTime(time, next.navigation.controlledSeekTarget)) {
            return { state: next, effects: [] };
        }

        if (shouldHoldPendingTarget(time, next.navigation, next.environment)) {
            return { state: next, effects: [] };
        }

        if (isSameTime(time, next.navigation.ignoredPlayerTime)) {
            next.navigation.ignoredPlayerTime = null;
            next.navigation.requestedTime = time;
            return { state: next, effects: [] };
        }

        if (isSameTime(time, state.navigation.requestedTime)) {
            return { state: next, effects: [] };
        }

        // Actual time change: show frame
        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.navigation.requestedTime = time;

        effects.push(Effects.pauseController());
        effects.push(Effects.requestFrame(next.requests.activeRequestId, time, next.environment.cacheScale));
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.CONTROLLER_SEEKING: {
        if (!state.session.open) return { state, effects: [] };

        const time = normalizeTime(event.time);
        const next = cloneState(state);
        next.navigation.controllerTime = time;

        // HB mode: don't interrupt controlled seeks
        if (!next.environment.lowBandwidth && next.navigation.controlledSeekTarget !== null) {
            return { state: next, effects: [] };
        }

        if (shouldHoldPendingTarget(time, next.navigation, next.environment)) {
            return { state: next, effects: [] };
        }
        if (isSameTime(time, next.navigation.ignoredPlayerTime)) {
            return { state: next, effects: [] };
        }

        const effects = [];
        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.cancelPrefetch());

        next.render.loadingVisible = true;
        next.render.loadingMessage = 'Loading\u2026';
        next.navigation.requestedTime = time;
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.CONTROLLER_SEEKED: {
        if (!state.session.open) return { state, effects: [] };

        const time = normalizeTime(event.time);
        const next = cloneState(state);
        next.navigation.controllerTime = time;

        if (shouldHoldPendingTarget(time, next.navigation, next.environment)) {
            return { state: next, effects: [] };
        }
        if (isSameTime(time, next.navigation.ignoredPlayerTime)) {
            next.navigation.ignoredPlayerTime = null;
            next.navigation.requestedTime = time;
            return { state: next, effects: [] };
        }
        if (isSameTime(time, state.navigation.requestedTime)) {
            return { state: next, effects: [] };
        }

        const effects = [];
        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.navigation.requestedTime = time;

        effects.push(Effects.pauseController());
        effects.push(Effects.requestFrame(next.requests.activeRequestId, time, next.environment.cacheScale));
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.FRAME_LOADED: {
        if (!state.session.open) return { state, effects: [] };
        if (event.requestId !== state.requests.activeRequestId) return { state, effects: [] };

        const next = cloneState(state);
        const effects = [];

        next.render.imageSrc = event.src;
        next.render.imageScale = event.scale;
        next.render.hasVisibleFrame = true;
        next.render.loadingVisible = false;
        next.render.errorMessage = null;
        next.navigation.displayedTime = event.time;

        effects.push(Effects.storeCachedFrame(event.time, event.src, next.session.sceneId, event.scale));
        effects.push(Effects.clearPendingExplicitTarget(event.time));
        effects.push(Effects.syncRenderSurface());
        effects.push(Effects.render());
        effects.push(Effects.schedulePrefetch(event.time, true));

        return { state: next, effects };
    }

    case Events.FRAME_ERROR: {
        if (!state.session.open) return { state, effects: [] };
        if (event.requestId !== state.requests.activeRequestId) return { state, effects: [] };

        const next = cloneState(state);
        const effects = [];

        next.render.imageSrc = '';
        next.render.imageScale = null;
        next.render.hasVisibleFrame = false;
        next.render.errorMessage = event.message || 'Frame unavailable';
        next.render.loadingVisible = true;
        next.render.loadingMessage = event.message || 'Frame unavailable';

        effects.push(Effects.clearPendingExplicitTarget(state.navigation.requestedTime));
        effects.push(Effects.render());
        effects.push(Effects.schedulePrefetch(state.navigation.requestedTime, true));

        return { state: next, effects };
    }

    case Events.VIDEO_FRAME_READY: {
        if (!state.session.open) return { state, effects: [] };
        if (event.requestId !== state.requests.activeRequestId) return { state, effects: [] };

        const next = cloneState(state);
        const effects = [];

        next.render.hasVisibleFrame = true;
        next.render.loadingVisible = false;
        next.render.errorMessage = null;
        next.navigation.displayedTime = event.time;

        effects.push(Effects.syncRenderSurface());
        effects.push(Effects.applyImageTransform());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.notifyControllerTimeUpdate());
        effects.push(Effects.clearPendingExplicitTarget(event.time));
        effects.push(Effects.render());
        effects.push(Effects.schedulePrefetch(event.time, true));

        return { state: next, effects };
    }

    case Events.REQUEST_FULL_RESOLUTION: {
        if (!state.session.open) return { state, effects: [] };
        if (state.navigation.requestedTime === null) return { state, effects: [] };
        if (state.render.fullResolutionPending) return { state, effects: [] };
        if (state.render.imageScale !== null && state.render.imageScale >= 1 && state.render.imageSrc) {
            return { state, effects: [] };
        }

        const next = cloneState(state);
        const effects = [];

        next.requests.foregroundSeq += 1;
        next.requests.activeRequestId = next.requests.foregroundSeq;
        next.render.fullResolutionPending = true;

        effects.push(Effects.cancelForegroundRequest());
        effects.push(Effects.requestFullResolutionFrame(next.requests.activeRequestId, normalizeTime(state.navigation.requestedTime)));
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.FULL_RESOLUTION_LOADED: {
        if (!state.session.open) return { state, effects: [] };
        if (event.requestId !== state.requests.activeRequestId) return { state, effects: [] };

        const next = cloneState(state);
        const effects = [];

        next.render.imageSrc = event.src;
        next.render.imageScale = 1;
        next.render.hasVisibleFrame = true;
        next.render.fullResolutionPending = false;
        next.render.loadingVisible = false;
        next.render.errorMessage = null;

        effects.push(Effects.storeCachedFrame(event.time, event.src, next.session.sceneId, 1));
        effects.push(Effects.syncRenderSurface());
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.FULL_RESOLUTION_ERROR: {
        if (!state.session.open) return { state, effects: [] };
        if (event.requestId !== state.requests.activeRequestId) return { state, effects: [] };

        const next = cloneState(state);
        const effects = [];

        next.render.fullResolutionPending = false;
        if (!state.render.imageSrc) {
            next.render.loadingMessage = event.message || 'Frame unavailable';
        } else {
            next.render.loadingVisible = false;
        }

        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.FULLSCREEN_ENTERED: {
        const next = cloneState(state);
        next.session.fullscreen = true;

        const effects = [];
        effects.push(Effects.syncScrollLock(true));
        effects.push(Effects.syncRenderSurface());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.FULLSCREEN_EXITED: {
        const next = cloneState(state);
        next.session.fullscreen = false;
        next.session.pseudoFullscreen = false;

        const effects = [];
        effects.push(Effects.syncScrollLock(false));
        effects.push(Effects.syncRenderSurface());
        effects.push(Effects.refreshOverlayLayout());
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.CONTROLS_TOGGLE: {
        const next = cloneState(state);
        next.session.controlsVisible = event.visible !== undefined ? event.visible : !state.session.controlsVisible;

        return { state: next, effects: [Effects.render()] };
    }

    case Events.GESTURE_STARTED: {
        if (!state.session.open) return { state, effects: [] };

        const next = cloneState(state);
        const interaction = next.interaction;

        if (event.gestureType === 'pinch') {
            interaction.activeGesture = 'pinch';
            interaction.gestureTouchId = null;
            interaction.gestureStartDistance = event.distance || 0;
            interaction.gestureStartScale = state.interaction.zoomScale;
            interaction.gestureAnchorContentX = event.anchorContentX || 0;
            interaction.gestureAnchorContentY = event.anchorContentY || 0;
            interaction.suppressTapUntil = Date.now() + 400;
        } else if (event.gestureType === 'pending_pan') {
            interaction.activeGesture = 'pending_pan';
            interaction.gestureTouchId = event.touchId ?? null;
            interaction.gestureStartX = event.clientX || 0;
            interaction.gestureStartY = event.clientY || 0;
            interaction.gestureStartPanX = state.interaction.panX;
            interaction.gestureStartPanY = state.interaction.panY;
        } else if (event.gestureType === 'pan') {
            interaction.activeGesture = 'pan';
            interaction.gestureTouchId = event.touchId ?? null;
            interaction.gestureStartX = event.clientX || 0;
            interaction.gestureStartY = event.clientY || 0;
            interaction.gestureStartPanX = state.interaction.panX;
            interaction.gestureStartPanY = state.interaction.panY;
        }

        return { state: next, effects: [Effects.applyImageTransform()] };
    }

    case Events.GESTURE_UPDATED: {
        if (!state.session.open) return { state, effects: [] };

        const next = cloneState(state);
        const interaction = next.interaction;

        if (event.gestureType === 'pan') {
            if (interaction.activeGesture === 'pending_pan') {
                interaction.activeGesture = 'pan';
                interaction.suppressTapUntil = Date.now() + 400;
            }
            interaction.panX = event.panX ?? interaction.panX;
            interaction.panY = event.panY ?? interaction.panY;
        } else if (event.gestureType === 'pinch') {
            interaction.zoomScale = event.zoomScale ?? interaction.zoomScale;
            interaction.panX = event.panX ?? interaction.panX;
            interaction.panY = event.panY ?? interaction.panY;
        }

        return { state: next, effects: [Effects.applyImageTransform()] };
    }

    case Events.GESTURE_ENDED: {
        if (!state.session.open) return { state, effects: [] };

        const next = cloneState(state);

        if (next.interaction.activeGesture === 'pending_pan') {
            next.interaction.activeGesture = null;
            next.interaction.gestureTouchId = null;
        } else if (event.gestureType === 'pinch' && next.interaction.zoomScale > GALLERY_MIN_ZOOM_SCALE) {
            // Transition from pinch to pan if still zoomed
            next.interaction.activeGesture = 'pan';
        } else {
            next.interaction.activeGesture = null;
            next.interaction.gestureTouchId = null;
        }

        return { state: next, effects: [Effects.applyImageTransform()] };
    }

    case Events.LAYOUT_REFRESHED: {
        return { state, effects: [Effects.refreshOverlayLayout()] };
    }

    case Events.SETTINGS_LOADED: {
        const next = cloneState(state);
        const settings = event.pluginSettings;
        next.environment.pluginSettings = { ...next.environment.pluginSettings, ...settings };
        next.environment.lowBandwidth = settings.low_bandwidth_mode === true;
        next.environment.debugEnabled = settings.show_debug_panel === true;

        return { state: next, effects: [] };
    }

    case Events.SCENE_DATA_LOADED: {
        const next = cloneState(state);
        if (event.sceneData) {
            next.session.sceneData = event.sceneData;
            const dur = event.sceneData.duration || event.sceneData.files?.[0]?.duration || 0;
            next.environment.duration = Number.isFinite(dur) && dur > 0 ? dur : 0;
        }

        return { state: next, effects: [] };
    }

    case Events.PREFETCH_BATCH_COMPLETE: {
        if (event.generation !== state.prefetch.generation) {
            return { state, effects: [] };
        }

        const next = cloneState(state);
        const effects = [];

        if (Array.isArray(event.results)) {
            event.results.forEach(({ time, src }) => {
                effects.push(Effects.storeCachedFrame(time, src, next.session.sceneId, next.environment.cacheScale));
            });
        }
        effects.push(Effects.render());

        return { state: next, effects };
    }

    case Events.PREFETCH_CANCELLED: {
        const next = cloneState(state);
        next.prefetch.generation += 1;
        next.prefetch.queue = [];
        next.prefetch.running = false;
        next.prefetch.centerTime = null;
        next.prefetch.contextKey = null;

        return { state: next, effects: [] };
    }

    default:
        return { state, effects: [] };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        reduce,
        hasPendingExplicitTarget,
        shouldHoldPendingTarget,
        applyLowBandwidthTarget
    };
}
