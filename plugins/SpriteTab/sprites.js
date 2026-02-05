(function () {
    'use strict';

    // --- CONFIGURATION ---
    const STORAGE_KEY = 'stash_plugin_sprite_settings';
    const PLUGIN_ID = 'SpriteTab';
    const SPRITE_WIDTH_GUESS = 160;
    const DEFAULT_PREVIEW_WIDTH = 300; // Default size of the magnified pop-up in pixels
    const DEFAULT_SPRITE_SIZE = 50; // Default sprite thumbnail width in pixels
    const DEFAULTS = { cols: 4 };

    // Plugin settings cache
    let pluginSettings = {
        sprite_size: DEFAULT_SPRITE_SIZE,
        tooltip_enabled: true,
        tooltip_width: DEFAULT_PREVIEW_WIDTH,
        show_timestamps: true,
        compact_view: false,
        auto_scroll: true,
        grid_columns: null
    };

    // Initialization state to prevent race conditions
    let isInitializing = false;

    // --- HELPERS ---
    function getSettings() {
        try {
            return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
        } catch (e) { return DEFAULTS; }
    }

    function saveSettings(newSettings) {
        const merged = { ...getSettings(), ...newSettings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
    }

    function formatTime(seconds) {
        if (!seconds) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${m}:${s.toString().padStart(2, '0')}`;
    }

    function getPlayer() {
        return document.querySelector('video.vjs-tech') || document.querySelector('video');
    }

    // --- INJECT CUSTOM STYLES ---
    function injectStyles() {
        // Remove existing styles to allow for settings updates
        const existing = document.getElementById('stash-sprites-css');
        if (existing) existing.remove();

        const style = document.createElement('style');
        style.id = 'stash-sprites-css';
        style.textContent = `
            .tab-content.stash-plugin-sprites-active > .tab-pane {
                display: none !important;
            }
            .tab-content.stash-plugin-sprites-active > #sprites-panel {
                display: block !important;
            }
            /* Pop-up specific styles */
            #stash-sprite-preview {
                position: fixed;
                width: ${pluginSettings.tooltip_width}px;
                aspect-ratio: 16/9;
                background-repeat: no-repeat;
                background-color: #000;
                border: 2px solid #fff;
                box-shadow: 0 4px 15px rgba(0,0,0,0.8);
                z-index: 10000;
                pointer-events: none; /* Allows clicking through the popup */
                display: none;
                border-radius: 4px;
            }
            #stash-sprite-preview .preview-time {
                position: absolute;
                bottom: 5px;
                right: 5px;
                background: rgba(0,0,0,0.8);
                color: #fff;
                font-size: 14px;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: bold;
            }
            /* Sprite cell size based on plugin settings */
            .sprite-cell {
                min-width: ${pluginSettings.sprite_size}px;
                /* Prevent native long-press behaviors on mobile */
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
                touch-action: pan-y; /* Allow vertical scrolling, prevent other gestures */
            }
        `;
        document.head.appendChild(style);
    }

    async function stashGQL(query, variables) {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        const json = await response.json();
        return json.data;
    }

    async function loadPluginSettings() {
        const query = `query Configuration { configuration { plugins } }`;
        try {
            const data = await stashGQL(query);
            const allPlugins = data?.configuration?.plugins;
            if (allPlugins && allPlugins[PLUGIN_ID]) {
                const settings = allPlugins[PLUGIN_ID];
                pluginSettings.sprite_size = settings.sprite_size ?? DEFAULT_SPRITE_SIZE;
                pluginSettings.tooltip_enabled = settings.tooltip_enabled ?? true;
                pluginSettings.tooltip_width = settings.tooltip_width ?? DEFAULT_PREVIEW_WIDTH;
                pluginSettings.show_timestamps = settings.show_timestamps ?? true;
                pluginSettings.compact_view = settings.compact_view ?? false;
                pluginSettings.auto_scroll = settings.auto_scroll ?? true;
                pluginSettings.grid_columns = settings.grid_columns ?? null;
            }
        } catch (e) {
            console.warn('SpriteTab: Could not load plugin settings, using defaults', e);
        }
        return pluginSettings;
    }

    async function getSceneData(sceneId) {
        const query = `query FindScene($id: ID!) { findScene(id: $id) { id files { duration } paths { sprite } } }`;
        try {
            const data = await stashGQL(query, { id: sceneId });
            const scene = data.findScene;
            if (!scene) return null;
            scene.duration = (scene.files?.[0]?.duration) || 0;
            return scene;
        } catch (e) { return null; }
    }

    // --- UI RENDERER ---
    function renderControls(container, updateCallback) {
        // Hide toolbar if grid_columns is configured in plugin settings
        if (pluginSettings.grid_columns) return null;

        const settings = getSettings();
        const bar = document.createElement('div');

        // Sticky positioning to keep controls visible
        bar.style.cssText = `
            padding: 5px 10px;
            display: flex;
            align-items: center;
            background: rgba(30, 30, 30, 0.95);
            border-bottom: 1px solid #444;
            position: sticky;
            top: 0;
            z-index: 100;
            backdrop-filter: blur(5px);
        `;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '12';
        slider.value = 13 - settings.cols;
        slider.style.cssText = 'cursor: pointer; width: 100%;';

        slider.oninput = (e) => {
            const newVal = parseInt(e.target.value);
            const newCols = 13 - newVal;
            saveSettings({ cols: newCols });
            updateCallback('cols');
        };

        bar.appendChild(slider);

        return bar;
    }

    function renderSpriteGrid(sceneData) {
        if (!sceneData?.paths?.sprite) return null;

        const mainContainer = document.createElement('div');
        mainContainer.style.cssText = "width: 100%; display: flex; flex-direction: column;";

        // Create or get the preview box
        let previewBox = document.getElementById('stash-sprite-preview');
        if (!previewBox) {
            previewBox = document.createElement('div');
            previewBox.id = 'stash-sprite-preview';
            // Add a time display inside the preview
            const timeDisplay = document.createElement('div');
            timeDisplay.className = 'preview-time';
            previewBox.appendChild(timeDisplay);
            document.body.appendChild(previewBox);
        }
        const previewTimeDisplay = previewBox.querySelector('.preview-time');

        const scrollArea = document.createElement('div');
        scrollArea.className = 'sprite-scroll-area';
        scrollArea.style.cssText = 'position: relative; width: 100%; padding-bottom: 50px;';

        const grid = document.createElement('div');
        grid.id = 'stash-sprite-grid';
        const cols = pluginSettings.grid_columns || getSettings().cols;
        grid.style.cssText = `display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: ${pluginSettings.compact_view ? '0' : '5px'}; padding-right: 5px;`;

        const cells = [];
        let totalSpritesCount = 0;

        // Re-query DOM each time to handle React re-renders that may detach elements
        const updateUI = (key) => {
            const ns = getSettings();
            const currentGrid = document.getElementById('stash-sprite-grid');
            if (!currentGrid) return;

            if (key === 'cols') {
                currentGrid.style.gridTemplateColumns = `repeat(${ns.cols}, 1fr)`;
            }
        };

        const controls = renderControls(mainContainer, updateUI);
        if (controls) mainContainer.appendChild(controls);
        mainContainer.appendChild(scrollArea);

        const img = new Image();
        img.src = sceneData.paths.sprite;
        img.onload = () => {
            const sourceW = img.naturalWidth;
            const sourceH = img.naturalHeight;
            const sourceCols = Math.round(sourceW / SPRITE_WIDTH_GUESS);
            const singleH = (sourceW / sourceCols) * (9/16);
            const sourceRows = Math.round(sourceH / singleH);
            totalSpritesCount = sourceCols * sourceRows;

            for (let i = 0; i < totalSpritesCount; i++) {
                const cell = document.createElement('div');
                cell.className = 'sprite-cell';
                cell.style.cssText = `width: 100%; aspect-ratio: 16/9; background-image: url('${sceneData.paths.sprite}'); background-repeat: no-repeat; cursor: pointer; position: relative;`;
                cell.style.border = pluginSettings.compact_view ? 'none' : '1px solid #333';
                cell.style.borderRadius = pluginSettings.compact_view ? '0' : '4px';

                // Set background mapping
                cell.style.backgroundSize = `${sourceCols * 100}%`;
                const colIdx = i % sourceCols;
                const rowIdx = Math.floor(i / sourceCols);
                const bgPos = `${(colIdx / (sourceCols - 1)) * 100}% ${(rowIdx / (sourceRows - 1)) * 100}%`;
                cell.style.backgroundPosition = bgPos;

                const time = (i / totalSpritesCount) * sceneData.duration;
                const timeStr = formatTime(time);

                if (pluginSettings.show_timestamps) {
                    const ts = document.createElement('span');
                    ts.className = 'sprite-timestamp';
                    ts.innerText = timeStr;
                    ts.style.cssText = 'position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; padding: 1px 4px; pointer-events: none;';
                    cell.appendChild(ts);
                }

                // --- TOOLTIP HELPER FUNCTIONS ---
                // Track recent touch to prevent mouse events from re-showing tooltip
                let lastTouchTime = 0;

                const showTooltip = (clientX, clientY) => {
                    if (!pluginSettings.tooltip_enabled) return;

                    previewBox.style.backgroundImage = `url('${sceneData.paths.sprite}')`;
                    previewBox.style.backgroundSize = `${sourceCols * 100}%`;
                    previewBox.style.backgroundPosition = bgPos;
                    previewTimeDisplay.innerText = timeStr;

                    // Calculate tooltip dimensions (use fixed aspect ratio since we know it)
                    const tooltipWidth = pluginSettings.tooltip_width;
                    const tooltipHeight = tooltipWidth * (9 / 16);

                    const vpWidth = window.innerWidth;
                    const vpHeight = window.innerHeight;
                    const offset = 20;
                    const edgePadding = 10;

                    // Calculate position with bounds checking
                    let left = clientX + offset;
                    let top = clientY + offset;

                    // If clipping right edge, flip to left of cursor
                    if (left + tooltipWidth + edgePadding > vpWidth) {
                        left = clientX - tooltipWidth - offset;
                    }
                    // If still clipping left edge, align to left edge with padding
                    if (left < edgePadding) {
                        left = edgePadding;
                    }

                    // If clipping bottom edge, flip to above cursor
                    if (top + tooltipHeight + edgePadding > vpHeight) {
                        top = clientY - tooltipHeight - offset;
                    }
                    // If still clipping top edge, align to top edge with padding
                    if (top < edgePadding) {
                        top = edgePadding;
                    }

                    previewBox.style.top = `${top}px`;
                    previewBox.style.left = `${left}px`;
                    previewBox.style.display = 'block';
                };

                const hideTooltip = () => {
                    previewBox.style.display = 'none';
                };

                const seekToTime = () => {
                    const p = getPlayer();
                    if (p) { p.currentTime = time; p.play(); }
                };

                // --- CLICK HANDLER (desktop) ---
                cell.onclick = (e) => {
                    // Ignore clicks that are synthetic from touch events
                    if (Date.now() - lastTouchTime < 500) return;
                    seekToTime();
                };

                // --- HOVER LOGIC (desktop) ---
                cell.onmouseenter = (e) => {
                    // Ignore synthetic mouse events after touch
                    if (Date.now() - lastTouchTime < 500) return;
                    if(!pluginSettings.compact_view) cell.style.borderColor = '#fff';
                    showTooltip(e.clientX, e.clientY);
                };

                cell.onmousemove = (e) => {
                    // Ignore synthetic mouse events after touch
                    if (Date.now() - lastTouchTime < 500) return;
                    showTooltip(e.clientX, e.clientY);
                };

                cell.onmouseleave = () => {
                    if(!pluginSettings.compact_view) cell.style.border = '1px solid #333';
                    hideTooltip();
                };

                // --- TOUCH LOGIC (mobile) ---
                let touchTimer = null;
                let touchStartPos = null;
                let isLongPress = false;
                let isScrolling = false;

                cell.ontouchstart = (e) => {
                    const touch = e.touches[0];
                    touchStartPos = { x: touch.clientX, y: touch.clientY };
                    isLongPress = false;
                    isScrolling = false;

                    // Only set up long-press if tooltip is enabled
                    if (pluginSettings.tooltip_enabled) {
                        // Start long-press timer (500ms)
                        touchTimer = setTimeout(() => {
                            isLongPress = true;
                            // Prevent default to stop any remaining native behaviors
                            showTooltip(touch.clientX, touch.clientY);
                            if(!pluginSettings.compact_view) cell.style.borderColor = '#fff';
                        }, 500);
                    }
                };

                cell.ontouchmove = (e) => {
                    if (!touchStartPos) return;

                    const touch = e.touches[0];
                    const dx = Math.abs(touch.clientX - touchStartPos.x);
                    const dy = Math.abs(touch.clientY - touchStartPos.y);

                    // Detect scrolling (primarily vertical movement)
                    const scrollThreshold = 10;
                    if (dy > scrollThreshold || dx > scrollThreshold) {
                        isScrolling = true;
                        // Cancel long-press timer if scrolling
                        if (touchTimer) {
                            clearTimeout(touchTimer);
                            touchTimer = null;
                        }
                        // Hide tooltip if it was shown
                        if (isLongPress) {
                            hideTooltip();
                            if(!pluginSettings.compact_view) cell.style.border = '1px solid #333';
                            isLongPress = false;
                        }
                    }

                    // Update tooltip position if long-press is active and not scrolling
                    if (isLongPress && !isScrolling) {
                        e.preventDefault(); // Prevent scrolling while showing tooltip
                        showTooltip(touch.clientX, touch.clientY);
                    }
                };

                cell.ontouchend = (e) => {
                    // Record touch time to ignore synthetic mouse events
                    lastTouchTime = Date.now();

                    // Clear the long-press timer
                    if (touchTimer) {
                        clearTimeout(touchTimer);
                        touchTimer = null;
                    }

                    // Hide tooltip
                    hideTooltip();
                    if(!pluginSettings.compact_view) cell.style.border = '1px solid #333';

                    // If it was a long press, don't seek
                    if (isLongPress) {
                        e.preventDefault();
                        isLongPress = false;
                        touchStartPos = null;
                        return;
                    }

                    // If user was scrolling, don't seek
                    if (isScrolling) {
                        isScrolling = false;
                        touchStartPos = null;
                        return;
                    }

                    // Short tap without scrolling - seek to time
                    seekToTime();
                    touchStartPos = null;
                };

                cell.ontouchcancel = () => {
                    // Record touch time to ignore synthetic mouse events
                    lastTouchTime = Date.now();

                    if (touchTimer) {
                        clearTimeout(touchTimer);
                        touchTimer = null;
                    }
                    hideTooltip();
                    if(!pluginSettings.compact_view) cell.style.border = '1px solid #333';
                    isLongPress = false;
                    isScrolling = false;
                    touchStartPos = null;
                };

                cells.push({ element: cell, time: time });
                grid.appendChild(cell);
            }
            scrollArea.appendChild(grid);
            attachVideoListeners(cells, sceneData.duration);
        };

        return mainContainer;
    }

    function attachVideoListeners(cells, duration) {
        let currentActiveIndex = -1;
        const total = cells.length;

        const update = () => {
            const player = getPlayer();
            if (!player) return;

            const idx = Math.floor((player.currentTime / duration) * total);
            const safeIdx = Math.max(0, Math.min(idx, total - 1));

            if (safeIdx !== currentActiveIndex) {
                if (currentActiveIndex >= 0 && cells[currentActiveIndex]) {
                    cells[currentActiveIndex].element.style.boxShadow = 'none';
                    cells[currentActiveIndex].element.style.zIndex = '0';
                }

                if (cells[safeIdx]) {
                    cells[safeIdx].element.style.boxShadow = 'inset 0 0 0 2px #00BFFF';
                    cells[safeIdx].element.style.zIndex = '1';

                    if (pluginSettings.auto_scroll) {
                        cells[safeIdx].element.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
                        });
                    }

                    currentActiveIndex = safeIdx;
                }
            }
        };

        const poller = setInterval(() => {
            const player = getPlayer();
            if (player) {
                player.addEventListener('timeupdate', update);
                update();
                clearInterval(poller);
            }
        }, 1000);
    }

    // --- MAIN LOGIC ---
    async function init(sceneId) {
        // Prevent duplicate initialization from race conditions
        if (document.getElementById('tab-sprites-nav')) return;
        if (isInitializing) return;
        isInitializing = true;

        try {
            const navTabs = document.querySelector('.nav-tabs');
            if (!navTabs) return;

            // Load plugin settings first
            await loadPluginSettings();

            // Double-check after async operation to prevent duplicates
            if (document.getElementById('tab-sprites-nav')) return;

            injectStyles();

            const tabItem = document.createElement('div');
            tabItem.className = 'nav-item';
            tabItem.innerHTML = `<a id="tab-sprites-nav" href="#" role="tab" class="nav-link">Sprites</a>`;
            navTabs.appendChild(tabItem);

            const firstPane = document.querySelector('.tab-content .tab-pane');
            const tabContent = firstPane ? firstPane.parentElement : navTabs.nextElementSibling;
            if (!tabContent) return;

            const tabPane = document.createElement('div');
            tabPane.id = 'sprites-panel';
            tabPane.className = 'tab-pane';
            tabContent.appendChild(tabPane);

            const data = await getSceneData(sceneId);
            const grid = renderSpriteGrid(data);
            if (grid) tabPane.appendChild(grid);
            else tabPane.innerHTML = '<div style="padding:20px;">No sprites available.</div>';

            // Event Handling
            navTabs.addEventListener('click', (e) => {
                const link = e.target.closest('.nav-link');
                if (!link) return;

                if (link.id === 'tab-sprites-nav') {
                    e.preventDefault();
                    e.stopPropagation();

                    navTabs.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
                    link.classList.add('active');

                    tabContent.classList.add('stash-plugin-sprites-active');

                    if (pluginSettings.auto_scroll) {
                        const activeCell = tabPane.querySelector('.sprite-cell[style*="box-shadow"]');
                        if (activeCell) activeCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }

                } else {
                    const myTab = document.getElementById('tab-sprites-nav');
                    if (myTab) myTab.classList.remove('active');

                    tabContent.classList.remove('stash-plugin-sprites-active');
                }
            }, { capture: true });
        } finally {
            isInitializing = false;
        }
    }

    // --- OBSERVER ---
    const observer = new MutationObserver((mutations) => {
        const match = window.location.pathname.match(/\/scenes\/(\d+)/);
        if (match) {
            const navTabs = document.querySelector('.nav-tabs');
            if (navTabs && !document.getElementById('tab-sprites-nav')) {
                init(match[1]);
            }
        } else {
            // Cleanup popup if leaving scene page
            const popup = document.getElementById('stash-sprite-preview');
            if (popup) popup.remove();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
