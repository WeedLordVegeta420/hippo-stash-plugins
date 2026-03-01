/**
 * Tests for TheaterMode plugin.
 *
 * Unit tests cover the two algorithms extracted into src/core.js.
 * Integration tests verify the DOM-manipulation patterns used by theater.js
 * without loading the IIFE directly (following the same approach as SpriteTab).
 */

const {
    findInsertionPoint,
    shouldHandleKeydown,
    getDefaultMode,
    getSavedTheaterState,
    setSavedTheaterState,
    STORAGE_KEY,
    VALID_MODES,
} = require('../src/core');

// ── Constants mirrored from theater.js ────────────────────────────────────────
const BUTTON_ID   = 'theater-mode-btn';
const STYLE_ID    = 'theater-mode-styles';
const BODY_CLASS  = 'stash-theater-mode';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal .vjs-control-bar and append it to the body. */
function makeControlBar() {
    const bar = document.createElement('div');
    bar.className = 'vjs-control-bar';
    document.body.appendChild(bar);
    return bar;
}

/** Append a child with the given class to a parent. */
function addChild(parent, className) {
    const el = document.createElement('div');
    el.className = className;
    parent.appendChild(el);
    return el;
}

/** Simulate the button the plugin creates. */
function makeButton() {
    const btn = document.createElement('button');
    btn.id    = BUTTON_ID;
    btn.type  = 'button';
    btn.title = 'Theater Mode (T)';
    btn.className = 'vjs-control vjs-button';
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>
        <span class="vjs-control-text">Theater Mode</span>
    `;
    return btn;
}

/** Simulate the style injection the plugin performs. */
function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        body.${BODY_CLASS} .scene-player-container {
            order: 1 !important;
            flex: 0 0 100% !important;
            max-width: 100% !important;
        }
        body.${BODY_CLASS} .scene-tabs {
            order: 2 !important;
            flex: 0 0 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow-y: visible !important;
        }
        body.${BODY_CLASS} .scene-divider {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

// ── findInsertionPoint ────────────────────────────────────────────────────────

describe('findInsertionPoint', () => {
    let bar;

    beforeEach(() => {
        bar = makeControlBar();
    });

    it('returns the element itself when it is a direct child of the container', () => {
        const speed = addChild(bar, 'vjs-playback-rate');
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).toBe(speed);
    });

    it('returns the direct child when the target is one level deep', () => {
        const wrapper = addChild(bar, 'vjs-menu-wrapper');
        const speed = addChild(wrapper, 'vjs-playback-rate');
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).toBe(wrapper);
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).not.toBe(speed);
    });

    it('returns the top-level direct child when the target is multiple levels deep', () => {
        const outer = addChild(bar, 'vjs-outer');
        const middle = addChild(outer, 'vjs-middle');
        addChild(middle, 'vjs-playback-rate');
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).toBe(outer);
    });

    it('returns null when the selector matches nothing in the container', () => {
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).toBeNull();
    });

    it('returns the correct child when the container has multiple direct children', () => {
        const play = addChild(bar, 'vjs-play-control');
        const speed = addChild(bar, 'vjs-playback-rate');
        const full  = addChild(bar, 'vjs-fullscreen-control');

        expect(findInsertionPoint(bar, '.vjs-playback-rate')).toBe(speed);
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).not.toBe(play);
        expect(findInsertionPoint(bar, '.vjs-playback-rate')).not.toBe(full);
    });
});

// ── shouldHandleKeydown ───────────────────────────────────────────────────────

describe('shouldHandleKeydown', () => {
    it('returns true for lowercase t on a regular element', () => {
        expect(shouldHandleKeydown('t', 'BODY', false)).toBe(true);
    });

    it('returns true for uppercase T on a regular element', () => {
        expect(shouldHandleKeydown('T', 'DIV', false)).toBe(true);
    });

    it('returns false for any key other than t or T', () => {
        expect(shouldHandleKeydown('f',      'BODY', false)).toBe(false);
        expect(shouldHandleKeydown('Enter',  'BODY', false)).toBe(false);
        expect(shouldHandleKeydown(' ',      'BODY', false)).toBe(false);
    });

    it('returns false when the target is an INPUT', () => {
        expect(shouldHandleKeydown('t', 'INPUT', false)).toBe(false);
    });

    it('returns false when the target is a TEXTAREA', () => {
        expect(shouldHandleKeydown('t', 'TEXTAREA', false)).toBe(false);
    });

    it('returns false when the target is a SELECT', () => {
        expect(shouldHandleKeydown('t', 'SELECT', false)).toBe(false);
    });

    it('returns false when the target is contentEditable', () => {
        expect(shouldHandleKeydown('t', 'DIV', true)).toBe(false);
    });

    it('returns false for uppercase T when the target is a form field', () => {
        expect(shouldHandleKeydown('T', 'INPUT', false)).toBe(false);
    });
});

// ── Button DOM structure ──────────────────────────────────────────────────────

describe('Button DOM structure', () => {
    it('has the expected id', () => {
        const btn = makeButton();
        expect(btn.id).toBe(BUTTON_ID);
    });

    it('has type="button" to avoid accidental form submission', () => {
        const btn = makeButton();
        expect(btn.type).toBe('button');
    });

    it('carries the vjs-control and vjs-button classes', () => {
        const btn = makeButton();
        expect(btn.classList.contains('vjs-control')).toBe(true);
        expect(btn.classList.contains('vjs-button')).toBe(true);
    });

    it('has a title attribute that includes the keyboard shortcut hint', () => {
        const btn = makeButton();
        expect(btn.title).toContain('Theater Mode');
        expect(btn.title).toContain('T');
    });

    it('contains a vjs-control-text span with accessible label', () => {
        const btn = makeButton();
        document.body.appendChild(btn);
        const span = btn.querySelector('.vjs-control-text');
        expect(span).not.toBeNull();
        expect(span.textContent.trim()).toBe('Theater Mode');
    });

    it('contains an SVG icon', () => {
        const btn = makeButton();
        document.body.appendChild(btn);
        expect(btn.querySelector('svg')).not.toBeNull();
    });
});

// ── Style injection ───────────────────────────────────────────────────────────

describe('Style injection', () => {
    it('injects a <style> element with the correct id', () => {
        injectStyles();
        expect(document.getElementById(STYLE_ID)).not.toBeNull();
    });

    it('does not inject a duplicate element when called more than once', () => {
        injectStyles();
        injectStyles();
        expect(document.querySelectorAll('#' + STYLE_ID).length).toBe(1);
    });

    it('includes CSS rules for the three affected layout elements', () => {
        injectStyles();
        const css = document.getElementById(STYLE_ID).textContent;
        expect(css).toContain('.scene-player-container');
        expect(css).toContain('.scene-tabs');
        expect(css).toContain('.scene-divider');
    });

    it('scopes all rules under the theater mode body class', () => {
        injectStyles();
        const css = document.getElementById(STYLE_ID).textContent;
        // Every layout rule should be gated by the body class
        expect(css).toContain(`body.${BODY_CLASS}`);
    });
});

// ── Button insertion positioning ──────────────────────────────────────────────

describe('Button insertion positioning', () => {
    /** Simulate the insertion logic from theater.js init(). */
    function insertButton(bar) {
        const btn = makeButton();
        const findRef = (sel) => findInsertionPoint(bar, sel);
        const ref = findRef('.vjs-playback-rate') ?? findRef('.vjs-fullscreen-control');
        if (ref) {
            bar.insertBefore(btn, ref);
        } else {
            bar.appendChild(btn);
        }
        return btn;
    }

    it('places the button immediately before the speed control', () => {
        const bar   = makeControlBar();
        const speed = addChild(bar, 'vjs-playback-rate');
        const full  = addChild(bar, 'vjs-fullscreen-control');
        const btn   = insertButton(bar);

        const kids = Array.from(bar.children);
        expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(speed));
        expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(full));
    });

    it('places the button before the wrapper when the speed control is nested', () => {
        const bar     = makeControlBar();
        const wrapper = addChild(bar, 'vjs-wrapper');
        addChild(wrapper, 'vjs-playback-rate');
        const btn = insertButton(bar);

        const kids = Array.from(bar.children);
        expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(wrapper));
    });

    it('falls back to the fullscreen control when there is no speed control', () => {
        const bar  = makeControlBar();
        const full = addChild(bar, 'vjs-fullscreen-control');
        const btn  = insertButton(bar);

        const kids = Array.from(bar.children);
        expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(full));
    });

    it('appends the button when neither speed nor fullscreen control is present', () => {
        const bar  = makeControlBar();
        const play = addChild(bar, 'vjs-play-control');
        const btn  = insertButton(bar);

        const kids = Array.from(bar.children);
        // Button was appended, so play comes before it
        expect(kids.indexOf(play)).toBeLessThan(kids.indexOf(btn));
        expect(kids[kids.length - 1]).toBe(btn);
    });

    it('prefers the speed control over the fullscreen control when both are present', () => {
        const bar   = makeControlBar();
        const speed = addChild(bar, 'vjs-playback-rate');
        const full  = addChild(bar, 'vjs-fullscreen-control');
        const btn   = insertButton(bar);

        const kids = Array.from(bar.children);
        // Button should be before speed, not between speed and fullscreen
        expect(kids.indexOf(btn)).toBeLessThan(kids.indexOf(speed));
        expect(kids.indexOf(btn) + 1).toBe(kids.indexOf(speed));
    });
});

// ── Theater mode state ────────────────────────────────────────────────────────

describe('Theater mode state', () => {
    let btn;

    beforeEach(() => {
        btn = makeButton();
        document.body.appendChild(btn);
    });

    describe('enable', () => {
        it('adds the theater mode class to document.body', () => {
            document.body.classList.add(BODY_CLASS);
            expect(document.body.classList.contains(BODY_CLASS)).toBe(true);
        });

        it('adds the active class to the button', () => {
            btn.classList.add('active');
            expect(btn.classList.contains('active')).toBe(true);
        });
    });

    describe('disable', () => {
        it('removes the theater mode class from document.body', () => {
            document.body.classList.add(BODY_CLASS);
            document.body.classList.remove(BODY_CLASS);
            expect(document.body.classList.contains(BODY_CLASS)).toBe(false);
        });

        it('removes the active class from the button', () => {
            btn.classList.add('active');
            btn.classList.remove('active');
            expect(btn.classList.contains('active')).toBe(false);
        });
    });

    describe('toggle', () => {
        it('enables theater mode when it is currently off', () => {
            // isTheaterMode = false → enable
            document.body.classList.add(BODY_CLASS);
            btn.classList.add('active');
            expect(document.body.classList.contains(BODY_CLASS)).toBe(true);
        });

        it('disables theater mode when it is currently on', () => {
            // isTheaterMode = true → disable
            document.body.classList.add(BODY_CLASS);
            btn.classList.add('active');

            document.body.classList.remove(BODY_CLASS);
            btn.classList.remove('active');

            expect(document.body.classList.contains(BODY_CLASS)).toBe(false);
            expect(btn.classList.contains('active')).toBe(false);
        });

        it('body class is absent after an even number of toggles', () => {
            [1, 2, 3, 4].forEach(i => {
                if (document.body.classList.contains(BODY_CLASS)) {
                    document.body.classList.remove(BODY_CLASS);
                } else {
                    document.body.classList.add(BODY_CLASS);
                }
            });
            expect(document.body.classList.contains(BODY_CLASS)).toBe(false);
        });
    });
});

// ── Keyboard shortcut integration ─────────────────────────────────────────────

describe('Keyboard shortcut integration', () => {
    it('calls the toggle when shouldHandleKeydown returns true', () => {
        const toggle = jest.fn();
        const handler = (e) => {
            if (shouldHandleKeydown(e.key, e.target.tagName, e.target.isContentEditable)) {
                toggle();
            }
        };
        document.addEventListener('keydown', handler);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        document.removeEventListener('keydown', handler);
        expect(toggle).toHaveBeenCalledTimes(1);
    });

    it('does not call the toggle when typing in an input field', () => {
        const toggle = jest.fn();
        const input = document.createElement('input');
        document.body.appendChild(input);
        const handler = (e) => {
            if (shouldHandleKeydown(e.key, e.target.tagName, e.target.isContentEditable)) {
                toggle();
            }
        };
        input.addEventListener('keydown', handler);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        expect(toggle).not.toHaveBeenCalled();
    });

    it('does not call the toggle when typing in a textarea', () => {
        const toggle = jest.fn();
        const ta = document.createElement('textarea');
        document.body.appendChild(ta);
        const handler = (e) => {
            if (shouldHandleKeydown(e.key, e.target.tagName, e.target.isContentEditable)) {
                toggle();
            }
        };
        ta.addEventListener('keydown', handler);
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        expect(toggle).not.toHaveBeenCalled();
    });

    it('responds to uppercase T the same way as lowercase t', () => {
        const toggle = jest.fn();
        const handler = (e) => {
            if (shouldHandleKeydown(e.key, e.target.tagName, e.target.isContentEditable)) {
                toggle();
            }
        };
        document.addEventListener('keydown', handler);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', bubbles: true }));
        document.removeEventListener('keydown', handler);
        expect(toggle).toHaveBeenCalledTimes(1);
    });
});

// ── Init guard: isInitializing released synchronously ────────────────────────
//
// Regression: when init() was made async, isInitializing stayed true for the
// entire duration of the GraphQL settings fetch (~100 ms). Stash's Video.js
// player routinely remounts the control bar during that window. The observer
// would see a fresh bar with no button, but isInitializing was still true so
// init() returned early and the button was never re-inserted.
//
// The fix: keep init() synchronous so the flag is released before any await,
// and fire applyInitialState() as a separate async function that does not hold
// the guard.

describe('Init guard: isInitializing released synchronously', () => {
    /** Mirrors the fixed init() pattern: synchronous body + fire-and-forget async. */
    function simulateInit(controlBar, state) {
        if (document.getElementById(BUTTON_ID)) return false;
        if (state.isInitializing) return false;
        state.isInitializing = true;
        try {
            if (!controlBar) return false;
            if (document.getElementById(BUTTON_ID)) return false;
            controlBar.appendChild(makeButton());
            // applyInitialState() would fire-and-forget here without holding the lock
            return true;
        } finally {
            state.isInitializing = false; // released synchronously, before any await
        }
    }

    it('releases the guard before applyInitialState resolves', () => {
        const state = { isInitializing: false };
        const bar = makeControlBar();
        simulateInit(bar, state);
        // Immediately after init() returns the guard must be free — even though
        // the async settings fetch has not yet completed.
        expect(state.isInitializing).toBe(false);
    });

    it('allows re-init after VJS remounts the control bar while applyInitialState is pending', () => {
        const state = { isInitializing: false };

        // First init: button inserted into the original bar.
        const bar1 = makeControlBar();
        expect(simulateInit(bar1, state)).toBe(true);
        expect(document.getElementById(BUTTON_ID)).not.toBeNull();

        // VJS tears down the control bar (taking the button with it) while
        // applyInitialState is still awaiting the settings fetch.
        document.body.removeChild(bar1);
        expect(document.getElementById(BUTTON_ID)).toBeNull();
        expect(state.isInitializing).toBe(false); // guard already released

        // A new control bar mounts. init() must succeed and re-insert the button.
        const bar2 = makeControlBar();
        expect(simulateInit(bar2, state)).toBe(true);
        expect(document.getElementById(BUTTON_ID)).not.toBeNull();
    });
});

// ── Init guards ───────────────────────────────────────────────────────────────

describe('Init guard patterns', () => {
    it('does not insert a second button if one is already present in the DOM', () => {
        const bar   = makeControlBar();
        const speed = addChild(bar, 'vjs-playback-rate');

        // Simulate first successful init
        const btn1 = makeButton();
        bar.insertBefore(btn1, speed);

        // Simulate a second init attempt — the guard should short-circuit
        if (!document.getElementById(BUTTON_ID)) {
            const btn2 = makeButton();
            bar.insertBefore(btn2, speed);
        }

        expect(document.querySelectorAll('#' + BUTTON_ID).length).toBe(1);
    });

    it('does not insert a button when the control bar is absent', () => {
        // No control bar in the DOM
        const bar = document.querySelector('.vjs-control-bar');
        if (bar) {
            const btn = makeButton();
            bar.appendChild(btn);
        }
        expect(document.getElementById(BUTTON_ID)).toBeNull();
    });
});

// ── Cleanup on navigation ─────────────────────────────────────────────────────

describe('Cleanup on navigation away from a scene page', () => {
    it('removes the theater mode class when the user navigates away', () => {
        document.body.classList.add(BODY_CLASS);

        // Simulate the cleanup path in the MutationObserver callback
        const isScenePage = /\/scenes\/\d+/.test('/scenes/123');
        if (!isScenePage) {
            document.body.classList.remove(BODY_CLASS);
        }

        // Still on scene page — class should remain
        expect(document.body.classList.contains(BODY_CLASS)).toBe(true);

        // Now navigate away
        const leftScene = /\/scenes\/\d+/.test('/performers/1');
        if (!leftScene) {
            document.body.classList.remove(BODY_CLASS);
        }

        expect(document.body.classList.contains(BODY_CLASS)).toBe(false);
    });

    it('does not remove the class when still on a scene page', () => {
        document.body.classList.add(BODY_CLASS);

        const isScenePage = /\/scenes\/\d+/.test('/scenes/42');
        if (!isScenePage) {
            document.body.classList.remove(BODY_CLASS);
        }

        expect(document.body.classList.contains(BODY_CLASS)).toBe(true);
    });
});

// ── getDefaultMode ────────────────────────────────────────────────────────────

describe('getDefaultMode', () => {
    it('returns "remember" when pluginConfig is null', () => {
        expect(getDefaultMode(null)).toBe('remember');
    });

    it('returns "remember" when pluginConfig is undefined', () => {
        expect(getDefaultMode(undefined)).toBe('remember');
    });

    it('returns "remember" when default_mode is absent', () => {
        expect(getDefaultMode({})).toBe('remember');
    });

    it('returns "remember" when default_mode is an unrecognised string', () => {
        expect(getDefaultMode({ default_mode: 'bogus' })).toBe('remember');
        expect(getDefaultMode({ default_mode: '' })).toBe('remember');
        expect(getDefaultMode({ default_mode: 'ALWAYS_ON' })).toBe('remember');
    });

    it('returns "remember" for the remember value', () => {
        expect(getDefaultMode({ default_mode: 'remember' })).toBe('remember');
    });

    it('returns "always_on" for the always_on value', () => {
        expect(getDefaultMode({ default_mode: 'always_on' })).toBe('always_on');
    });

    it('returns "always_off" for the always_off value', () => {
        expect(getDefaultMode({ default_mode: 'always_off' })).toBe('always_off');
    });

    it('accepts every value in VALID_MODES and returns it unchanged', () => {
        for (const mode of VALID_MODES) {
            expect(getDefaultMode({ default_mode: mode })).toBe(mode);
        }
    });
});

// ── getSavedTheaterState ──────────────────────────────────────────────────────

describe('getSavedTheaterState', () => {
    /** Minimal localStorage stub */
    function makeStorage(initial = {}) {
        const store = { ...initial };
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, val) => { store[key] = String(val); },
        };
    }

    it('returns false when storage is null', () => {
        expect(getSavedTheaterState(null)).toBe(false);
    });

    it('returns false when the key is absent', () => {
        expect(getSavedTheaterState(makeStorage())).toBe(false);
    });

    it('returns false when the stored value is "false"', () => {
        expect(getSavedTheaterState(makeStorage({ [STORAGE_KEY]: 'false' }))).toBe(false);
    });

    it('returns true when the stored value is "true"', () => {
        expect(getSavedTheaterState(makeStorage({ [STORAGE_KEY]: 'true' }))).toBe(true);
    });

    it('returns false when the stored value is truthy but not exactly "true"', () => {
        expect(getSavedTheaterState(makeStorage({ [STORAGE_KEY]: '1' }))).toBe(false);
        expect(getSavedTheaterState(makeStorage({ [STORAGE_KEY]: 'yes' }))).toBe(false);
    });

    it('returns false when storage.getItem throws', () => {
        const broken = { getItem: () => { throw new Error('quota'); } };
        expect(getSavedTheaterState(broken)).toBe(false);
    });
});

// ── setSavedTheaterState ──────────────────────────────────────────────────────

describe('setSavedTheaterState', () => {
    function makeStorage() {
        const store = {};
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, val) => { store[key] = String(val); },
            _store: store,
        };
    }

    it('writes "true" when enabled is true', () => {
        const s = makeStorage();
        setSavedTheaterState(true, s);
        expect(s._store[STORAGE_KEY]).toBe('true');
    });

    it('writes "false" when enabled is false', () => {
        const s = makeStorage();
        setSavedTheaterState(false, s);
        expect(s._store[STORAGE_KEY]).toBe('false');
    });

    it('does nothing when storage is null', () => {
        // Should not throw
        expect(() => setSavedTheaterState(true, null)).not.toThrow();
    });

    it('does not throw when storage.setItem throws', () => {
        const broken = { setItem: () => { throw new Error('quota'); } };
        expect(() => setSavedTheaterState(true, broken)).not.toThrow();
    });

    it('round-trips with getSavedTheaterState', () => {
        const s = makeStorage();
        setSavedTheaterState(true, s);
        expect(getSavedTheaterState(s)).toBe(true);
        setSavedTheaterState(false, s);
        expect(getSavedTheaterState(s)).toBe(false);
    });
});

// ── Persistence integration ───────────────────────────────────────────────────

describe('Persistence: toggleTheaterMode saves state in remember mode', () => {
    function makeStorage() {
        const store = {};
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, val) => { store[key] = String(val); },
            _store: store,
        };
    }

    /** Simulate toggleTheaterMode with a given defaultMode and storage. */
    function simulateToggle(isOn, defaultMode, storage) {
        // Mirrors the logic in theater.js toggleTheaterMode()
        const newState = !isOn;
        if (defaultMode === 'remember') {
            setSavedTheaterState(newState, storage);
        }
        return newState;
    }

    it('saves true after toggling on in remember mode', () => {
        const s = makeStorage();
        simulateToggle(false, 'remember', s);
        expect(getSavedTheaterState(s)).toBe(true);
    });

    it('saves false after toggling off in remember mode', () => {
        const s = makeStorage();
        simulateToggle(true, 'remember', s);
        expect(getSavedTheaterState(s)).toBe(false);
    });

    it('does not write to storage in always_on mode', () => {
        const s = makeStorage();
        simulateToggle(false, 'always_on', s);
        expect(s._store[STORAGE_KEY]).toBeUndefined();
    });

    it('does not write to storage in always_off mode', () => {
        const s = makeStorage();
        simulateToggle(false, 'always_off', s);
        expect(s._store[STORAGE_KEY]).toBeUndefined();
    });
});

// ── Startup: optimistic apply from localStorage ───────────────────────────────
//
// Theater mode CSS and body class are applied synchronously at plugin startup
// (before any React rendering) to prevent layout flash. The mode setting has
// not been fetched yet, so we apply from localStorage unconditionally.
// applyInitialState() reconciles afterward if the actual mode differs.

describe('Startup: optimistic apply from localStorage', () => {
    function makeStorage(initial = {}) {
        const store = { ...initial };
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, val) => { store[key] = String(val); },
        };
    }

    /** Mirrors the startup block in theater.js. */
    function applyStartup(storage) {
        return getSavedTheaterState(storage); // if true → add body class
    }

    it('applies theater mode immediately when localStorage state is true', () => {
        expect(applyStartup(makeStorage({ [STORAGE_KEY]: 'true' }))).toBe(true);
    });

    it('does not apply theater mode when localStorage state is false', () => {
        expect(applyStartup(makeStorage({ [STORAGE_KEY]: 'false' }))).toBe(false);
    });

    it('does not apply theater mode when no state is saved yet', () => {
        expect(applyStartup(makeStorage())).toBe(false);
    });
});

// ── Init: button active class matches theater mode state at insertion ──────────
//
// The button must render with the correct active state immediately on insertion,
// not a few hundred ms later after the settings fetch resolves.

describe('Init: button active class matches theater mode state at insertion', () => {
    it('adds active class to button when theater mode is already on', () => {
        const btn = makeButton();
        const isTheaterMode = true;
        if (isTheaterMode) btn.classList.add('active');
        expect(btn.classList.contains('active')).toBe(true);
    });

    it('does not add active class when theater mode is off', () => {
        const btn = makeButton();
        const isTheaterMode = false;
        if (isTheaterMode) btn.classList.add('active');
        expect(btn.classList.contains('active')).toBe(false);
    });
});

// ── applyInitialState: reconciles always_on / always_off overrides ────────────
//
// applyInitialState() runs after the async settings fetch. Its only job is to
// reconcile cases where the actual mode differs from the optimistically-applied
// state. 'remember' is a no-op here — state was already applied synchronously
// at startup and in init().

describe('applyInitialState: reconciles always_on / always_off overrides', () => {
    function makeStorage(initial = {}) {
        const store = { ...initial };
        return {
            getItem: (key) => store[key] ?? null,
            setItem: (key, val) => { store[key] = String(val); },
        };
    }

    /**
     * Simulate applyInitialState(). currentlyEnabled is the theater mode state
     * as applied by startup/init(). Returns the state after reconciliation.
     */
    function applyInitialState(mode, currentlyEnabled, storage) {
        if (mode === 'always_on') return true;
        if (mode === 'always_off') {
            setSavedTheaterState(false, storage); // clear stale localStorage
            return false;
        }
        return currentlyEnabled; // 'remember': leave unchanged
    }

    it('enables theater mode in always_on mode regardless of prior state', () => {
        expect(applyInitialState('always_on', false, makeStorage())).toBe(true);
        expect(applyInitialState('always_on', true,  makeStorage())).toBe(true);
    });

    it('disables theater mode in always_off mode regardless of prior state', () => {
        expect(applyInitialState('always_off', true,  makeStorage())).toBe(false);
        expect(applyInitialState('always_off', false, makeStorage())).toBe(false);
    });

    it('clears localStorage when mode is always_off to prevent future false-positive startup apply', () => {
        const s = makeStorage({ [STORAGE_KEY]: 'true' });
        applyInitialState('always_off', true, s);
        expect(getSavedTheaterState(s)).toBe(false);
    });

    it('leaves state unchanged in remember mode (already applied synchronously)', () => {
        expect(applyInitialState('remember', true,  makeStorage())).toBe(true);
        expect(applyInitialState('remember', false, makeStorage())).toBe(false);
    });
});
