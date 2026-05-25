/**
 * Gallery session state definition.
 *
 * Single authoritative state object for the gallery session.
 * All business state lives here; non-serializable handles (DOM nodes,
 * timers, sockets) live in the runtime context, not in this state.
 */

const GALLERY_MIN_ZOOM_SCALE = 1;

/**
 * @returns {object} A fresh initial gallery session state.
 */
function createInitialState() {
    return {
        // --- session ---
        session: {
            open: false,
            sceneId: null,
            sceneData: null,
            mediaMode: 'image',       // 'image' | 'video'
            fullscreen: false,
            pseudoFullscreen: false,
            controlsVisible: false
        },

        // --- navigation ---
        navigation: {
            requestedTime: null,       // last time we asked to display
            displayedTime: null,       // last time that was successfully rendered
            controllerTime: null,      // last observed player time
            pendingExplicitTarget: null,
            pendingExplicitSource: null,
            controlledSeekTarget: null,
            ignoredPlayerTime: null
        },

        // --- requests ---
        requests: {
            foregroundSeq: 0,
            activeRequestId: 0,
            fullResolutionPending: false
        },

        // --- render ---
        render: {
            imageSrc: '',
            imageScale: null,
            hasVisibleFrame: false,
            loadingVisible: false,
            loadingMessage: 'Loading\u2026',
            errorMessage: null
        },

        // --- interaction ---
        interaction: {
            zoomScale: GALLERY_MIN_ZOOM_SCALE,
            panX: 0,
            panY: 0,
            activeGesture: null,       // null | 'pending_pan' | 'pan' | 'pinch'
            gestureTouchId: null,
            gestureStartX: 0,
            gestureStartY: 0,
            gestureStartPanX: 0,
            gestureStartPanY: 0,
            gestureStartScale: GALLERY_MIN_ZOOM_SCALE,
            gestureStartDistance: 0,
            gestureAnchorContentX: 0,
            gestureAnchorContentY: 0,
            suppressTapUntil: 0
        },

        // --- prefetch ---
        prefetch: {
            queue: [],
            generation: 0,
            running: false,
            centerTime: null,
            contextKey: null
        },

        // --- environment ---
        environment: {
            lowBandwidth: false,
            duration: 0,
            cacheScale: 1,
            debugEnabled: false,
            pluginSettings: {
                enabled: false,
                lb_prefetch_enabled: true,
                lb_prefetch_offsets_seconds: '5',
                lb_prefetch_window_seconds: 30,
                lb_frame_server_port: 9876,
                lb_frame_server_host: '',
                lb_enabled: false,
                general_show_debug_panel: false
            }
        }
    };
}

/**
 * Clone a state object (shallow clone of each substate group).
 */
function cloneState(state) {
    return {
        session: { ...state.session },
        navigation: { ...state.navigation },
        requests: { ...state.requests },
        render: { ...state.render },
        interaction: { ...state.interaction },
        prefetch: { ...state.prefetch, queue: [...state.prefetch.queue] },
        environment: {
            ...state.environment,
            pluginSettings: { ...state.environment.pluginSettings }
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GALLERY_MIN_ZOOM_SCALE,
        createInitialState,
        cloneState
    };
}
