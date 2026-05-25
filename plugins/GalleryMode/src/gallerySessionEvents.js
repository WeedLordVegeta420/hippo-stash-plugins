/**
 * Gallery session event definitions.
 *
 * All external inputs are normalized into typed event objects.
 * Events are plain objects with a `type` string and associated payload.
 */

// --- Event type constants ---
const OPEN_GALLERY = 'OPEN_GALLERY';
const EXIT_GALLERY = 'EXIT_GALLERY';
const JUMP_BY = 'JUMP_BY';
const SEEK_TO = 'SEEK_TO';
const SCRUB_INPUT = 'SCRUB_INPUT';
const CONTROLLER_SEEKING = 'CONTROLLER_SEEKING';
const CONTROLLER_SEEKED = 'CONTROLLER_SEEKED';
const CONTROLLER_TIME_UPDATE = 'CONTROLLER_TIME_UPDATE';
const SOCKET_FRAME_OK = 'SOCKET_FRAME_OK';
const SOCKET_FRAME_ERROR = 'SOCKET_FRAME_ERROR';
const SOCKET_BATCH_OK = 'SOCKET_BATCH_OK';
const REQUEST_TIMEOUT = 'REQUEST_TIMEOUT';
const FULLSCREEN_ENTERED = 'FULLSCREEN_ENTERED';
const FULLSCREEN_EXITED = 'FULLSCREEN_EXITED';
const GESTURE_STARTED = 'GESTURE_STARTED';
const GESTURE_UPDATED = 'GESTURE_UPDATED';
const GESTURE_ENDED = 'GESTURE_ENDED';
const LAYOUT_REFRESHED = 'LAYOUT_REFRESHED';
const FRAME_LOADED = 'FRAME_LOADED';
const FRAME_ERROR = 'FRAME_ERROR';
const VIDEO_FRAME_READY = 'VIDEO_FRAME_READY';
const FULL_RESOLUTION_LOADED = 'FULL_RESOLUTION_LOADED';
const FULL_RESOLUTION_ERROR = 'FULL_RESOLUTION_ERROR';
const REQUEST_FULL_RESOLUTION = 'REQUEST_FULL_RESOLUTION';
const CONTROLS_TOGGLE = 'CONTROLS_TOGGLE';
const PREFETCH_BATCH_COMPLETE = 'PREFETCH_BATCH_COMPLETE';
const PREFETCH_CANCELLED = 'PREFETCH_CANCELLED';
const SETTINGS_LOADED = 'SETTINGS_LOADED';
const SCENE_DATA_LOADED = 'SCENE_DATA_LOADED';

// --- Event constructors ---

function openGallery(sceneId, time, mediaMode) {
    return { type: OPEN_GALLERY, sceneId, time, mediaMode };
}

function exitGallery() {
    return { type: EXIT_GALLERY };
}

function jumpBy(delta) {
    return { type: JUMP_BY, delta };
}

function seekTo(time) {
    return { type: SEEK_TO, time };
}

function scrubInput(time) {
    return { type: SCRUB_INPUT, time };
}

function controllerSeeking(time) {
    return { type: CONTROLLER_SEEKING, time };
}

function controllerSeeked(time) {
    return { type: CONTROLLER_SEEKED, time };
}

function controllerTimeUpdate(time) {
    return { type: CONTROLLER_TIME_UPDATE, time };
}

function socketFrameOk(requestId, time, src, scale) {
    return { type: SOCKET_FRAME_OK, requestId, time, src, scale };
}

function socketFrameError(requestId, message) {
    return { type: SOCKET_FRAME_ERROR, requestId, message };
}

function socketBatchOk(requestId, results) {
    return { type: SOCKET_BATCH_OK, requestId, results };
}

function requestTimeout(requestId) {
    return { type: REQUEST_TIMEOUT, requestId };
}

function fullscreenEntered() {
    return { type: FULLSCREEN_ENTERED };
}

function fullscreenExited() {
    return { type: FULLSCREEN_EXITED };
}

function gestureStarted(gestureType, payload) {
    return { type: GESTURE_STARTED, gestureType, ...payload };
}

function gestureUpdated(gestureType, payload) {
    return { type: GESTURE_UPDATED, gestureType, ...payload };
}

function gestureEnded(gestureType) {
    return { type: GESTURE_ENDED, gestureType };
}

function layoutRefreshed() {
    return { type: LAYOUT_REFRESHED };
}

function frameLoaded(requestId, time, src, scale) {
    return { type: FRAME_LOADED, requestId, time, src, scale };
}

function frameError(requestId, message) {
    return { type: FRAME_ERROR, requestId, message };
}

function videoFrameReady(requestId, time) {
    return { type: VIDEO_FRAME_READY, requestId, time };
}

function fullResolutionLoaded(requestId, time, src) {
    return { type: FULL_RESOLUTION_LOADED, requestId, time, src };
}

function fullResolutionError(requestId, message) {
    return { type: FULL_RESOLUTION_ERROR, requestId, message };
}

function requestFullResolution() {
    return { type: REQUEST_FULL_RESOLUTION };
}

function controlsToggle(visible) {
    return { type: CONTROLS_TOGGLE, visible };
}

function prefetchBatchComplete(generation, results) {
    return { type: PREFETCH_BATCH_COMPLETE, generation, results };
}

function prefetchCancelled() {
    return { type: PREFETCH_CANCELLED };
}

function settingsLoaded(pluginSettings) {
    return { type: SETTINGS_LOADED, pluginSettings };
}

function sceneDataLoaded(sceneData) {
    return { type: SCENE_DATA_LOADED, sceneData };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Type constants
        OPEN_GALLERY, EXIT_GALLERY, JUMP_BY, SEEK_TO, SCRUB_INPUT,
        CONTROLLER_SEEKING, CONTROLLER_SEEKED, CONTROLLER_TIME_UPDATE,
        SOCKET_FRAME_OK, SOCKET_FRAME_ERROR, SOCKET_BATCH_OK, REQUEST_TIMEOUT,
        FULLSCREEN_ENTERED, FULLSCREEN_EXITED,
        GESTURE_STARTED, GESTURE_UPDATED, GESTURE_ENDED,
        LAYOUT_REFRESHED, FRAME_LOADED, FRAME_ERROR, VIDEO_FRAME_READY,
        FULL_RESOLUTION_LOADED, FULL_RESOLUTION_ERROR, REQUEST_FULL_RESOLUTION,
        CONTROLS_TOGGLE, PREFETCH_BATCH_COMPLETE, PREFETCH_CANCELLED,
        SETTINGS_LOADED, SCENE_DATA_LOADED,
        // Constructors
        openGallery, exitGallery, jumpBy, seekTo, scrubInput,
        controllerSeeking, controllerSeeked, controllerTimeUpdate,
        socketFrameOk, socketFrameError, socketBatchOk, requestTimeout,
        fullscreenEntered, fullscreenExited,
        gestureStarted, gestureUpdated, gestureEnded,
        layoutRefreshed, frameLoaded, frameError, videoFrameReady,
        fullResolutionLoaded, fullResolutionError, requestFullResolution,
        controlsToggle, prefetchBatchComplete, prefetchCancelled,
        settingsLoaded, sceneDataLoaded
    };
}
