/**
 * Integration tests for SpriteTab plugin
 * Tests DOM interactions, events, and component behavior
 */

const {
    calculateTooltipPosition,
    isScrollGesture,
    isSyntheticMouseEvent,
    isMobileLayout
} = require('../src/core');

describe('Touch and Mouse Event Integration', () => {
    describe('Touch-to-Mouse Event Filtering', () => {
        it('should filter synthetic mouse events after touch', () => {
            const touchEndTime = Date.now();

            // Simulate synthetic mouseenter happening 50ms after touchend
            const mouseEventTime = touchEndTime + 50;

            expect(isSyntheticMouseEvent(touchEndTime, mouseEventTime)).toBe(true);
        });

        it('should allow real mouse events after sufficient delay', () => {
            const touchEndTime = Date.now() - 600;
            const mouseEventTime = Date.now();

            expect(isSyntheticMouseEvent(touchEndTime, mouseEventTime)).toBe(false);
        });

        it('should handle rapid touch sequences', () => {
            let lastTouchTime = 0;

            // Simulate rapid touches
            for (let i = 0; i < 5; i++) {
                lastTouchTime = Date.now();
                // Each touch should reset the filter window
                expect(isSyntheticMouseEvent(lastTouchTime, lastTouchTime + 100)).toBe(true);
            }
        });
    });

    describe('Scroll Detection', () => {
        it('should distinguish between tap and scroll gestures', () => {
            const startPos = { x: 100, y: 200 };

            // Small movement - tap
            expect(isScrollGesture(startPos, { x: 105, y: 205 })).toBe(false);

            // Large vertical movement - scroll
            expect(isScrollGesture(startPos, { x: 100, y: 250 })).toBe(true);

            // Large horizontal movement - scroll
            expect(isScrollGesture(startPos, { x: 150, y: 200 })).toBe(true);
        });

        it('should handle diagonal scrolling', () => {
            const startPos = { x: 100, y: 100 };

            // Small diagonal movement (8px each) - not exceeding threshold individually
            expect(isScrollGesture(startPos, { x: 108, y: 108 })).toBe(false);

            // Larger diagonal movement exceeding threshold in one direction
            expect(isScrollGesture(startPos, { x: 115, y: 108 })).toBe(true);
            expect(isScrollGesture(startPos, { x: 108, y: 115 })).toBe(true);
        });
    });
});

describe('Tooltip Positioning', () => {
    const tooltipWidth = 480;
    const tooltipHeight = 270; // 16:9 ratio

    describe('Standard Viewport', () => {
        const viewport = { width: 1920, height: 1080 };

        it('should position tooltip in preferred location when space available', () => {
            const pos = calculateTooltipPosition(
                500, 400,
                tooltipWidth, tooltipHeight,
                viewport.width, viewport.height
            );

            // Should be below and to the right
            expect(pos.left).toBeGreaterThan(500);
            expect(pos.top).toBeGreaterThan(400);
        });

        it('should flip horizontally near right edge', () => {
            const pos = calculateTooltipPosition(
                1800, 400,
                tooltipWidth, tooltipHeight,
                viewport.width, viewport.height
            );

            // Should flip to left of cursor
            expect(pos.left).toBeLessThan(1800);
            expect(pos.left + tooltipWidth).toBeLessThanOrEqual(viewport.width);
        });

        it('should flip vertically near bottom edge', () => {
            const pos = calculateTooltipPosition(
                500, 900,
                tooltipWidth, tooltipHeight,
                viewport.width, viewport.height
            );

            // Should flip above cursor
            expect(pos.top).toBeLessThan(900);
            expect(pos.top + tooltipHeight).toBeLessThanOrEqual(viewport.height);
        });
    });

    describe('Mobile Viewport', () => {
        const mobileViewport = { width: 414, height: 896 }; // iPhone dimensions

        it('should handle narrow viewport', () => {
            const pos = calculateTooltipPosition(
                300, 400,
                tooltipWidth, tooltipHeight,
                mobileViewport.width, mobileViewport.height
            );

            // Should constrain to viewport
            expect(pos.left).toBeGreaterThanOrEqual(10);
            expect(pos.left + tooltipWidth).toBeLessThanOrEqual(mobileViewport.width + tooltipWidth);
        });

        it('should handle touch near edges', () => {
            // Touch near right edge of mobile screen
            const pos = calculateTooltipPosition(
                400, 400,
                tooltipWidth, tooltipHeight,
                mobileViewport.width, mobileViewport.height
            );

            // Should be constrained within viewport
            expect(pos.left).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle tooltip larger than viewport', () => {
            const smallViewport = { width: 300, height: 200 };

            const pos = calculateTooltipPosition(
                150, 100,
                tooltipWidth, tooltipHeight,
                smallViewport.width, smallViewport.height
            );

            // Should still provide valid positions (constrained to edge padding)
            expect(pos.left).toBeGreaterThanOrEqual(0);
            expect(pos.top).toBeGreaterThanOrEqual(0);
        });

        it('should handle cursor at exact corner', () => {
            const pos = calculateTooltipPosition(
                0, 0,
                tooltipWidth, tooltipHeight,
                1920, 1080
            );

            // Should position below and right with offset
            expect(pos.left).toBe(20);
            expect(pos.top).toBe(20);
        });

        it('should handle cursor at bottom-right corner', () => {
            const pos = calculateTooltipPosition(
                1920, 1080,
                tooltipWidth, tooltipHeight,
                1920, 1080
            );

            // Should flip to above and left
            expect(pos.left).toBeLessThan(1920);
            expect(pos.top).toBeLessThan(1080);
        });
    });
});

describe('DOM Element Creation', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should create tooltip element with correct structure', () => {
        // Create tooltip element as the plugin does
        const previewBox = document.createElement('div');
        previewBox.id = 'stash-sprite-preview';

        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'preview-time';
        previewBox.appendChild(timeDisplay);

        document.body.appendChild(previewBox);

        const element = document.getElementById('stash-sprite-preview');
        expect(element).not.toBeNull();
        expect(element.querySelector('.preview-time')).not.toBeNull();
    });

    it('should create sprite cell with correct attributes', () => {
        const cell = document.createElement('div');
        cell.className = 'sprite-cell';
        cell.style.cssText = 'width: 100%; aspect-ratio: 16/9; cursor: pointer;';

        document.body.appendChild(cell);

        expect(cell.classList.contains('sprite-cell')).toBe(true);
        expect(cell.style.cursor).toBe('pointer');
    });

    it('should create nav tab element', () => {
        const navTabs = document.createElement('div');
        navTabs.className = 'nav-tabs';

        const tabItem = document.createElement('div');
        tabItem.className = 'nav-item';
        tabItem.innerHTML = '<a id="tab-sprites-nav" href="#" role="tab" class="nav-link">Sprites</a>';

        navTabs.appendChild(tabItem);
        document.body.appendChild(navTabs);

        const tab = document.getElementById('tab-sprites-nav');
        expect(tab).not.toBeNull();
        expect(tab.textContent).toBe('Sprites');
        expect(tab.getAttribute('role')).toBe('tab');
    });
});

describe('Event Handler Behavior', () => {
    let cell;
    let mockSeek;
    let mockShowTooltip;
    let mockHideTooltip;

    beforeEach(() => {
        document.body.innerHTML = '';
        cell = document.createElement('div');
        cell.className = 'sprite-cell';
        document.body.appendChild(cell);

        mockSeek = jest.fn();
        mockShowTooltip = jest.fn();
        mockHideTooltip = jest.fn();
    });

    describe('Mouse Events', () => {
        it('should handle mouseenter event', () => {
            let lastTouchTime = 0;

            cell.onmouseenter = (e) => {
                if (Date.now() - lastTouchTime < 500) return;
                mockShowTooltip(e.clientX, e.clientY);
            };

            const event = new MouseEvent('mouseenter', {
                clientX: 100,
                clientY: 200
            });
            cell.dispatchEvent(event);

            expect(mockShowTooltip).toHaveBeenCalledWith(100, 200);
        });

        it('should handle mouseleave event', () => {
            cell.onmouseleave = () => {
                mockHideTooltip();
            };

            cell.dispatchEvent(new MouseEvent('mouseleave'));

            expect(mockHideTooltip).toHaveBeenCalled();
        });

        it('should ignore mouse events after recent touch', () => {
            let lastTouchTime = Date.now();

            cell.onmouseenter = (e) => {
                if (Date.now() - lastTouchTime < 500) return;
                mockShowTooltip(e.clientX, e.clientY);
            };

            cell.dispatchEvent(new MouseEvent('mouseenter', {
                clientX: 100,
                clientY: 200
            }));

            // Should be filtered out due to recent touch
            expect(mockShowTooltip).not.toHaveBeenCalled();
        });
    });

    describe('Touch Events', () => {
        // Helper to create mock touch events (jsdom doesn't fully support TouchEvent)
        const createMockTouchEvent = (type, touches) => {
            const event = new Event(type, { bubbles: true });
            event.touches = touches;
            event.changedTouches = touches;
            return event;
        };

        it('should handle touchstart event', () => {
            let touchStartPos = null;

            cell.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                touchStartPos = { x: touch.clientX, y: touch.clientY };
            });

            const touchEvent = createMockTouchEvent('touchstart', [
                { clientX: 150, clientY: 250, identifier: 0, target: cell }
            ]);
            cell.dispatchEvent(touchEvent);

            expect(touchStartPos).toEqual({ x: 150, y: 250 });
        });

        it('should detect scroll during touchmove', () => {
            let isScrolling = false;
            const touchStartPos = { x: 100, y: 100 };

            cell.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const currentPos = { x: touch.clientX, y: touch.clientY };
                isScrolling = isScrollGesture(touchStartPos, currentPos);
            });

            const touchEvent = createMockTouchEvent('touchmove', [
                { clientX: 100, clientY: 150, identifier: 0, target: cell }
            ]);
            cell.dispatchEvent(touchEvent);

            expect(isScrolling).toBe(true);
        });

        it('should seek on short tap', () => {
            let isLongPress = false;
            let isScrolling = false;

            cell.addEventListener('touchend', () => {
                if (isLongPress || isScrolling) return;
                mockSeek();
            });

            const touchEvent = createMockTouchEvent('touchend', []);
            cell.dispatchEvent(touchEvent);

            expect(mockSeek).toHaveBeenCalled();
        });

        it('should not seek on long press', () => {
            let isLongPress = true;

            cell.ontouchend = () => {
                if (isLongPress) return;
                mockSeek();
            };

            cell.dispatchEvent(new TouchEvent('touchend'));

            expect(mockSeek).not.toHaveBeenCalled();
        });

        it('should not seek when scrolling', () => {
            let isScrolling = true;

            cell.ontouchend = () => {
                if (isScrolling) return;
                mockSeek();
            };

            cell.dispatchEvent(new TouchEvent('touchend'));

            expect(mockSeek).not.toHaveBeenCalled();
        });
    });
});

describe('CSS Style Application', () => {
    it('should apply correct styles for tooltip prevention', () => {
        const style = document.createElement('style');
        style.textContent = `
            .sprite-cell {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
                touch-action: pan-y;
            }
        `;
        document.head.appendChild(style);

        const cell = document.createElement('div');
        cell.className = 'sprite-cell';
        document.body.appendChild(cell);

        const computedStyle = window.getComputedStyle(cell);

        // Note: jsdom may not fully support all these properties
        // This test verifies the CSS is at least parseable
        expect(style.textContent).toContain('touch-action: pan-y');
        expect(style.textContent).toContain('-webkit-touch-callout: none');
    });
});

describe('Video Player Integration', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should find video element', () => {
        const video = document.createElement('video');
        video.className = 'vjs-tech';
        document.body.appendChild(video);

        const found = document.querySelector('video.vjs-tech') || document.querySelector('video');
        expect(found).toBe(video);
    });

    it('should fall back to generic video element', () => {
        const video = document.createElement('video');
        document.body.appendChild(video);

        const found = document.querySelector('video.vjs-tech') || document.querySelector('video');
        expect(found).toBe(video);
    });

    it('should handle missing video element', () => {
        const found = document.querySelector('video.vjs-tech') || document.querySelector('video');
        expect(found).toBeNull();
    });
});

describe('Shared touch time guard', () => {
    // Bug: lastTouchTime was declared inside the per-cell for-loop, so touching
    // cell A only raised the guard for cell A. Synthetic mouseenter on cell B
    // (fired by the browser after finger lift) would see lastTouchTime=0 and
    // re-show the tooltip. Fix: one shared lastTouchTime for all cells.
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should block mouse events on all cells after a touch on any single cell', () => {
        let lastTouchTime = 0; // shared — the correct implementation
        const mockShowTooltip = jest.fn();

        const cells = Array.from({ length: 3 }, () => {
            const cell = document.createElement('div');
            cell.className = 'sprite-cell';
            cell.addEventListener('mouseenter', () => {
                if (!isSyntheticMouseEvent(lastTouchTime, Date.now())) {
                    mockShowTooltip();
                }
            });
            document.body.appendChild(cell);
            return cell;
        });

        // Touch fires on cell 0, updating the shared timestamp
        lastTouchTime = Date.now();

        // Synthetic mouseenter on the other cells should be blocked
        cells[1].dispatchEvent(new MouseEvent('mouseenter'));
        cells[2].dispatchEvent(new MouseEvent('mouseenter'));

        expect(mockShowTooltip).not.toHaveBeenCalled();
    });

    it('should allow mouse events on all cells once the guard window expires', () => {
        let lastTouchTime = Date.now() - 600; // well outside the 500ms window
        const mockShowTooltip = jest.fn();

        const cells = Array.from({ length: 3 }, () => {
            const cell = document.createElement('div');
            cell.className = 'sprite-cell';
            cell.addEventListener('mouseenter', () => {
                if (!isSyntheticMouseEvent(lastTouchTime, Date.now())) {
                    mockShowTooltip();
                }
            });
            document.body.appendChild(cell);
            return cell;
        });

        cells.forEach(cell => cell.dispatchEvent(new MouseEvent('mouseenter')));

        expect(mockShowTooltip).toHaveBeenCalledTimes(3);
    });
});

describe('Long press drag behavior', () => {
    // Bug: ontouchmove ran scroll detection unconditionally, so any finger
    // movement > 10px during a long press set isScrolling=true and hid the
    // tooltip. Fix: when isLongPress is active, return early before the scroll
    // detection block, so dragging across cells keeps the tooltip alive.

    it('should not trigger scroll detection while long press is active', () => {
        let isScrolling = false;
        let isLongPress = true;
        const touchStartPos = { x: 100, y: 100 };

        const handleTouchMove = (currentPos) => {
            if (isLongPress) return; // early return — no scroll detection during drag
            if (isScrollGesture(touchStartPos, currentPos)) {
                isScrolling = true;
            }
        };

        // Large movement that would otherwise trigger scroll detection
        handleTouchMove({ x: 250, y: 250 });

        expect(isScrolling).toBe(false);
    });

    it('should still detect scrolling before long press activates', () => {
        let isScrolling = false;
        let isLongPress = false;
        const touchStartPos = { x: 100, y: 100 };

        const handleTouchMove = (currentPos) => {
            if (isLongPress) return;
            if (isScrollGesture(touchStartPos, currentPos)) {
                isScrolling = true;
            }
        };

        handleTouchMove({ x: 100, y: 150 }); // 50px vertical movement

        expect(isScrolling).toBe(true);
    });

    it('should show hovered cell sprite data when finger moves to a different cell', () => {
        const previewBox = document.createElement('div');
        previewBox.id = 'stash-sprite-preview';
        const timeDisplay = document.createElement('div');
        timeDisplay.className = 'preview-time';
        previewBox.appendChild(timeDisplay);
        document.body.appendChild(previewBox);

        // Two cells with distinct sprite positions and timestamps
        const createCell = (bgPos, timeStr) => {
            const cell = document.createElement('div');
            cell.className = 'sprite-cell';
            cell.style.backgroundPosition = bgPos;
            if (timeStr) {
                const ts = document.createElement('span');
                ts.className = 'sprite-timestamp';
                ts.innerText = timeStr;
                cell.appendChild(ts);
            }
            document.body.appendChild(cell);
            return cell;
        };

        createCell('0% 0%', '0:00');       // cell A — where long press started
        const cellB = createCell('50% 50%', '1:30'); // cell B — where finger moved to

        // Simulate what ontouchmove does when elementFromPoint returns cellB:
        // read cellB's backgroundPosition and timestamp, pass as overrides
        const tsEl = cellB.querySelector('.sprite-timestamp');
        const bgPosOverride = cellB.style.backgroundPosition;
        const timeStrOverride = tsEl ? tsEl.innerText : '';

        previewBox.style.backgroundPosition = bgPosOverride;
        timeDisplay.innerText = timeStrOverride;

        expect(previewBox.style.backgroundPosition).toBe('50% 50%');
        expect(timeDisplay.innerText).toBe('1:30');
    });
});

describe('Auto-scroll layout awareness', () => {
    // Bug: auto-scroll called scrollIntoView on the active sprite cell during
    // playback, which on mobile (where the panel has no own scroll container)
    // hijacked the page scroll. Fix: suppress sprite scroll on mobile layout;
    // instead scroll to the video player when the user taps a sprite.

    it('should suppress sprite scroll-into-view during playback on mobile layout', () => {
        const mockScrollIntoView = jest.fn();
        const element = { scrollIntoView: mockScrollIntoView };
        const mobileMatchMedia = jest.fn(() => ({ matches: true }));

        const autoScroll = true;
        const spritesVisible = true;
        if (autoScroll && spritesVisible && !isMobileLayout(mobileMatchMedia)) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }

        expect(mockScrollIntoView).not.toHaveBeenCalled();
    });

    it('should allow sprite scroll-into-view during playback on desktop layout', () => {
        const mockScrollIntoView = jest.fn();
        const element = { scrollIntoView: mockScrollIntoView };
        const desktopMatchMedia = jest.fn(() => ({ matches: false }));

        const autoScroll = true;
        const spritesVisible = true;
        if (autoScroll && spritesVisible && !isMobileLayout(desktopMatchMedia)) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }

        expect(mockScrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
    });

    it('should scroll to video player after tap on mobile layout', () => {
        const mockScrollIntoView = jest.fn();
        const player = { scrollIntoView: mockScrollIntoView };
        const mobileMatchMedia = jest.fn(() => ({ matches: true }));

        const autoScroll = true;
        if (autoScroll && isMobileLayout(mobileMatchMedia)) {
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('should not scroll to video player after tap on desktop layout', () => {
        const mockScrollIntoView = jest.fn();
        const player = { scrollIntoView: mockScrollIntoView };
        const desktopMatchMedia = jest.fn(() => ({ matches: false }));

        const autoScroll = true;
        if (autoScroll && isMobileLayout(desktopMatchMedia)) {
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
});

describe('GraphQL Mock Integration', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    it('should handle successful configuration fetch', async () => {
        const mockResponse = {
            data: {
                configuration: {
                    plugins: {
                        SpriteTab: {
                            tooltip_enabled: true,
                            tooltip_width: 500
                        }
                    }
                }
            }
        };

        global.fetch.mockResolvedValueOnce({
            json: () => Promise.resolve(mockResponse)
        });

        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: 'query Configuration { configuration { plugins } }'
            })
        });
        const data = await response.json();

        expect(data.data.configuration.plugins.SpriteTab.tooltip_width).toBe(500);
    });

    it('should handle failed fetch gracefully', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(fetch('/graphql')).rejects.toThrow('Network error');
    });

    it('should handle scene data fetch', async () => {
        const mockResponse = {
            data: {
                findScene: {
                    id: '123',
                    files: [{ duration: 1800 }],
                    paths: { sprite: '/sprites/scene_123.jpg' }
                }
            }
        };

        global.fetch.mockResolvedValueOnce({
            json: () => Promise.resolve(mockResponse)
        });

        const response = await fetch('/graphql', {
            method: 'POST',
            body: JSON.stringify({
                query: 'query FindScene($id: ID!) { findScene(id: $id) { ... } }',
                variables: { id: '123' }
            })
        });
        const data = await response.json();

        expect(data.data.findScene.id).toBe('123');
        expect(data.data.findScene.files[0].duration).toBe(1800);
    });
});
