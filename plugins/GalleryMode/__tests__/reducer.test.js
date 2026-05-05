/**
 * Tests for gallery session reducer, store, selectors, and state modules.
 */

const { createInitialState, cloneState, GALLERY_MIN_ZOOM_SCALE } = require('../src/gallerySessionState');
const { GALLERY_TIME_EPSILON, isSameGalleryTime: isSameTime, normalizeGalleryTime: normalizeTime, clampGalleryTime: clampTime } = require('../src/core');
const Events = require('../src/gallerySessionEvents');
const Effects = require('../src/gallerySessionEffects');
const { reduce, hasPendingExplicitTarget, shouldHoldPendingTarget } = require('../src/gallerySessionReducer');
const Selectors = require('../src/gallerySessionSelectors');
const { createStore } = require('../src/gallerySessionStore');

describe('gallerySessionState', () => {
    test('createInitialState returns a fresh state with all groups', () => {
        const state = createInitialState();
        expect(state.session).toBeDefined();
        expect(state.navigation).toBeDefined();
        expect(state.requests).toBeDefined();
        expect(state.render).toBeDefined();
        expect(state.interaction).toBeDefined();
        expect(state.prefetch).toBeDefined();
        expect(state.environment).toBeDefined();
        expect(state.session.open).toBe(false);
        expect(state.navigation.requestedTime).toBeNull();
        expect(state.render.hasVisibleFrame).toBe(false);
    });

    test('cloneState produces independent copies', () => {
        const state = createInitialState();
        state.session.open = true;
        state.prefetch.queue = [1, 2, 3];
        const clone = cloneState(state);
        clone.session.open = false;
        clone.prefetch.queue.push(4);
        expect(state.session.open).toBe(true);
        expect(state.prefetch.queue).toEqual([1, 2, 3]);
    });
});

describe('reducer helpers', () => {
    test('isSameTime within epsilon', () => {
        expect(isSameTime(1.0, 1.04)).toBe(true);
        expect(isSameTime(1.0, 1.06)).toBe(false);
        expect(isSameTime(null, 1.0)).toBe(false);
        expect(isSameTime(1.0, null)).toBe(false);
    });

    test('normalizeTime clamps to 0', () => {
        expect(normalizeTime(-5)).toBe(0);
        expect(normalizeTime(NaN)).toBe(0);
        expect(normalizeTime(Infinity)).toBe(0);
        expect(normalizeTime(10)).toBe(10);
    });

    test('clampTime respects duration', () => {
        expect(clampTime(100, 60)).toBe(60);
        expect(clampTime(30, 60)).toBe(30);
        expect(clampTime(-5, 60)).toBe(0);
        expect(clampTime(30, 0)).toBe(30);
    });

    test('hasPendingExplicitTarget requires low bandwidth', () => {
        const nav = { pendingExplicitTarget: 10 };
        expect(hasPendingExplicitTarget(nav, { lowBandwidth: true })).toBe(true);
        expect(hasPendingExplicitTarget(nav, { lowBandwidth: false })).toBe(false);
        expect(hasPendingExplicitTarget({ pendingExplicitTarget: null }, { lowBandwidth: true })).toBe(false);
    });

    test('shouldHoldPendingTarget holds within source-target range', () => {
        const nav = { pendingExplicitTarget: 10, pendingExplicitSource: 5 };
        const env = { lowBandwidth: true };
        // Time within range [5, 10] should hold
        expect(shouldHoldPendingTarget(7, nav, env)).toBe(true);
        // Time at target should NOT hold (arrived)
        expect(shouldHoldPendingTarget(10, nav, env)).toBe(false);
        // Time outside range should NOT hold (preempted)
        expect(shouldHoldPendingTarget(15, nav, env)).toBe(false);
    });

    test('shouldHoldPendingTarget holds all intermediate times when source is null', () => {
        const nav = { pendingExplicitTarget: 10, pendingExplicitSource: null };
        const env = { lowBandwidth: true };
        expect(shouldHoldPendingTarget(3, nav, env)).toBe(true);
        expect(shouldHoldPendingTarget(10, nav, env)).toBe(false);
    });
});

describe('reducer: OPEN_GALLERY', () => {
    test('opens the session and emits frame request', () => {
        const state = createInitialState();
        const event = Events.openGallery('42', 5.0, 'image');
        const { state: next, effects } = reduce(state, event);

        expect(next.session.open).toBe(true);
        expect(next.session.sceneId).toBe('42');
        expect(next.session.mediaMode).toBe('image');
        expect(next.navigation.requestedTime).toBe(5.0);
        expect(next.requests.activeRequestId).toBe(1);

        const effectTypes = effects.map(e => e.type);
        expect(effectTypes).toContain(Effects.CANCEL_FOREGROUND_REQUEST);
        expect(effectTypes).toContain(Effects.BIND_PLAYER_LISTENERS);
        expect(effectTypes).toContain(Effects.PAUSE_CONTROLLER);
        expect(effectTypes).toContain(Effects.RESET_IMAGE_TRANSFORM);
        expect(effectTypes).toContain(Effects.RENDER);
        expect(effectTypes).toContain(Effects.REFRESH_OVERLAY_LAYOUT);
        expect(effectTypes).toContain(Effects.REQUEST_FRAME);

        const frameReq = effects.find(e => e.type === Effects.REQUEST_FRAME);
        expect(frameReq.time).toBe(5.0);
        expect(frameReq.requestId).toBe(1);
    });

    test('sets pending explicit target in low bandwidth mode', () => {
        const state = createInitialState();
        state.environment.lowBandwidth = true;
        state.navigation.controllerTime = 2.0;
        const event = Events.openGallery('42', 10.0, 'image');
        const { state: next, effects } = reduce(state, event);

        expect(next.navigation.pendingExplicitTarget).toBe(10.0);
        expect(next.navigation.pendingExplicitSource).toBe(2.0);
        expect(next.navigation.ignoredPlayerTime).toBe(10.0);
        expect(effects.some(e => e.type === Effects.SET_CONTROLLER_TIME && e.time === 10.0)).toBe(true);
    });

    test('video mode preserves hasVisibleFrame from previous state', () => {
        const state = createInitialState();
        state.render.hasVisibleFrame = true;
        const event = Events.openGallery('42', 5.0, 'video');
        const { state: next } = reduce(state, event);
        expect(next.render.hasVisibleFrame).toBe(true);
    });
});

describe('reducer: EXIT_GALLERY', () => {
    test('clears all session state and emits cleanup effects', () => {
        const state = createInitialState();
        state.session.open = true;
        state.session.sceneId = '42';
        state.navigation.requestedTime = 5.0;
        state.render.hasVisibleFrame = true;

        const { state: next, effects } = reduce(state, Events.exitGallery());

        expect(next.session.open).toBe(false);
        expect(next.navigation.requestedTime).toBeNull();
        expect(next.render.hasVisibleFrame).toBe(false);

        const effectTypes = effects.map(e => e.type);
        expect(effectTypes).toContain(Effects.CANCEL_FOREGROUND_REQUEST);
        expect(effectTypes).toContain(Effects.CANCEL_PREFETCH);
        expect(effectTypes).toContain(Effects.CLOSE_SOCKET);
        expect(effectTypes).toContain(Effects.UNBIND_PLAYER_LISTENERS);
        expect(effectTypes).toContain(Effects.DESTROY_OVERLAY);
    });
});

describe('reducer: JUMP_BY', () => {
    test('computes clamped target time from delta', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 10.0;
        state.environment.duration = 60;

        const { state: next } = reduce(state, Events.jumpBy(5));
        expect(next.navigation.requestedTime).toBe(15.0);
    });

    test('clamps to duration', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 55.0;
        state.environment.duration = 60;

        const { state: next } = reduce(state, Events.jumpBy(10));
        expect(next.navigation.requestedTime).toBe(60);
    });

    test('clamps to 0 on negative overshoot', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 3.0;
        state.environment.duration = 60;

        const { state: next } = reduce(state, Events.jumpBy(-10));
        expect(next.navigation.requestedTime).toBe(0);
    });

    test('no-ops when gallery is closed', () => {
        const state = createInitialState();
        state.session.open = false;
        const { state: next, effects } = reduce(state, Events.jumpBy(5));
        expect(next).toBe(state);
        expect(effects).toEqual([]);
    });

    test('no-ops when target equals current time', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 10.0;
        state.environment.duration = 60;

        // Jump by 0 -> same time
        const { effects } = reduce(state, Events.jumpBy(0));
        expect(effects).toEqual([]);
    });

    test('sets pending explicit target in low bandwidth mode', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.navigation.requestedTime = 10.0;
        state.navigation.controllerTime = 10.0;
        state.environment.duration = 60;

        const { state: next, effects } = reduce(state, Events.jumpBy(5));
        expect(next.navigation.pendingExplicitTarget).toBe(15.0);
        expect(next.navigation.pendingExplicitSource).toBe(10.0);
        expect(effects.some(e => e.type === Effects.SET_CONTROLLER_TIME)).toBe(true);
    });
});

describe('reducer: SEEK_TO', () => {
    test('sets requested time and emits frame request', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 5.0;

        const { state: next, effects } = reduce(state, Events.seekTo(20.0));
        expect(next.navigation.requestedTime).toBe(20.0);
        expect(effects.some(e => e.type === Effects.REQUEST_FRAME && e.time === 20.0)).toBe(true);
    });

    test('no-ops when same time', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 5.0;

        const { effects } = reduce(state, Events.seekTo(5.0));
        expect(effects).toEqual([]);
    });
});

describe('reducer: SCRUB_INPUT', () => {
    test('preempts pending explicit target when scrubbing outside range', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.navigation.requestedTime = 5.0;
        state.navigation.pendingExplicitTarget = 10.0;
        state.navigation.pendingExplicitSource = 5.0;

        // Scrub to 20 — outside the [5, 10] range — should preempt
        const { state: next } = reduce(state, Events.scrubInput(20.0));
        expect(next.navigation.pendingExplicitTarget).toBeNull();
        expect(next.navigation.pendingExplicitSource).toBeNull();
        expect(next.navigation.requestedTime).toBe(20.0);
    });

    test('does not preempt when scrubbing within range', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.navigation.requestedTime = 5.0;
        state.navigation.pendingExplicitTarget = 10.0;
        state.navigation.pendingExplicitSource = 5.0;

        // Scrub to 7 — inside the [5, 10] range — should hold
        const { state: next } = reduce(state, Events.scrubInput(7.0));
        expect(next.navigation.pendingExplicitTarget).toBe(10.0);
    });
});

describe('reducer: CONTROLLER_TIME_UPDATE', () => {
    test('ignores updates at the controlled seek target in HB mode', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = false;
        state.navigation.controlledSeekTarget = 15.0;
        state.navigation.requestedTime = 10.0;

        const { state: next, effects } = reduce(state, Events.controllerTimeUpdate(15.0));
        expect(next.navigation.controllerTime).toBe(15.0);
        expect(effects).toEqual([]);
    });

    test('holds when pending explicit target is active', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.navigation.pendingExplicitTarget = 10.0;
        state.navigation.pendingExplicitSource = 5.0;
        state.navigation.requestedTime = 5.0;

        const { effects } = reduce(state, Events.controllerTimeUpdate(7.0));
        expect(effects).toEqual([]);
    });

    test('clears ignored player time on match', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.ignoredPlayerTime = 15.0;
        state.navigation.requestedTime = 10.0;

        const { state: next, effects } = reduce(state, Events.controllerTimeUpdate(15.0));
        expect(next.navigation.ignoredPlayerTime).toBeNull();
        expect(next.navigation.requestedTime).toBe(15.0);
        expect(effects).toEqual([]);
    });

    test('shows frame on actual time change', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 5.0;

        const { state: next, effects } = reduce(state, Events.controllerTimeUpdate(20.0));
        expect(next.navigation.requestedTime).toBe(20.0);
        expect(effects.some(e => e.type === Effects.PAUSE_CONTROLLER)).toBe(true);
        expect(effects.some(e => e.type === Effects.REQUEST_FRAME)).toBe(true);
    });

    test('no-ops when same as current requested time', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 10.0;

        const { effects } = reduce(state, Events.controllerTimeUpdate(10.0));
        expect(effects).toEqual([]);
    });
});

describe('reducer: CONTROLLER_SEEKING', () => {
    test('does not interrupt controlled seeks in HB mode', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = false;
        state.navigation.controlledSeekTarget = 15.0;

        const { effects } = reduce(state, Events.controllerSeeking(12.0));
        expect(effects).toEqual([]);
    });

    test('cancels request and shows loading on external seek', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 5.0;

        const { state: next, effects } = reduce(state, Events.controllerSeeking(20.0));
        expect(next.render.loadingVisible).toBe(true);
        expect(effects.some(e => e.type === Effects.CANCEL_FOREGROUND_REQUEST)).toBe(true);
        expect(effects.some(e => e.type === Effects.CANCEL_PREFETCH)).toBe(true);
    });
});

describe('reducer: FRAME_LOADED', () => {
    test('updates render state and schedules prefetch', () => {
        const state = createInitialState();
        state.session.open = true;
        state.session.sceneId = '42';
        state.requests.activeRequestId = 5;

        const { state: next, effects } = reduce(state, Events.frameLoaded(5, 10.0, 'data:image/jpeg;base64,...', 0.5));
        expect(next.render.imageSrc).toBe('data:image/jpeg;base64,...');
        expect(next.render.imageScale).toBe(0.5);
        expect(next.render.hasVisibleFrame).toBe(true);
        expect(next.render.loadingVisible).toBe(false);
        expect(next.navigation.displayedTime).toBe(10.0);

        const effectTypes = effects.map(e => e.type);
        expect(effectTypes).toContain(Effects.STORE_CACHED_FRAME);
        expect(effectTypes).toContain(Effects.CLEAR_PENDING_EXPLICIT_TARGET);
        expect(effectTypes).toContain(Effects.SCHEDULE_PREFETCH);
        expect(effectTypes).toContain(Effects.RENDER);
    });

    test('ignores stale request IDs', () => {
        const state = createInitialState();
        state.session.open = true;
        state.requests.activeRequestId = 5;

        const { state: next, effects } = reduce(state, Events.frameLoaded(3, 10.0, 'src', 1));
        expect(next).toBe(state);
        expect(effects).toEqual([]);
    });
});

describe('reducer: FRAME_ERROR', () => {
    test('sets error message', () => {
        const state = createInitialState();
        state.session.open = true;
        state.requests.activeRequestId = 5;

        const { state: next } = reduce(state, Events.frameError(5, 'Frame unavailable'));
        expect(next.render.errorMessage).toBe('Frame unavailable');
        expect(next.render.hasVisibleFrame).toBe(false);
    });
});

describe('reducer: VIDEO_FRAME_READY', () => {
    test('marks frame visible and emits layout effects', () => {
        const state = createInitialState();
        state.session.open = true;
        state.requests.activeRequestId = 7;

        const { state: next, effects } = reduce(state, Events.videoFrameReady(7, 15.0));
        expect(next.render.hasVisibleFrame).toBe(true);
        expect(next.render.loadingVisible).toBe(false);
        expect(next.navigation.displayedTime).toBe(15.0);

        const effectTypes = effects.map(e => e.type);
        expect(effectTypes).toContain(Effects.APPLY_IMAGE_TRANSFORM);
        expect(effectTypes).toContain(Effects.REFRESH_OVERLAY_LAYOUT);
        expect(effectTypes).toContain(Effects.NOTIFY_CONTROLLER_TIME_UPDATE);
    });
});

describe('reducer: REQUEST_FULL_RESOLUTION', () => {
    test('emits full resolution request', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 10.0;
        state.render.imageSrc = 'some-src';
        state.render.imageScale = 0.5;

        const { state: next, effects } = reduce(state, Events.requestFullResolution());
        expect(next.render.fullResolutionPending).toBe(true);
        expect(effects.some(e => e.type === Effects.REQUEST_FULL_RESOLUTION_FRAME)).toBe(true);
    });

    test('no-ops if already at full resolution', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 10.0;
        state.render.imageSrc = 'full-src';
        state.render.imageScale = 1;

        const { effects } = reduce(state, Events.requestFullResolution());
        expect(effects).toEqual([]);
    });

    test('no-ops if already pending', () => {
        const state = createInitialState();
        state.session.open = true;
        state.navigation.requestedTime = 10.0;
        state.render.fullResolutionPending = true;

        const { effects } = reduce(state, Events.requestFullResolution());
        expect(effects).toEqual([]);
    });
});

describe('reducer: FULLSCREEN', () => {
    test('FULLSCREEN_ENTERED sets fullscreen and syncs scroll lock', () => {
        const state = createInitialState();
        const { state: next, effects } = reduce(state, Events.fullscreenEntered());
        expect(next.session.fullscreen).toBe(true);
        expect(effects.some(e => e.type === Effects.SYNC_SCROLL_LOCK && e.locked === true)).toBe(true);
    });

    test('FULLSCREEN_EXITED clears fullscreen and pseudo-fullscreen', () => {
        const state = createInitialState();
        state.session.fullscreen = true;
        state.session.pseudoFullscreen = true;
        const { state: next, effects } = reduce(state, Events.fullscreenExited());
        expect(next.session.fullscreen).toBe(false);
        expect(next.session.pseudoFullscreen).toBe(false);
        expect(effects.some(e => e.type === Effects.SYNC_SCROLL_LOCK && e.locked === false)).toBe(true);
    });
});

describe('reducer: CONTROLS_TOGGLE', () => {
    test('toggles controls visibility', () => {
        const state = createInitialState();
        const { state: next } = reduce(state, Events.controlsToggle(true));
        expect(next.session.controlsVisible).toBe(true);
        const { state: next2 } = reduce(next, Events.controlsToggle(false));
        expect(next2.session.controlsVisible).toBe(false);
    });
});

describe('reducer: GESTURE events', () => {
    test('GESTURE_STARTED with pinch sets gesture state', () => {
        const state = createInitialState();
        state.session.open = true;
        const { state: next } = reduce(state, Events.gestureStarted('pinch', {
            distance: 200, anchorContentX: 10, anchorContentY: 20
        }));
        expect(next.interaction.activeGesture).toBe('pinch');
        expect(next.interaction.gestureStartDistance).toBe(200);
    });

    test('GESTURE_UPDATED with pan updates pan coordinates', () => {
        const state = createInitialState();
        state.session.open = true;
        state.interaction.activeGesture = 'pan';
        const { state: next } = reduce(state, Events.gestureUpdated('pan', { panX: 50, panY: 30 }));
        expect(next.interaction.panX).toBe(50);
        expect(next.interaction.panY).toBe(30);
    });

    test('GESTURE_ENDED clears pending_pan', () => {
        const state = createInitialState();
        state.session.open = true;
        state.interaction.activeGesture = 'pending_pan';
        const { state: next } = reduce(state, Events.gestureEnded('pending_pan'));
        expect(next.interaction.activeGesture).toBeNull();
    });
});

describe('reducer: SETTINGS_LOADED', () => {
    test('updates environment from settings', () => {
        const state = createInitialState();
        const { state: next } = reduce(state, Events.settingsLoaded({
            low_bandwidth_mode: true,
            show_debug_panel: true,
            frame_server_port: 1234
        }));
        expect(next.environment.lowBandwidth).toBe(true);
        expect(next.environment.debugEnabled).toBe(true);
        expect(next.environment.pluginSettings.frame_server_port).toBe(1234);
    });
});

describe('reducer: SCENE_DATA_LOADED', () => {
    test('updates duration from scene data', () => {
        const state = createInitialState();
        const { state: next } = reduce(state, Events.sceneDataLoaded({
            id: '42', duration: 120, files: [{ duration: 120 }], paths: { sprite: '/sprites/42.jpg' }
        }));
        expect(next.environment.duration).toBe(120);
        expect(next.session.sceneData).toBeTruthy();
    });
});

describe('reducer: PREFETCH_BATCH_COMPLETE', () => {
    test('emits store effects for results matching current generation', () => {
        const state = createInitialState();
        state.session.open = true;
        state.session.sceneId = '42';
        state.prefetch.generation = 3;

        const { effects } = reduce(state, Events.prefetchBatchComplete(3, [
            { time: 5, src: 'src5' },
            { time: 10, src: 'src10' }
        ]));
        const storeEffects = effects.filter(e => e.type === Effects.STORE_CACHED_FRAME);
        expect(storeEffects).toHaveLength(2);
    });

    test('ignores stale generation', () => {
        const state = createInitialState();
        state.prefetch.generation = 5;
        const { effects } = reduce(state, Events.prefetchBatchComplete(3, [{ time: 5, src: 'src' }]));
        expect(effects).toEqual([]);
    });
});

describe('reducer: unknown event', () => {
    test('returns state unchanged', () => {
        const state = createInitialState();
        const { state: next, effects } = reduce(state, { type: 'UNKNOWN_EVENT' });
        expect(next).toBe(state);
        expect(effects).toEqual([]);
    });
});

// --- Jump race condition tests (from plan) ---
describe('reducer: jump-forward race condition', () => {
    test('explicit jump target remains authoritative until settled', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.environment.duration = 60;
        state.navigation.requestedTime = 10.0;
        state.navigation.controllerTime = 10.0;

        // User jumps forward by 5
        const { state: afterJump } = reduce(state, Events.jumpBy(5));
        expect(afterJump.navigation.pendingExplicitTarget).toBe(15.0);
        expect(afterJump.navigation.pendingExplicitSource).toBe(10.0);

        // Controller fires time update at 12 (intermediate) — should be held
        const { state: afterUpdate, effects: updateEffects } = reduce(afterJump, Events.controllerTimeUpdate(12.0));
        expect(updateEffects).toEqual([]);
        expect(afterUpdate.navigation.requestedTime).toBe(15.0);

        // Controller arrives at 15 (target) — clears ignored time
        const { state: afterArrival } = reduce(afterUpdate, Events.controllerTimeUpdate(15.0));
        expect(afterArrival.navigation.ignoredPlayerTime).toBeNull();
    });

    test('stale controller time within old-to-target range is ignored', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.environment.duration = 60;
        state.navigation.requestedTime = 5.0;
        state.navigation.controllerTime = 5.0;

        // Jump to 15
        const { state: afterJump } = reduce(state, Events.jumpBy(10));

        // Stale time at 8 (in range 5-15) should be held
        const { effects } = reduce(afterJump, Events.controllerTimeUpdate(8.0));
        expect(effects).toEqual([]);
    });

    test('external scrub outside range preempts pending jump ownership', () => {
        const state = createInitialState();
        state.session.open = true;
        state.environment.lowBandwidth = true;
        state.environment.duration = 60;
        state.navigation.requestedTime = 5.0;
        state.navigation.pendingExplicitTarget = 15.0;
        state.navigation.pendingExplicitSource = 5.0;

        // Scrub to 30 (outside [5, 15])
        const { state: afterScrub } = reduce(state, Events.scrubInput(30.0));
        expect(afterScrub.navigation.pendingExplicitTarget).toBeNull();
        expect(afterScrub.navigation.requestedTime).toBe(30.0);
    });
});

// --- Store tests ---
describe('gallerySessionStore', () => {
    test('creates a store with initial state', () => {
        const store = createStore();
        expect(store.getState().session.open).toBe(false);
    });

    test('dispatch updates state', () => {
        const store = createStore();
        store.dispatch(Events.settingsLoaded({ low_bandwidth_mode: true }));
        expect(store.getState().environment.lowBandwidth).toBe(true);
    });

    test('subscribe notifies on dispatch', () => {
        const store = createStore();
        const listener = jest.fn();
        store.subscribe(listener);
        store.dispatch(Events.controlsToggle(true));
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            session: expect.objectContaining({ controlsVisible: true })
        }));
    });

    test('unsubscribe stops notifications', () => {
        const store = createStore();
        const listener = jest.fn();
        const unsub = store.subscribe(listener);
        unsub();
        store.dispatch(Events.controlsToggle(true));
        expect(listener).not.toHaveBeenCalled();
    });

    test('destroy resets state', () => {
        const store = createStore();
        store.dispatch(Events.settingsLoaded({ low_bandwidth_mode: true }));
        store.destroy();
        expect(store.getState().environment.lowBandwidth).toBe(false);
    });

    test('effect runner is called for effects', () => {
        const effectLog = [];
        const store = createStore({
            runEffect: (effect) => effectLog.push(effect.type)
        });
        // Open gallery produces effects
        const state = store.getState();
        state.session.open = true;
        store.replaceState(state);
        store.dispatch(Events.controlsToggle(true));
        expect(effectLog).toContain(Effects.RENDER);
    });

    test('replaceState updates state and notifies', () => {
        const store = createStore();
        const listener = jest.fn();
        store.subscribe(listener);
        const newState = createInitialState();
        newState.session.open = true;
        store.replaceState(newState);
        expect(store.getState().session.open).toBe(true);
        expect(listener).toHaveBeenCalled();
    });
});

// --- Selectors tests ---
describe('gallerySessionSelectors', () => {
    test('isOpen', () => {
        const state = createInitialState();
        expect(Selectors.isOpen(state)).toBe(false);
        state.session.open = true;
        expect(Selectors.isOpen(state)).toBe(true);
    });

    test('isFullscreen includes pseudo-fullscreen', () => {
        const state = createInitialState();
        expect(Selectors.isFullscreen(state)).toBe(false);
        state.session.pseudoFullscreen = true;
        expect(Selectors.isFullscreen(state)).toBe(true);
    });

    test('hasVisibleFrame', () => {
        const state = createInitialState();
        expect(Selectors.hasVisibleFrame(state)).toBe(false);
        state.render.hasVisibleFrame = true;
        expect(Selectors.hasVisibleFrame(state)).toBe(true);
    });

    test('getJumpButtonStates', () => {
        const state = createInitialState();
        state.navigation.requestedTime = 10;
        state.environment.duration = 60;
        const buttons = [{ delta: -5 }, { delta: 5 }];
        const hasCached = (time) => time === 15;
        const result = Selectors.getJumpButtonStates(state, buttons, hasCached);
        expect(result).toHaveLength(2);
        expect(result[0].disabled).toBe(false);
        expect(result[0].cached).toBe(false);
        expect(result[1].disabled).toBe(false);
        expect(result[1].cached).toBe(true);
    });

    test('getScrubberState', () => {
        const state = createInitialState();
        state.navigation.requestedTime = 25;
        state.environment.duration = 120;
        const result = Selectors.getScrubberState(state, 5);
        expect(result.min).toBe(0);
        expect(result.max).toBe(120);
        expect(result.value).toBe(25);
        expect(result.step).toBe(5);
        expect(result.disabled).toBe(false);
    });

    test('canRequestFullResolution', () => {
        const state = createInitialState();
        state.session.open = true;
        state.session.mediaMode = 'image';
        state.navigation.requestedTime = 10;
        state.render.imageSrc = 'src';
        state.render.imageScale = 0.5;
        expect(Selectors.canRequestFullResolution(state)).toBe(true);

        state.render.imageScale = 1;
        expect(Selectors.canRequestFullResolution(state)).toBe(false);
    });

    test('canRequestFullResolution false for video mode', () => {
        const state = createInitialState();
        state.session.open = true;
        state.session.mediaMode = 'video';
        state.navigation.requestedTime = 10;
        expect(Selectors.canRequestFullResolution(state)).toBe(false);
    });

    test('isZoomed', () => {
        const state = createInitialState();
        expect(Selectors.isZoomed(state)).toBe(false);
        state.interaction.zoomScale = 2;
        expect(Selectors.isZoomed(state)).toBe(true);
    });
});
