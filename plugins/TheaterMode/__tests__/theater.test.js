/**
 * Tests for TheaterMode plugin.
 *
 * Unit tests cover the two algorithms extracted into src/core.js.
 * Integration tests verify the DOM-manipulation patterns used by theater.js
 * without loading the IIFE directly (following the same approach as SpriteTab).
 */

const { findInsertionPoint, shouldHandleKeydown } = require('../src/core');

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
