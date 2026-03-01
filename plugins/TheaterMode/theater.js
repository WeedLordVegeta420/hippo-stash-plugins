// TheaterMode - Stash plugin
// Adds a theater mode button to the Video.js control bar (next to the speed
// control). Clicking it (or pressing T) expands the video to full width and
// moves the scene details panel below.

(function () {
    'use strict';

    const BUTTON_ID   = 'theater-mode-btn';
    const STYLE_ID    = 'theater-mode-styles';
    const BODY_CLASS  = 'stash-theater-mode';
    const PLUGIN_ID   = 'TheaterMode';
    const STORAGE_KEY = 'theater_mode_state';
    const VALID_MODES = ['remember', 'always_on', 'always_off'];

    let isTheaterMode   = false;
    let isInitializing  = false;
    let keydownAttached = false;
    let defaultMode     = 'remember'; // overwritten after settings load

    // ── Persistence helpers ───────────────────────────────────────────────────

    function getDefaultMode(pluginConfig) {
        const mode = pluginConfig?.default_mode;
        return VALID_MODES.includes(mode) ? mode : 'remember';
    }

    function getSavedTheaterState() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        } catch (e) {
            return false;
        }
    }

    function setSavedTheaterState(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
        } catch (e) {
            // Storage unavailable
        }
    }

    // ── Stash API ─────────────────────────────────────────────────────────────

    async function stashGQL(query) {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const json = await response.json();
        return json.data;
    }

    async function loadPluginSettings() {
        const query = `query Configuration { configuration { plugins } }`;
        try {
            const data = await stashGQL(query);
            const allPlugins = data?.configuration?.plugins;
            defaultMode = getDefaultMode(allPlugins?.[PLUGIN_ID]);
        } catch (e) {
            console.warn('TheaterMode: Could not load plugin settings, using defaults', e);
        }
        return defaultMode;
    }

    // ── Styles ────────────────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            /* Theater mode button — inherits vjs-control vjs-button sizing */
            #${BUTTON_ID} svg {
                width: 1.5em;
                height: 1.5em;
                vertical-align: middle;
            }
            #${BUTTON_ID}.active {
                color: #c9a227 !important;
            }

            /* Theater mode layout:
               Stash's scene page (≥1200px) lays out a flex row as:
                 [.scene-tabs 450px] [.scene-divider 15px] [.scene-player-container rest]
               Theater mode makes both panels 100% wide so they stack, and
               reorders so the player comes first. */

            body.${BODY_CLASS} .scene-player-container {
                order: 1 !important;
                flex: 0 0 100% !important;
                max-width: 100% !important;
            }

            body.${BODY_CLASS} .scene-tabs {
                order: 2 !important;
                flex: 0 0 100% !important;
                max-width: 100% !important;
                /* Remove the fixed-height sidebar constraint so all content shows */
                max-height: none !important;
                overflow-y: visible !important;
            }

            body.${BODY_CLASS} .scene-divider {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Inject CSS and apply any saved theater mode state immediately at plugin
    // startup, before the first React render, to prevent layout flash.
    // applyInitialState() reconciles with the authoritative setting afterward.
    injectStyles();
    if (getSavedTheaterState()) {
        document.body.classList.add(BODY_CLASS);
        isTheaterMode = true;
    }

    // ── Button ────────────────────────────────────────────────────────────────

    // Wide-screen icon: outer frame + filled inner rectangle representing the
    // video filling the viewport.
    const ICON_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="1"/>
            <rect x="3" y="7" width="18" height="10" fill="currentColor" stroke="none" rx="0.5"/>
        </svg>
    `;

    function createButton() {
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.title = 'Theater Mode (T)';
        // Use VJS classes so the button inherits the control bar's sizing and colours
        btn.className = 'vjs-control vjs-button';
        btn.innerHTML = `${ICON_SVG}<span class="vjs-control-text">Theater Mode</span>`;
        btn.addEventListener('click', toggleTheaterMode);
        return btn;
    }

    // ── Theater mode toggle ───────────────────────────────────────────────────

    function enableTheaterMode() {
        document.body.classList.add(BODY_CLASS);
        document.getElementById(BUTTON_ID)?.classList.add('active');
        isTheaterMode = true;
    }

    function disableTheaterMode() {
        document.body.classList.remove(BODY_CLASS);
        document.getElementById(BUTTON_ID)?.classList.remove('active');
        isTheaterMode = false;
    }

    function toggleTheaterMode() {
        if (isTheaterMode) {
            disableTheaterMode();
        } else {
            enableTheaterMode();
        }
        if (defaultMode === 'remember') {
            setSavedTheaterState(isTheaterMode);
        }
    }

    // ── Keyboard shortcut ─────────────────────────────────────────────────────

    function handleKeydown(e) {
        const tag = e.target.tagName;
        if (e.key !== 't' && e.key !== 'T') return;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.target.isContentEditable) return;
        if (document.getElementById(BUTTON_ID)) {
            toggleTheaterMode();
        }
    }

    // ── Initialization ────────────────────────────────────────────────────────

    // Reconcile theater mode with the authoritative plugin setting after an
    // async fetch. Runs outside the isInitializing guard so the button is never
    // blocked by a pending network request. For 'always_off', also clears any
    // stale localStorage state so the startup optimistic apply does not
    // re-enable theater mode on the next page load.
    async function applyInitialState() {
        const mode = await loadPluginSettings();
        if (!/\/scenes\/\d+/.test(window.location.pathname)) return;
        if (mode === 'always_on') {
            enableTheaterMode();
        } else if (mode === 'always_off') {
            disableTheaterMode();
            setSavedTheaterState(false);
        }
        // 'remember': state was already applied synchronously from localStorage
    }

    function init() {
        if (document.getElementById(BUTTON_ID)) return;
        if (isInitializing) return;
        isInitializing = true;

        try {
            injectStyles();

            const controlBar = document.querySelector('.vjs-control-bar');
            if (!controlBar) return;

            if (document.getElementById(BUTTON_ID)) return;

            // Re-apply theater mode synchronously for this scene. cleanup()
            // disabled it when the user left the previous scene. On the first
            // load defaultMode may still be 'remember' (fetch not yet done), so
            // we use the localStorage state; applyInitialState() reconciles if
            // the actual setting differs. On subsequent navigations defaultMode
            // is cached and applied directly, avoiding any flash.
            if (defaultMode === 'always_on' ||
                (defaultMode === 'remember' && getSavedTheaterState())) {
                document.body.classList.add(BODY_CLASS);
                isTheaterMode = true;
            }

            const btn = createButton();
            // Sync the button's active state with the current theater mode so
            // it renders correctly at insertion time rather than after the fetch.
            if (isTheaterMode) btn.classList.add('active');

            // Insert to the left of the speed control, falling back to the
            // fullscreen control, then appending if neither is present.
            // querySelector guarantees the result is a descendant of controlBar,
            // so walking parentElement always terminates at controlBar.
            const findRef = (selector) => {
                const target = controlBar.querySelector(selector);
                if (!target) return null;
                let ref = target;
                while (ref.parentElement !== controlBar) ref = ref.parentElement;
                return ref;
            };
            const ref = findRef('.vjs-playback-rate') ?? findRef('.vjs-fullscreen-control');
            if (ref) {
                controlBar.insertBefore(btn, ref);
            } else {
                controlBar.appendChild(btn);
            }

            if (!keydownAttached) {
                document.addEventListener('keydown', handleKeydown);
                keydownAttached = true;
            }

            applyInitialState(); // async, does not block init()
        } finally {
            isInitializing = false;
        }
    }

    function cleanup() {
        if (isTheaterMode) {
            disableTheaterMode();
        }
    }

    // ── MutationObserver ──────────────────────────────────────────────────────

    const observer = new MutationObserver(() => {
        const isScenePage = /\/scenes\/\d+/.test(window.location.pathname);
        if (isScenePage) {
            const controlBar = document.querySelector('.vjs-control-bar');
            if (controlBar && !document.getElementById(BUTTON_ID)) {
                init();
            }
        } else {
            cleanup();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
