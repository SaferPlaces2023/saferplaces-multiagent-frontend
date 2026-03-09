// Mini loader per includere i parziali e poi inizializzare i moduli
(async function includeAndInit() {
    
    // ========================================
    // 1) CARICAMENTO PARTIAL HTML RICORSIVO
    // ========================================
    // DOC: [NEW way] include partials recursively
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
        GeoMap.toggleRemoteLayer(layer);
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

    // ========================================
    // 5) WIRING EVENTI - TIME SLIDER
    // ========================================
    document.addEventListener('timeslider:change', e => {
        const { iso, date } = e.detail;
        GeoMap.renderTimestampRasters(iso);
    });

    // ========================================
    // 6) WIRING EVENTI - CHAT
    // ========================================
    document.addEventListener('chat:command', e => {
        const { cmd } = e.detail;
        if (cmd === 'style:dark') {
            document.querySelector('#styleSelect').value = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
            document.querySelector('#styleSelect').dispatchEvent(new Event('change'));
        }
    });

})();
