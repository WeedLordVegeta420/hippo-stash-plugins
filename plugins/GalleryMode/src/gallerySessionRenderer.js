/**
 * Gallery session renderer.
 *
 * Single rendering boundary that updates the DOM from reducer state.
 * Keeps the current overlay markup and CSS intact.
 * Designed to be replaceable by a React component tree later.
 */

const Selectors = require('./gallerySessionSelectors');
const { normalizeGalleryTime } = require('./core');
function renderGalleryOverlay(state, ctx) {
    const overlay = ctx.overlay;
    if (!overlay) return;

    const time = Selectors.getRequestedTime(state) ?? 0;

    // --- Time display ---
    const timeEl = overlay.querySelector('#sprite-gallery-time');
    if (timeEl && ctx.formatTime) {
        timeEl.textContent = ctx.formatTime(normalizeGalleryTime(time));
    }

    // --- Controls visibility ---
    const controls = overlay.querySelector('#sprite-gallery-controls');
    if (controls) {
        const visible = Selectors.isControlsVisible(state);
        controls.dataset.visible = String(visible);
        controls.classList.toggle('gallery-controls-visible', visible);
    }

    // --- Scrubber ---
    const scrubber = overlay.querySelector('#sprite-gallery-scrubber');
    if (scrubber) {
        const spriteInterval = ctx.getGallerySpriteIntervalSeconds
            ? ctx.getGallerySpriteIntervalSeconds()
            : 0.1;
        const scrubberState = Selectors.getScrubberState(state, spriteInterval);
        scrubber.max = String(scrubberState.max);
        scrubber.value = String(scrubberState.value);
        scrubber.disabled = scrubberState.disabled;
        scrubber.step = String(scrubberState.step);
        scrubber.style.display = ctx.shouldShowGalleryScrubber
            ? (ctx.shouldShowGalleryScrubber() ? 'block' : 'none')
            : 'none';
    }

    // --- Fullscreen button ---
    const fullscreenBtn = overlay.querySelector('#sprite-gallery-fullscreen');
    if (fullscreenBtn) {
        const fsState = Selectors.getFullscreenButtonState(state);
        fullscreenBtn.disabled = !Selectors.hasVisibleFrame(state) && !fsState.active;
        fullscreenBtn.textContent = fsState.active ? 'Exit fullscreen' : 'Fullscreen';
    }

    // --- Full resolution button ---
    const fullResolutionBtn = overlay.querySelector('#sprite-gallery-full-resolution');
    if (fullResolutionBtn) {
        if (!Selectors.isLowBandwidth(state)) {
            fullResolutionBtn.style.display = 'none';
        } else {
            fullResolutionBtn.style.display = '';
            const canRequest = Selectors.canRequestFullResolution(state);
            fullResolutionBtn.disabled = !canRequest;
            fullResolutionBtn.textContent = Selectors.isFullResolutionPending(state)
                ? 'Requesting full resolution...'
                : 'Request full resolution';
        }
    }

    // --- Jump buttons ---
    if (ctx.jumpButtons) {
        const hasCached = ctx.hasGalleryCachedFrame || (() => false);
        const buttonStates = Selectors.getJumpButtonStates(state, ctx.jumpButtons, hasCached);
        const stateByDelta = new Map(buttonStates.map((b) => [b.delta, b]));
        overlay.querySelectorAll('.sprite-gallery-jump-btn').forEach((button) => {
            const match = stateByDelta.get(parseFloat(button.dataset.delta ?? '0'));
            if (!match) return;
            button.disabled = match.disabled;
            button.dataset.cached = match.cached ? 'true' : 'false';
            button.classList.toggle('sprite-gallery-jump-btn-cached', match.cached);
        });
    }

    // --- Debug panel ---
    const debugPanel = overlay.querySelector('#sprite-gallery-debug');
    if (debugPanel) {
        debugPanel.hidden = !Selectors.isDebugEnabled(state);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderGalleryOverlay };
}
