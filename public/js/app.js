// Mini loader per includere i parziali e poi inizializzare i moduli
(async function includeAndInit() {
    
    // ========================================
    // 1) CARICAMENTO PARTIAL HTML RICORSIVO
    // ========================================
    async function loadIncludes(root = document) {
        const hosts = root.querySelectorAll('[data-include]');
        if (hosts.length === 0) return;

        await Promise.all(Array.from(hosts).map(async host => {
            const url = host.getAttribute('data-include');
            const html = await fetch(url).then(r => r.text());
            
            // Inserisce l'HTML ma mantiene il nodo così possiamo ricontrollarlo
            host.innerHTML = html;
            host.removeAttribute('data-include');

            // scansiona ricorsivamente nuovi include dentro questo host
            await loadIncludes(host);
        }));
    }
    
    await loadIncludes();

    // ========================================
    // 2) INIZIALIZZAZIONE MODULI PRINCIPALI
    // ========================================
    GeoMap.init();          // crea mappa e registra API
    UserPanel.init();
    LayerPanel.init();      // wiring pannello layer
    AuthGate.init();        // avvia il gate di autenticazione (mostra overlay se serve)
    AIChat.init();          // wiring chat (spinner incluso)

    TimeSlider.init({
        startISO: new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString(),
        endISO: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
        stepMinutes: 5,
        intervals: []
    });

    // ========================================
    // 3) WIRING EVENTI - LAYER
    // ========================================
    document.addEventListener('layer:add-geojson', e => GeoMap.addVectorLayer(e.detail));
    document.addEventListener('layer:add-cog', e => GeoMap.addCOG(e.detail));
    document.addEventListener('layer:toggle-remote', e => {
        const layer = e.detail.layer;
        GeoMap.toggleLayerMapVisibility(layer);
    });
    document.addEventListener('layer:download', e => {
        const { layer } = e.detail;
        if (layer?.src) window.open(layer.src, '_blank');
    });

    // ========================================
    // 4) WIRING EVENTI - MAPPA
    // ========================================
    document.addEventListener('map:toggle-layer-visibility', e => GeoMap.toggleLayerMapVisibility(e.detail));
    document.addEventListener('map:set-style', e => GeoMap.setStyle(e.detail.styleUrl));
    document.addEventListener('map:reset', () => GeoMap.resetView());
    document.addEventListener('layers:reordered', e => GeoMap.reorderLayers(e.detail.order));

    // ========================================
    // 5) WIRING EVENTI - TIME SLIDER
    // ========================================
    document.addEventListener('timeslider:change', e => {
        const { iso, date } = e.detail;
        GeoMap.renderTimestampRasters(iso);
    });

    // ========================================
    // 6) WIRING EVENTI - MAP COMMANDS (PLN-015 T-015-06)
    // ========================================
    document.addEventListener('map:execute-commands', e => {
        const commands = e.detail?.commands;
        if (!Array.isArray(commands)) return;
        commands.forEach(command => {
            try {
                switch (command.type) {
                    case 'move_view':
                        GeoMap.moveView(command.payload);
                        break;
                    case 'set_layer_style': {
                        const { layer_id, style } = command.payload || {};
                        if (layer_id && style) GeoMap.setLayerStyle(layer_id, style);
                        break;
                    }
                    case 'sync_shapes':
                        document.dispatchEvent(new CustomEvent('draw-tool:add-shape', { detail: command.payload }));
                        break;
                    default:
                        console.warn('[app] Unknown map command type:', command.type);
                }
            } catch (err) {
                console.error('[app] Error executing map command:', command.type, err);
            }
        });
    });

    // ========================================
    // 7) WIRING EVENTI - CHAT
    // ========================================
    document.addEventListener('chat:command', e => {
        const { cmd } = e.detail;
        if (cmd === 'style:dark') {
            document.querySelector('#styleSelect').value = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
            document.querySelector('#styleSelect').dispatchEvent(new Event('change'));
        }
    });

    // ========================================
    // 7) THEME TOGGLE
    // ========================================
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        const html = document.documentElement;
        // Sync button icon with current theme
        const syncThemeBtn = () => {
            const isLight = html.classList.contains('light-theme');
            themeBtn.textContent = isLight ? '🌙' : '☀️';
            themeBtn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
        };
        syncThemeBtn();
        themeBtn.addEventListener('click', () => {
            const isLight = html.classList.toggle('light-theme');
            localStorage.setItem('sp-theme', isLight ? 'light' : 'dark');
            syncThemeBtn();
        });
    }

})();
