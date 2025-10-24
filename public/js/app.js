// Mini loader per includere i parziali e poi inizializzare i moduli
(async function includeAndInit() {
    // 1) include partials
    const hosts = document.querySelectorAll('[data-include]');
    await Promise.all(Array.from(hosts).map(async host => {
        const url = host.getAttribute('data-include');
        const html = await fetch(url).then(r => r.text());
        host.outerHTML = html; // sostituisce il placeholder col contenuto
    }));

    // 2) inizializza moduli (ora gli elementi esistono nel DOM)
    GeoMap.init();          // crea mappa e registra API
    UserPanel.init();
    LayerPanel.init();      // wiring pannello layer

    // 3) avvia il gate di autenticazione (mostra overlay se serve)
    AuthGate.init();
    AIChat.init();          // wiring chat (spinner incluso)

    TimeSlider.init({
        startISO: new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString(),
        endISO: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString(),
        stepMinutes: 5, // 1 ora
        intervals: []
    });

    // 4) wiring tra componenti tramite CustomEvent
    document.addEventListener('layer:add-geojson', e => GeoMap.addVectorLayer(e.detail));
    document.addEventListener('layer:add-cog', e => GeoMap.addCOG(e.detail));
    document.addEventListener('layer:toggle-remote', e => {
        const layer = e.detail.layer;
        GeoMap.toggleRemoteLayer(layer); // ved. delta in GeoMap
    });
    document.addEventListener('layer:download', e => {
        const { layer } = e.detail;
        // se il backend fornisce un URL firmato, chiedilo qui e poi window.open(url)
        // per demo: prova ad aprire direttamente lo src (se pubblico)
        if (layer?.src) window.open(layer.src, '_blank');
    });

    document.addEventListener('map:toggle-layer-visibility', e => GeoMap.toggleLayerMapVisibility(e.detail));
    document.addEventListener('map:set-style', e => GeoMap.setStyle(e.detail.styleUrl));
    document.addEventListener('map:reset', () => GeoMap.resetView());

    document.addEventListener('timeslider:change', e => {
        // DOC: all we need to call whenever the time slider changes
        const { iso, date } = e.detail;
        GeoMap.renderTimestampRasters(iso);
    });

    // Esempio: la chat può inviare comandi (demo)
    document.addEventListener('chat:command', e => {
        const { cmd } = e.detail;
        if (cmd === 'style:dark') {
            document.querySelector('#styleSelect').value = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
            document.querySelector('#styleSelect').dispatchEvent(new Event('change'));
        }
    });

})();
