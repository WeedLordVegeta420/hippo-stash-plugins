// TheaterMode - Stash plugin
// Adds a theater mode button to the Video.js control bar (next to the speed
// control). Clicking it (or pressing T) expands the video to full width and
// moves the scene details panel below.

(function () {
    'use strict';

    const BUTTON_ID = 'theater-mode-btn';
    const STYLE_ID = 'theater-mode-styles';
    const BODY_CLASS = 'stash-theater-mode';

    let isTheaterMode = false;
    let isInitializing = false;
    let keydownAttached = false;

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

    function init() {
        if (document.getElementById(BUTTON_ID)) return;
        if (isInitializing) return;
        isInitializing = true;

        try {
            injectStyles();

            const controlBar = document.querySelector('.vjs-control-bar');
            if (!controlBar) return;

            if (document.getElementById(BUTTON_ID)) return;

            const btn = createButton();

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
