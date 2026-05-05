/**
 * Gallery session effect definitions.
 *
 * Effects are declarative command objects emitted by the reducer.
 * The effect runner executes them imperatively against the runtime context.
 */

// --- Effect type constants ---
const SET_CONTROLLER_TIME = 'SET_CONTROLLER_TIME';
const SET_CONTROLLER_TIME_SILENT = 'SET_CONTROLLER_TIME_SILENT';
const PAUSE_CONTROLLER = 'PAUSE_CONTROLLER';
const PLAY_CONTROLLER = 'PLAY_CONTROLLER';
const REQUEST_FRAME = 'REQUEST_FRAME';
const REQUEST_FULL_RESOLUTION_FRAME = 'REQUEST_FULL_RESOLUTION_FRAME';
const CANCEL_FOREGROUND_REQUEST = 'CANCEL_FOREGROUND_REQUEST';
const OPEN_SOCKET = 'OPEN_SOCKET';
const CLOSE_SOCKET = 'CLOSE_SOCKET';
const SCHEDULE_PREFETCH = 'SCHEDULE_PREFETCH';
const CANCEL_PREFETCH = 'CANCEL_PREFETCH';
const SET_TIMER = 'SET_TIMER';
const CLEAR_TIMER = 'CLEAR_TIMER';
const SET_INTERVAL = 'SET_INTERVAL';
const CLEAR_INTERVAL = 'CLEAR_INTERVAL';
const BIND_PLAYER_LISTENERS = 'BIND_PLAYER_LISTENERS';
const UNBIND_PLAYER_LISTENERS = 'UNBIND_PLAYER_LISTENERS';
const REFRESH_OVERLAY_LAYOUT = 'REFRESH_OVERLAY_LAYOUT';
const EMIT_TIME_UPDATE = 'EMIT_TIME_UPDATE';
const RENDER = 'RENDER';
const CREATE_OVERLAY = 'CREATE_OVERLAY';
const DESTROY_OVERLAY = 'DESTROY_OVERLAY';
const REQUEST_FULLSCREEN = 'REQUEST_FULLSCREEN';
const EXIT_FULLSCREEN = 'EXIT_FULLSCREEN';
const SYNC_SCROLL_LOCK = 'SYNC_SCROLL_LOCK';
const SYNC_RENDER_SURFACE = 'SYNC_RENDER_SURFACE';
const RESET_IMAGE_TRANSFORM = 'RESET_IMAGE_TRANSFORM';
const APPLY_IMAGE_TRANSFORM = 'APPLY_IMAGE_TRANSFORM';
const STORE_CACHED_FRAME = 'STORE_CACHED_FRAME';
const CLEAR_FRAME_CACHE = 'CLEAR_FRAME_CACHE';
const CLEAR_PENDING_EXPLICIT_TARGET = 'CLEAR_PENDING_EXPLICIT_TARGET';
const NOTIFY_CONTROLLER_TIME_UPDATE = 'NOTIFY_CONTROLLER_TIME_UPDATE';

// --- Effect constructors ---

function setControllerTime(time) {
    return { type: SET_CONTROLLER_TIME, time };
}

function setControllerTimeSilent(time) {
    return { type: SET_CONTROLLER_TIME_SILENT, time };
}

function pauseController() {
    return { type: PAUSE_CONTROLLER };
}

function playController() {
    return { type: PLAY_CONTROLLER };
}

function requestFrame(requestId, time, scale) {
    return { type: REQUEST_FRAME, requestId, time, scale };
}

function requestFullResolutionFrame(requestId, time) {
    return { type: REQUEST_FULL_RESOLUTION_FRAME, requestId, time };
}

function cancelForegroundRequest() {
    return { type: CANCEL_FOREGROUND_REQUEST };
}

function openSocket() {
    return { type: OPEN_SOCKET };
}

function closeSocket() {
    return { type: CLOSE_SOCKET };
}

function schedulePrefetch(centerTime, preserveInFlight) {
    return { type: SCHEDULE_PREFETCH, centerTime, preserveInFlight };
}

function cancelPrefetch() {
    return { type: CANCEL_PREFETCH };
}

function setTimer(key, delayMs) {
    return { type: SET_TIMER, key, delayMs };
}

function clearTimer(key) {
    return { type: CLEAR_TIMER, key };
}

function setInterval(key, intervalMs) {
    return { type: SET_INTERVAL, key, intervalMs };
}

function clearInterval(key) {
    return { type: CLEAR_INTERVAL, key };
}

function bindPlayerListeners() {
    return { type: BIND_PLAYER_LISTENERS };
}

function unbindPlayerListeners() {
    return { type: UNBIND_PLAYER_LISTENERS };
}

function refreshOverlayLayout() {
    return { type: REFRESH_OVERLAY_LAYOUT };
}

function emitTimeUpdate() {
    return { type: EMIT_TIME_UPDATE };
}

function render() {
    return { type: RENDER };
}

function createOverlay() {
    return { type: CREATE_OVERLAY };
}

function destroyOverlay() {
    return { type: DESTROY_OVERLAY };
}

function requestFullscreen() {
    return { type: REQUEST_FULLSCREEN };
}

function exitFullscreen() {
    return { type: EXIT_FULLSCREEN };
}

function syncScrollLock(locked) {
    return { type: SYNC_SCROLL_LOCK, locked };
}

function syncRenderSurface() {
    return { type: SYNC_RENDER_SURFACE };
}

function resetImageTransform() {
    return { type: RESET_IMAGE_TRANSFORM };
}

function applyImageTransform() {
    return { type: APPLY_IMAGE_TRANSFORM };
}

function storeCachedFrame(time, src, sceneId, scale) {
    return { type: STORE_CACHED_FRAME, time, src, sceneId, scale };
}

function clearFrameCache(sceneId) {
    return { type: CLEAR_FRAME_CACHE, sceneId };
}

function clearPendingExplicitTarget(time) {
    return { type: CLEAR_PENDING_EXPLICIT_TARGET, time };
}

function notifyControllerTimeUpdate() {
    return { type: NOTIFY_CONTROLLER_TIME_UPDATE };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Type constants
        SET_CONTROLLER_TIME, SET_CONTROLLER_TIME_SILENT,
        PAUSE_CONTROLLER, PLAY_CONTROLLER,
        REQUEST_FRAME, REQUEST_FULL_RESOLUTION_FRAME, CANCEL_FOREGROUND_REQUEST,
        OPEN_SOCKET, CLOSE_SOCKET,
        SCHEDULE_PREFETCH, CANCEL_PREFETCH,
        SET_TIMER, CLEAR_TIMER, SET_INTERVAL, CLEAR_INTERVAL,
        BIND_PLAYER_LISTENERS, UNBIND_PLAYER_LISTENERS,
        REFRESH_OVERLAY_LAYOUT, EMIT_TIME_UPDATE,
        RENDER, CREATE_OVERLAY, DESTROY_OVERLAY,
        REQUEST_FULLSCREEN, EXIT_FULLSCREEN,
        SYNC_SCROLL_LOCK, SYNC_RENDER_SURFACE,
        RESET_IMAGE_TRANSFORM, APPLY_IMAGE_TRANSFORM,
        STORE_CACHED_FRAME, CLEAR_FRAME_CACHE,
        CLEAR_PENDING_EXPLICIT_TARGET, NOTIFY_CONTROLLER_TIME_UPDATE,
        // Constructors
        setControllerTime, setControllerTimeSilent,
        pauseController, playController,
        requestFrame, requestFullResolutionFrame, cancelForegroundRequest,
        openSocket, closeSocket,
        schedulePrefetch, cancelPrefetch,
        setTimer, clearTimer, setInterval, clearInterval,
        bindPlayerListeners, unbindPlayerListeners,
        refreshOverlayLayout, emitTimeUpdate,
        render, createOverlay, destroyOverlay,
        requestFullscreen, exitFullscreen,
        syncScrollLock, syncRenderSurface,
        resetImageTransform, applyImageTransform,
        storeCachedFrame, clearFrameCache,
        clearPendingExplicitTarget, notifyControllerTimeUpdate
    };
}
