/**
 * Gallery session store.
 *
 * Holds the authoritative state, dispatches events through the reducer,
 * notifies subscribers, and runs effects via an injected runner.
 *
 * Designed to be compatible with React's useSyncExternalStore.
 */

const { createInitialState } = require('./gallerySessionState');
const { reduce } = require('./gallerySessionReducer');

/**
 * Create a gallery store.
 *
 * @param {object} options
 * @param {function} options.runEffect - (effect, getState, dispatch, ctx) => void
 * @param {object}   options.ctx      - Runtime context (DOM refs, timers, socket, etc.)
 * @returns {{ getState, dispatch, subscribe, destroy }}
 */
function createStore({ runEffect, ctx } = {}) {
    let state = createInitialState();
    let listeners = new Set();
    let dispatching = false;
    let pendingEffects = [];

    function getState() {
        return state;
    }

    function subscribe(listener) {
        listeners.add(listener);
        return function unsubscribe() {
            listeners.delete(listener);
        };
    }

    function notify() {
        listeners.forEach((listener) => {
            try { listener(state); } catch (_) { /* swallow */ }
        });
    }

    function dispatch(event) {
        const prevState = state;
        const result = reduce(state, event);
        state = result.state;

        if (result.effects.length > 0) {
            if (dispatching) {
                pendingEffects.push(...result.effects);
            } else {
                pendingEffects.push(...result.effects);
                dispatching = true;
                try {
                    while (pendingEffects.length > 0) {
                        const effect = pendingEffects.shift();
                        if (runEffect) {
                            runEffect(effect, getState, dispatch, ctx);
                        }
                    }
                } finally {
                    dispatching = false;
                }
            }
        }

        if (state !== prevState) {
            notify();
        }
    }

    function destroy() {
        listeners.clear();
        state = createInitialState();
        pendingEffects = [];
    }

    /**
     * Replace the current state (for test state management / migration).
     */
    function replaceState(newState) {
        state = newState;
        notify();
    }

    return {
        getState,
        dispatch,
        subscribe,
        destroy,
        replaceState
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createStore };
}
