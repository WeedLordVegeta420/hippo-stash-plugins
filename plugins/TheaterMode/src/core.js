/**
 * Core utilities for TheaterMode plugin.
 * Extracted here so they can be unit-tested without a running Stash instance.
 */

/**
 * Given a container element and a CSS selector for a descendant, returns the
 * direct child of `container` that is an ancestor of (or is) the first
 * matching descendant.
 *
 * This is used as the reference node for insertBefore, which requires the
 * reference to be a direct child of the parent element.  Because the element
 * is located via container.querySelector(), it is guaranteed to be a
 * descendant of container, so walking up the parent chain always terminates.
 *
 * @param {Element} container - The parent element (e.g. .vjs-control-bar)
 * @param {string} selector   - CSS selector for the target descendant
 * @returns {Element|null}      Direct child of container to insert before, or
 *                              null if no matching descendant exists
 */
function findInsertionPoint(container, selector) {
    const target = container.querySelector(selector);
    if (!target) return null;
    let ref = target;
    while (ref.parentElement !== container) {
        ref = ref.parentElement;
    }
    return ref;
}

/**
 * Returns true if a keydown event should trigger the theater mode toggle.
 *
 * The toggle is suppressed when the user is typing: in a form control
 * (INPUT, TEXTAREA, SELECT) or a contentEditable element.
 *
 * @param {string}  key               - e.key value
 * @param {string}  tagName           - e.target.tagName
 * @param {boolean} isContentEditable - e.target.isContentEditable
 * @returns {boolean}
 */
function shouldHandleKeydown(key, tagName, isContentEditable) {
    if (key !== 't' && key !== 'T') return false;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return false;
    if (isContentEditable) return false;
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { findInsertionPoint, shouldHandleKeydown };
}
