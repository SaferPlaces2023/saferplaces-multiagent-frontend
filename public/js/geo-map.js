/**
 * GeoMap - Modulo visualizzazione mappa MapLibre + gestione layers
 * 
 * Responsabilità:
 * - Inizializzazione mappa con controls, sky, projection
 * - Aggiunta layers vector (GeoJSON) e raster (COG)
 * - Rendering raster temporali (time-series)
 * - Gestione visibilità layers
 * - Integrazione TimeSlider per layers multibanda
 * - 3D buildings e terrain da tile sources
 * 
 * Dipendenze: MapLibre-GL, MaplibreCOGProtocol, _utils.js, _consts.js, TimeSlider, Toasts, DrawTools
 */
const GeoMap = (() => {

    const MODULE_SUMMARY = {
        // COSTANTI LOCALI - CONFIGURAZIONE
        'GEO_MAP_CONSTANTS.MAP_CONFIG': 'Center [12.4964, 41.9028], zoom 3, maxPitch 75, style URL default',
        'GEO_MAP_CONSTANTS.VIEW_DEFAULTS': 'Zoom/duration per reset view e fit bounds',
        'GEO_MAP_CONSTANTS.SKY_CONFIG': 'Configurazione cielo: colori, fog, atmosphere blend (usato in style.load)',
        'GEO_MAP_CONSTANTS.TILE_SOURCES': 'URLs esterne: OpenFreemap buildings, COG protocol ID',
        'GEO_MAP_CONSTANTS.BUILDINGS_3D': 'Paint config edifici 3D: extrusion color/height/base formule',
        'GEO_MAP_CONSTANTS.TERRAIN': 'Exaggeration 1.5 per DEM terrain effect',
        'GEO_MAP_CONSTANTS.VECTOR_PAINT': 'Colori default fill (#6ee7b7), line, point layers',
        'GEO_MAP_CONSTANTS.RASTER_PAINT': 'Opacity 0.6 default raster, transparent fallback',
        'GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES': 'Enum: DEM, DEM_BUILDING, RAIN_TIMESERIES, WATER_DEPTH, RASTER',
        'GEO_MAP_CONSTANTS.COLORMAPS': 'TERRAIN_DEFAULT=BrewerBrBG10, WATER=CartoTealGrn, RAIN=BrewerSpectral11',
        'GEO_MAP_CONSTANTS.COLORMAP_RANGES': 'Min/max per water (0-2), terrain (0-1000), rain (0-50 mm/h)',
        'GEO_MAP_CONSTANTS.COG_TILE_SIZE': 'Tile size 256 per raster sources',

        // DOM IDS
        DOM_IDS: 'Map: 4 elementi - map, styleSelect, resetView, btnCesiumLaunch',

        // STATO INTERNO
        map: 'Istanza MapLibre.Map',
        registry: 'Object id → {type, url, data?, metadata?} - tracking layers',
        customLayerIds: 'Set layer IDs aggiunti manualmente',
        surfaceColorscalesMap: 'Map surface_type → MaplibreCOGProtocol.colorScale()',
        domElements: 'Cache elementi DOM dalla mappa via cacheElements()',

        // INIZIALIZZAZIONE
        init: 'Entry: cacheElements → setupMap → configureControls → configureMapEvents → bindUIEvents',
        setupMap: 'Crea MapLibre instance (container, style, center, zoom), addProtocol COG',
        configureControls: 'Aggiunge Navigation, Scale, Globe controls a mappa',
        configureMapEvents: 'Bind "style.load" per sky/projection/3D buildings, "load" per DrawTools',
        bindUIEvents: 'Bind UI: styleSelect change → setStyle(), resetView click → resetView(), btnCesiumLaunch click',
        handleCesiumLaunch: 'Estrae user/project/thread IDs da storage, crea form POST hidden, submitte cesium-viewer',

        // LAYER MANAGEMENT - AGGIUNTA LAYERS
        addVectorLayer: 'Async: POST /render → fetchia GeoJSON → addSource + 3 layers (fill/line/pt) → registerLayer → zoomToBounds',
        addCOG: 'Async: POST /render → branch su surface_type: DEM → processDEMLayer, RAIN_TIMESERIES → processTimeSeriesLayer, else → processSimpleRasterLayer',
        isLayerExists: 'Controlla map.getStyle().layers.some(l => l.id.includes(layerId))',
        registerLayer: 'registry[layerId] = {type, url, data?, metadata?}',

        // COG PROCESSING - ELABORAZIONE PER TIPO SUPERFICIE
        processDEMLayer: 'Crea 3 sources (hipso+colormap, hillshade, terrain) → 2 layers (image+hillshade) → setTerrain(exaggeration: 1.5)',
        processTimeSeriesLayer: 'Parse time_start/end → genera timestamps via TimeSlider.dateRange() → registra ogni ts in TimeSlider.registerTimestampItem() → setRange/setIntervals',
        processSimpleRasterLayer: 'Applica colormap → addSource + addLayer con paint raster-opacity 0.6',
        getColorMapString: 'Costruisce "#color:COLORMAP,min,max,c-" da surface_type + renderInfo.metadata',

        // 3D TERRAIN E BUILDINGS
        add3DBuildings: 'Trova labelLayerId → addSource("openfreemap") se assente → addLayer("3d-buildings") con fill-extrusion paint config',
        findLabelLayerId: 'Loop layers, trova primo con type="symbol" && layout["text-field"]',
        getBuildingsSources: 'Restituisce [{id,label}]: default + registry entries con surface_type="buildings"',
        switchBuildingsSource: 'Rimuove layer "3d-buildings" e lo ricrea da sourceId: default→add3DBuildings, custom→fill-extrusion GeoJSON',

        // VISIBILITY E RENDERING DINAMICO
        isLayerVisible: 'Controlla map.getStyle().layers.some(l => l.id.includes(layerId) && visibility==="visible")',
        toggleLayerMapVisibility: 'Filtra layers per layerId → toggle visibility → se ora visible + bbox → zoomToBounds',
        renderTimestampRasters: 'TimeSlider.getTimestampItems(timestamp, "raster-band") → per ogni visibile → updateRasterBandColor → removeLayer + addLayer con visibility visible',
        updateRasterBandColor: 'MaplibreCOGProtocol.setColorFunction(url, pixel,color,metadata) → calcola [r,g,b] da colorscale + alpha da curva esponenziale',

        // NAVIGATION E VIEW MANAGEMENT
        zoomToBounds: 'Se bbox non già contenuto in currentBounds → map.fitBounds(padding, duration)',
        resetView: 'map.easeTo() a center/zoom default, bearing/pitch 0',
        setStyle: 'map.setStyle(styleUrl) + TimeSlider.clearIntervals() + LayerPanel.reloadProjectLayers()',

        // UTILITY HELPERS
        createLayerIdFromSource: 'btoa(source || "layer-RANDOM")',
        createFormInput: 'Factory: document.createElement("input") con type/name/value',
        getBoundingBoxArray: 'Array check [minx,miny,maxx,maxy] or converto da {minx,miny,maxx,maxy}',

        // PUBLIC API EXPORTED
        'return.init': 'Inizializzazione',
        'return.addVectorLayer': 'Aggiunge GeoJSON (async)',
        'return.addCOG': 'Aggiunge COG raster (async)',
        'return.setStyle': 'Cambia stile mappa',
        'return.resetView': 'Reset view a default',
        'return.toggleLayerMapVisibility': 'Toggle visibilità layer',
        'return.renderTimestampRasters': 'Update raster per timestamp',
        'return.zoomToBounds': 'Zoom a bounding box'
    };

    // =========================================================================
    // COSTANTI LOCALI
    // =========================================================================
    const GEO_MAP_CONSTANTS = {
        // Configurazione mappa centrale
        MAP_CONFIG: {
            defaultCenter: [12.4964, 41.9028],
            defaultZoom: 3,
            maxPitch: 75,
            defaultStyle: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=961bdf77-3689-48c2-b079-80c0d4169115'
        },

        // Configurazione view/navigazione
        VIEW_DEFAULTS: {
            resetZoom: 5,
            resetBearing: 0,
            resetPitch: 0,
            zoomPadding: 20,
            zoomDuration: 1500,
            zoomEaseDuration: 1000
        },

        // Sky configuration per style.load
        SKY_CONFIG: {
            'sky-color': '#86a7c8',
            'sky-horizon-blend': 0.35,
            'horizon-color': '#e8eef7',
            'horizon-fog-blend': 0.6,
            'fog-color': '#d6dde6',
            'fog-ground-blend': 0.45,
            'atmosphere-blend': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 1,
                8, 1,
                11, 0.7,
                13, 0
            ]
        },


        // Configurazione tile sources esterne
        TILE_SOURCES: {
            openfreemapUrl: 'https://tiles.openfreemap.org/planet',
            openfreemapId: 'openfreemap',
            openfreemapSourceLayer: 'building',
            cogProtocol: 'cog'
        },

        // 3D Buildings paint configuration
        BUILDINGS_3D: {
            id: '3d-buildings',
            minzoom: 14,
            'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'render_height'],
                0, 'lightgray',
                200, 'royalblue',
                400, 'lightblue'
            ],
            'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 0,
                16, ['get', 'render_height']
            ],
            'fill-extrusion-base': ['case', ['>=', ['get', 'zoom'], 16], ['get', 'render_min_height'], 0]
        },

        // DEM/Terrain configuration
        TERRAIN: {
            exaggeration: 1
        },

        // Vector layer paint styles
        VECTOR_PAINT: {
            fill: { 'fill-color': '#6ee7b7', 'fill-opacity': 0.25 },
            line: { 'line-color': '#6ee7b7', 'line-width': 2 },
            point: { 'circle-color': '#6ee7b7', 'circle-radius': 4 }
        },

        VECTOR_FEATURE_TYPES: {
            BUILDINGS: 'buildings',
            ROADS: 'roads'
        },

        // Raster layer paint styles
        RASTER_PAINT: {
            default: { 'raster-opacity': 0.6 },
            transparent: { 'raster-opacity': 0 }
        },

        // Surface type identifiers
        RASTER_SURFACE_TYPES: {
            DEM: 'dem',
            DEM_BUILDING: 'dem-building',
            RAIN_TIMESERIES: 'rain-timeseries',
            TEMPERATURE_TIMESERIES: 'temperature-timeseries',
            WATER_DEPTH: 'water-depth',
            RASTER: 'raster'
        },

        // Colormaps per tipo superficie
        COLORMAPS: {
            TERRAIN_DEFAULT: 'BrewerSpectral11',
            WATER: 'CartoTealGrn',
            RAIN: 'BrewerSpectral11',
            TEMPERATURE: 'CartoTemps'
        },

        // Colormap range defaults
        COLORMAP_RANGES: {
            water: { min: 0, max: 2 },
            terrain: { min: 0, max: 1000 },
            rain: { min: 0, max: 50 },  // mm/h assumed max
            temperature: { min: -10, max: 50 }  // °C assumed range
        },

        // COG tile size
        COG_TILE_SIZE: 256,

        // Container ID della mappa
        MAP_CONTAINER_ID: 'map'
    };

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        map: 'map',
        styleSelect: 'styleSelect',
        resetView: 'resetView',
        btnCesiumLaunch: 'btnCesiumLaunch'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};
    let map = null;
    let registry = {};  // id → {type, url, data, metadata?}
    let customLayerIds = new Set();
    let currentBuildingsSource = 'default';  // 'default' | layerId from registry with surface_type='buildings'
    let surfaceColorscalesMap = {
        [GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.RAIN_TIMESERIES]: MaplibreCOGProtocol.colorScale({
            colorScheme: GEO_MAP_CONSTANTS.COLORMAPS.RAIN,
            min: GEO_MAP_CONSTANTS.COLORMAP_RANGES.rain.min,
            max: GEO_MAP_CONSTANTS.COLORMAP_RANGES.rain.max,
            isContinuous: true,
            isReverse: true
        }),
        [GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.TEMPERATURE_TIMESERIES]: MaplibreCOGProtocol.colorScale({
            colorScheme: GEO_MAP_CONSTANTS.COLORMAPS.TEMPERATURE,
            min: GEO_MAP_CONSTANTS.COLORMAP_RANGES.temperature.min,
            max: GEO_MAP_CONSTANTS.COLORMAP_RANGES.temperature.max,
            isContinuous: true,
            isReverse: false
        })
    };

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo GeoMap
     */
    function init() {
        domElements = cacheElements(DOM_IDS);
        setupMap();
        configureControls();
        configureMapEvents();
        bindUIEvents();
    }

    /**
     * Configura l'istanza MapLibre con stile e centro
     */
    function setupMap() {
        const styleUrl = domElements.styleSelect?.value || GEO_MAP_CONSTANTS.MAP_CONFIG.defaultStyle;

        map = new maplibregl.Map({
            container: GEO_MAP_CONSTANTS.MAP_CONTAINER_ID,
            style: styleUrl,
            center: GEO_MAP_CONSTANTS.MAP_CONFIG.defaultCenter,
            zoom: GEO_MAP_CONSTANTS.MAP_CONFIG.defaultZoom
        });

        map.setMaxPitch(GEO_MAP_CONSTANTS.MAP_CONFIG.maxPitch);

        // Registra COG protocol per tile loading
        maplibregl.addProtocol(GEO_MAP_CONSTANTS.TILE_SOURCES.cogProtocol, MaplibreCOGProtocol.cogProtocol);
    }

    /**
     * Custom IControl: doppio pulsante per selezione sorgente edifici 3D e toggle visibilità
     * - Btn sinistra: apre dropdown per scegliere sorgente (default OpenFreemap o layer con surface_type='buildings')
     * - Btn destra: toggle visibilità layer 3d-buildings
     */
    class Buildings3DControl {
        onAdd(map) {
            this._map = map;
            this._active = true;

            // Container principale
            this._container = document.createElement('div');
            this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

            // Wrapper flex-row per i due pulsanti + dropdown
            this._wrapper = document.createElement('div');
            this._wrapper.style.cssText = 'position:relative;';

            // --- Pulsante sorgente ---
            this._btnSource = document.createElement('button');
            this._btnSource.type = 'button';
            this._btnSource.title = 'Select buildings source';
            this._btnSource.setAttribute('aria-label', 'Select buildings source');
            this._btnSource.className = 'buildings-3d-source-btn';
            this._iconSource = document.createElement('span');
            this._iconSource.className = 'material-symbols-outlined';
            this._iconSource.style.cssText = 'font-size:18px;line-height:29px;color:#e07a5f;';
            this._iconSource.textContent = 'layers';
            this._btnSource.appendChild(this._iconSource);

            // Dropdown sorgenti
            this._dropdown = document.createElement('div');
            this._dropdown.className = 'buildings-3d-source-dropdown';
            this._dropdown.style.cssText = [
                'display:none',
                'position:absolute',
                'top:100%',
                'right:0',
                'background:white',
                'border:1px solid #ccc',
                'border-radius:4px',
                'padding:4px 0',
                'min-width:180px',
                'z-index:9999',
                'box-shadow:0 2px 8px rgba(0,0,0,0.2)'
            ].join(';');

            this._btnSource.addEventListener('click', (e) => {
                e.stopPropagation();
                this._refreshDropdown();
                const isOpen = this._dropdown.style.display !== 'none';
                this._dropdown.style.display = isOpen ? 'none' : 'block';
            });

            this._outsideClickHandler = (e) => {
                if (!this._container.contains(e.target)) {
                    this._dropdown.style.display = 'none';
                }
            };
            document.addEventListener('click', this._outsideClickHandler);

            // --- Pulsante toggle visibilità ---
            this._btnToggle = document.createElement('button');
            this._btnToggle.type = 'button';
            this._btnToggle.title = 'Toggle 3D buildings';
            this._btnToggle.setAttribute('aria-label', 'Toggle 3D buildings');
            this._btnToggle.className = 'buildings-3d-ctrl-btn';
            this._iconToggle = document.createElement('span');
            this._iconToggle.className = 'material-symbols-outlined';
            this._iconToggle.style.cssText = 'font-size:18px;line-height:29px;color:#e07a5f;';
            this._iconToggle.textContent = 'location_city';
            this._btnToggle.appendChild(this._iconToggle);

            this._btnToggle.addEventListener('click', () => {
                const layerId = GEO_MAP_CONSTANTS.BUILDINGS_3D.id;
                if (!this._map.getLayer(layerId)) return;
                this._active = !this._active;
                const viz = this._active ? 'visible' : 'none';
                this._map.setLayoutProperty(layerId, 'visibility', viz);
                this._iconToggle.style.color = this._active ? '#e07a5f' : 'var(--bs-secondary-color, #6c757d)';
            });

            this._wrapper.appendChild(this._btnToggle);
            this._wrapper.appendChild(this._btnSource);
            this._wrapper.appendChild(this._dropdown);
            this._container.appendChild(this._wrapper);
            return this._container;
        }

        _refreshDropdown() {
            this._dropdown.innerHTML = '';
            const sources = getBuildingsSources();
            sources.forEach(({ id, label }) => {
                const item = document.createElement('div');
                item.style.cssText = 'padding:6px 12px;cursor:pointer;white-space:nowrap;font-size:13px;';
                item.textContent = label;
                if (id === currentBuildingsSource) {
                    item.style.fontWeight = 'bold';
                    item.style.color = '#e07a5f';
                }
                item.addEventListener('mouseenter', () => { item.style.background = '#f0f0f0'; });
                item.addEventListener('mouseleave', () => { item.style.background = ''; });
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._dropdown.style.display = 'none';
                    switchBuildingsSource(id);
                    // Ripristina stato toggle ad attivo dopo cambio sorgente
                    this._active = true;
                    this._iconToggle.style.color = '#e07a5f';
                });
                this._dropdown.appendChild(item);
            });
        }

        onRemove() {
            document.removeEventListener('click', this._outsideClickHandler);
            this._container.parentNode?.removeChild(this._container);
            this._map = undefined;
        }
    }

    /**
     * Configura i controlli della mappa
     */
    function configureControls() {
        if (!map) return;

        map.addControl(new maplibregl.NavigationControl());
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
        map.addControl(new maplibregl.GlobeControl(), 'top-right');
        map.addControl(new Buildings3DControl(), 'top-right');
    }

    /**
     * Configura gli event listener della mappa
     */
    function configureMapEvents() {
        if (!map) return;

        map.on('style.load', () => {
            map.setProjection({ type: 'globe' });
            map.setSky(GEO_MAP_CONSTANTS.SKY_CONFIG);
            add3DBuildings();
        });

        map.on('load', () => {
            DrawTools.init(map);
        });
    }

    /**
     * Associa gli event UI (select stile, reset, cesium launcher)
     */
    function bindUIEvents() {
        if (domElements.styleSelect) {
            domElements.styleSelect.addEventListener('change', (e) => setStyle(e.target.value));
        }

        if (domElements.resetView) {
            domElements.resetView.addEventListener('click', resetView);
        }

        if (domElements.btnCesiumLaunch) {
            domElements.btnCesiumLaunch.addEventListener('click', handleCesiumLaunch);
        }

        // Bind toolbar header toggles for click-to-expand
        setupToolbarToggles();
    }

    /**
     * Setup toolbar header click handlers per toggle body visibility
     */
    function setupToolbarToggles() {
        const toolbarHeads = document.querySelectorAll('.toolbar-head[data-toggle]');
        
        toolbarHeads.forEach(head => {
            head.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleToolbar(head);
            });
        });
    }

    /**
     * Toggle visibility di una toolbar body e chiude le altre
     */
    function toggleToolbar(headElement) {
        const targetBodyId = headElement.getAttribute('data-toggle');
        const targetBody = document.getElementById(targetBodyId);
        
        if (!targetBody) return;

        // Se il body è già attivo, chiudilo
        const isActive = targetBody.classList.contains('active');
        if (isActive) {
            targetBody.classList.remove('active');
            headElement.setAttribute('aria-expanded', 'false');
            return;
        }

        // Chiudi tutti gli altri toolbars
        const allBodies = document.querySelectorAll('[id$="Body"].active');
        allBodies.forEach(body => {
            body.classList.remove('active');
            const headId = body.id.replace('Body', 'Head');
            const head = document.getElementById(headId);
            if (head) {
                head.setAttribute('aria-expanded', 'false');
            }
        });

        // Apri il toolbar cliccato
        targetBody.classList.add('active');
        headElement.setAttribute('aria-expanded', 'true');
    }

    /**
     * Gestisce il click su "Cesium Launch" - apre viewer 3D in nuova tab
     */
    function handleCesiumLaunch() {
        const userId = getStorageValue(STORAGE_KEYS.USER_ID) || localStorage.getItem('user_id');
        const projectId = getStorageValue(STORAGE_KEYS.PROJECT_ID) || localStorage.getItem('project_id');
        const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID) || localStorage.getItem('thread_id');

        if (!userId || !projectId || !threadId) {
            console.warn('[GeoMap] Cesium launch: mancano parametri sessione');
            return;
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/cesium-viewer';
        form.target = '_blank';

        form.appendChild(createFormInput('hidden', 'user_id', userId));
        form.appendChild(createFormInput('hidden', 'project_id', projectId));
        form.appendChild(createFormInput('hidden', 'thread_id', threadId));

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    }

    // =========================================================================
    // LAYER MANAGEMENT - AGGIUNTA LAYERS
    // =========================================================================

    /**
     * Aggiunge un layer vector (GeoJSON) alla mappa
     * @param {Object} layerData - Dati layer { layer_data: { src, title, description?, metadata? } }
     * @returns {string} ID layer assegnato
     * @throws {Error} Se rendering fallisce o layer esiste già
     */
    async function addVectorLayer(layerData) {
        console.log('[GeoMap] Adding vector layer:', layerData);

        try {
            const layerId = createLayerIdFromSource(layerData.layer_data.src);

            if (isLayerExists(layerId)) {
                console.warn('[GeoMap] Layer already exists:', layerId);
                return;
            }

            const toastId = Toasts.show(`Adding layer <i>"${escapeHtml(layerData.layer_data.title)}"</i> ...`);

            // Richiedi rendering URL dal backend
            const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);
            const renderResponse = await fetch(Routes.Agent.RENDER(threadId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(layerData)
            });

            if (!renderResponse.ok) {
                throw new Error(`render-layer HTTP ${renderResponse.status}`);
            }

            const renderInfo = await renderResponse.json();
            const renderUrl = renderInfo.src;

            if (!renderUrl) {
                throw new Error('render-layer: render_url mancante nella risposta');
            }

            // Fetchia GeoJSON dal render URL
            const geoJsonResponse = await fetch(renderUrl);
            if (!geoJsonResponse.ok) {
                throw new Error(`fetch GeoJSON HTTP ${geoJsonResponse.status}`);
            }

            const geoJsonData = await geoJsonResponse.json();

            // Aggiunge source
            map.addSource(layerId, { type: 'geojson', data: geoJsonData });

            // Aggiunge layers per ogni geometry type
            const baseView = { layout: { visibility: 'none' } };

            map.addLayer({
                id: `${layerId}-fill`,
                type: 'fill',
                source: layerId,
                filter: ['==', ['geometry-type'], 'Polygon'],
                paint: GEO_MAP_CONSTANTS.VECTOR_PAINT.fill,
                ...baseView
            });

            map.addLayer({
                id: `${layerId}-line`,
                type: 'line',
                source: layerId,
                filter: ['==', ['geometry-type'], 'LineString'],
                paint: GEO_MAP_CONSTANTS.VECTOR_PAINT.line,
                ...baseView
            });

            map.addLayer({
                id: `${layerId}-pt`,
                type: 'circle',
                source: layerId,
                filter: ['==', ['geometry-type'], 'Point'],
                paint: GEO_MAP_CONSTANTS.VECTOR_PAINT.point,
                ...baseView
            });

            // Registra layer
            registerLayer(layerId, {
                type: 'geojson',
                url: renderUrl,
                data: geoJsonData,
                name: layerData.layer_data.title,
                metadata: { 
                    ...(renderInfo.metadata || {}),
                    ...(layerData.layer_data.metadata || {})
                }
            });

            customLayerIds.add(layerId);

            Toasts.ok(toastId, `Layer <i>"${escapeHtml(layerData.layer_data.title)}"</i> added`);

            // Applica stile AI se presente nel layer descriptor (PLN-015 T-015-10)
            const layerStyle = layerData.layer_data.style || layerData.layer_data.metadata?.style;
            if (layerStyle) {
                setLayerStyle(layerId, layerStyle);
            }

            // Zoom to bounds se disponibile
            const bbox = renderInfo.metadata?.['bounding-box-wgs84'];
            if (bbox) {
                zoomToBounds(getBoundingBoxArray(bbox));
            }

            return layerId;

        } catch (err) {
            console.error('[GeoMap] Error adding vector layer:', err);
            showFlash(domElements.map, `Error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Aggiunge un layer COG raster con processing per tipo superficie
     * @param {Object} layerData - Dati layer
     * @param {Object} [viewParams={}] - Parametri aggiuntivi (non usati attualmente)
     */
    async function addCOG(layerData, viewParams = {}) {
        console.log('[GeoMap] Adding COG layer:', layerData);

        try {
            const layerId = createLayerIdFromSource(layerData.layer_data.src);

            if (isLayerExists(layerId)) {
                console.warn('[GeoMap] Layer already exists:', layerId);
                return;
            }

            const toastId = Toasts.show(`Adding layer <i>"${escapeHtml(layerData.layer_data.title)}"</i> ...`);

            // Richiedi rendering URL dal backend
            const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);
            const renderResponse = await fetch(Routes.Agent.RENDER(threadId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(layerData)
            });

            if (!renderResponse.ok) {
                throw new Error(`render-layer HTTP ${renderResponse.status}`);
            }

            const renderInfo = await renderResponse.json();
            const renderUrl = renderInfo.src;

            if (!renderUrl) {
                throw new Error('render-layer: render_url mancante');
            }

            // Determina tipo superficie e processa di conseguenza
            const surfaceType = layerData.layer_data.metadata?.surface_type || GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.RASTER;

            switch (surfaceType) {
                case GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.DEM:
                case GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.DEM_BUILDING:
                    await processDEMLayer(layerId, renderUrl, renderInfo, layerData);
                    break;

                case GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.RAIN_TIMESERIES:
                case GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.TEMPERATURE_TIMESERIES:
                    await processTimeSeriesLayer(layerId, renderUrl, renderInfo, layerData);
                    break;

                default:
                    await processSimpleRasterLayer(layerId, renderUrl, renderInfo, layerData);
            }

            
            // Registra layer
            registerLayer(layerId, {
                type: 'raster',
                url: renderUrl,
                name: layerData.layer_data.title,
                metadata: { 
                    ...(renderInfo.metadata || {}),
                    ...(layerData.layer_data.metadata || {})
                }
            });
            
            if (layerData.layer_data?.style) {
                setRasterStyle(layerId, layerData.layer_data.style);
            }
            
            customLayerIds.add(layerId);

            Toasts.ok(toastId, `Layer <i>"${escapeHtml(layerData.layer_data.title)}"</i> added`);

            // Apri sidebar layers e zoom
            LayerPanel.sidebarOpen();

            const bbox = layerData.layer_data.metadata?.['bounding-box-wgs84'];
            if (bbox) {
                zoomToBounds(getBoundingBoxArray(bbox));
            }

        } catch (err) {
            console.error('[GeoMap] Error adding COG layer:', err);
            showFlash(domElements.map, `Error: ${err.message}`);
            throw err;
        }
    }

    /**
     * Verifica se un layer con ID esiste sulla mappa
     * @param {string} layerId - ID layer
     * @returns {boolean}
     */
    function isLayerExists(layerId) {
        return map.getStyle().layers.some(l => l.id.includes(layerId));
    }

    /**
     * Registra layer nel registry interno
     * @param {string} layerId - ID layer
     * @param {Object} layerMeta - Metadati { type, url, data?, metadata? }
     */
    function registerLayer(layerId, layerMeta) {
        registry[layerId] = layerMeta;
    }

    // =========================================================================
    // COG PROCESSING - SURFACE TYPES
    // =========================================================================

    /**
     * Elabora layer DEM: aggiunge hypso colorate, hillshade, terrain
     * @param {string} layerId - ID layer
     * @param {string} renderUrl - URL rendering
     * @param {Object} renderInfo - Risposta rendering dal backend
     * @param {Object} layerData - Dati layer originali
     */
    async function processDEMLayer(layerId, renderUrl, renderInfo, layerData) {
        const colorMapStr = getColorMapString(layerData.layer_data.metadata?.surface_type || '', renderInfo);

        const demSources = {
            [`hipso_${layerId}`]: {
                type: 'raster',
                url: `cog://${renderUrl}${colorMapStr}`,
                tileSize: GEO_MAP_CONSTANTS.COG_TILE_SIZE
            },
            [`hillshade_${layerId}`]: {
                type: 'raster-dem',
                url: `cog://${renderUrl}#dem`,
                tileSize: GEO_MAP_CONSTANTS.COG_TILE_SIZE
            },
            [`terrain_${layerId}`]: {
                type: 'raster-dem',
                url: `cog://${renderUrl}#dem`,
                tileSize: GEO_MAP_CONSTANTS.COG_TILE_SIZE
            }
        };

        const baseView = { layout: { visibility: 'none' } };

        // Aggiungi sources
        Object.entries(demSources).forEach(([sourceId, sourceConfig]) => {
            map.addSource(sourceId, sourceConfig);
        });

        // Aggiungi hypso layer (rendering colormap)
        map.addLayer({
            id: `image_${layerId}`,
            type: 'raster',
            source: `hipso_${layerId}`,
            ...baseView,
            paint: { 'raster-opacity': 0.6 }
        });

        // Aggiungi hillshade
        map.addLayer({
            id: `hillshade_${layerId}`,
            type: 'hillshade',
            source: `hillshade_${layerId}`,
            ...baseView
        });

        // Applica terrain
        map.setTerrain({
            source: `terrain_${layerId}`,
            exaggeration: GEO_MAP_CONSTANTS.TERRAIN.exaggeration
        });

        console.log('[GeoMap] DEM layer processed with terrain:', layerId);
    }

    /**
     * Elabora layer time-series di pioggia: setup TimeSlider ranges
     * @param {string} layerId - ID layer
     * @param {string} renderUrl - URL rendering
     * @param {Object} renderInfo - Risposta rendering
     * @param {Object} layerData - Dati layer
     */
    async function processTimeSeriesLayer(layerId, renderUrl, renderInfo, layerData) {
        const baseView = { layout: { visibility: 'none' } };

        map.addSource(layerId, {
            type: 'raster',
            url: `cog://${renderUrl}`,
            tileSize: GEO_MAP_CONSTANTS.COG_TILE_SIZE
        });

        map.addLayer({
            id: layerId,
            type: 'raster',
            source: layerId,
            ...baseView
        });

        try {
            // Parse time bounds
            const metadata = layerData.layer_data.metadata || {};
            const tStart = metadata.time_start?.endsWith('Z')
                ? metadata.time_start
                : `${metadata.time_start}Z`;
            const tEnd = metadata.time_end?.endsWith('Z')
                ? metadata.time_end
                : `${metadata.time_end}Z`;

            const dStart = new Date(tStart);
            const dEnd = new Date(tEnd);

            if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
                throw new Error('Invalid time_start or time_end');
            }

            // Genera timestamp array per ogni banda
            const nBands = metadata.n_bands || 1;
            const timestamps = TimeSlider
                .dateRange(dStart, dEnd, nBands)
                .map(d => d.toISOString());

            // Registra ogni timestamp
            timestamps.forEach((ts, tsIdx) => {
                TimeSlider.registerTimestampItem(ts, {
                    type: 'raster-band',
                    layer_id: layerId,
                    render_url: renderUrl,
                    band: tsIdx + 1,
                    surface_type: metadata.surface_type || 'unknown',
                    cog_layer: { id: layerId, type: 'raster', source: layerId }
                });
            });

            // Setup TimeSlider range (midnight - midnight ±2 ore)
            const rangeStart = new Date(Date.UTC(
                dStart.getUTCFullYear(),
                dStart.getUTCMonth(),
                dStart.getUTCDate(),
                0, 0, 0, 0
            ) - (2 * 60 * 60 * 1000));

            const rangeEnd = new Date(Date.UTC(
                dEnd.getUTCFullYear(),
                dEnd.getUTCMonth(),
                dEnd.getUTCDate() + 1,
                0, 0, 0, 0
            ) + (2 * 60 * 60 * 1000));

            TimeSlider.setRange(rangeStart.toISOString(), rangeEnd.toISOString());

            // Aggiungi interval visualizzazione
            const interval = {
                start: tStart,
                end: tEnd,
                label: escapeHtml(layerData.layer_data.title || 'Time Series')
            };
            TimeSlider.setIntervals([interval]);

            console.log('[GeoMap] Time-series layer processed:', layerId);

        } catch (err) {
            console.error('[GeoMap] Error processing time-series:', err);
            throw err;
        }
    }

    /**
     * Elabora layer raster standard con colormap
     * @param {string} layerId - ID layer
     * @param {string} renderUrl - URL rendering
     * @param {Object} renderInfo - Risposta rendering
     * @param {Object} layerData - Dati layer
     */
    async function processSimpleRasterLayer(layerId, renderUrl, renderInfo, layerData) {
        const colorMapStr = getColorMapString(layerData.layer_data.metadata?.surface_type || '', renderInfo);

        const baseView = { layout: { visibility: 'none' } };
        const basePaint = { paint: { 'raster-opacity': 0.6 } };

        map.addSource(layerId, {
            type: 'raster',
            url: `cog://${renderUrl}${colorMapStr}`,
            tileSize: GEO_MAP_CONSTANTS.COG_TILE_SIZE
        });

        map.addLayer({
            id: layerId,
            type: 'raster',
            source: layerId,
            ...baseView,
            ...basePaint
        });

        console.log('[GeoMap] Simple raster layer processed:', layerId);
    }

    /**
     * Costruisce stringa colormap per COG protocol
     * @param {string} surfaceType - Tipo superficie
     * @param {Object} renderInfo - Metadati dal backend
     * @returns {string} Stringa colormap (es: "#color:BrewerBrBG10,0,1000,c-")
     */
    function getColorMapString(surfaceType, renderInfo) {
        let colormap = GEO_MAP_CONSTANTS.COLORMAPS.TERRAIN_DEFAULT;
        let minVal = 0;
        let maxVal = 1000;

        if (surfaceType === GEO_MAP_CONSTANTS.RASTER_SURFACE_TYPES.WATER_DEPTH) {
            colormap = GEO_MAP_CONSTANTS.COLORMAPS.WATER;
            maxVal = GEO_MAP_CONSTANTS.COLORMAP_RANGES.water.max;
        } else if (renderInfo?.metadata?.max) {
            maxVal = renderInfo.metadata.max;
        }

        return `#color:${colormap},${minVal},${maxVal},c-`;
    }

    // =========================================================================
    // 3D TERRAIN E BUILDINGS
    // =========================================================================

    /**
     * Aggiunge layer 3D buildings da OpenFreemap
     */
    function add3DBuildings() {
        if (!map) return;

        try {
            const layers = map.getStyle().layers || [];
            const labelLayerId = findLabelLayerId(layers);

            // Aggiungi source solo se non già presente (es: dopo switchBuildingsSource)
            if (!map.getSource(GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapId)) {
                map.addSource(GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapId, {
                    url: GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapUrl,
                    type: 'vector'
                });
            }

            map.addLayer(
                {
                    id: GEO_MAP_CONSTANTS.BUILDINGS_3D.id,
                    source: GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapId,
                    'source-layer': GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapSourceLayer,
                    type: 'fill-extrusion',
                    minzoom: GEO_MAP_CONSTANTS.BUILDINGS_3D.minzoom,
                    filter: ['!=', ['get', 'hide_3d'], true],
                    paint: {
                        'fill-extrusion-color': GEO_MAP_CONSTANTS.BUILDINGS_3D['fill-extrusion-color'],
                        'fill-extrusion-height': GEO_MAP_CONSTANTS.BUILDINGS_3D['fill-extrusion-height'],
                        'fill-extrusion-base': GEO_MAP_CONSTANTS.BUILDINGS_3D['fill-extrusion-base']
                    }
                },
                labelLayerId
            );

            console.log('[GeoMap] 3D buildings layer added');

        } catch (err) {
            console.error('[GeoMap] Error adding 3D buildings:', err);
        }
    }

    /**
     * Trova layer symbol type con text-field per corretto z-order dei buildings
     * @param {Array} layers - Array di layer dalla style
     * @returns {string|undefined} Layer ID o undefined
     */
    function findLabelLayerId(layers) {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.type === 'symbol' && layer.layout?.['text-field']) {
                return layer.id;
            }
        }
        return undefined;
    }

    /**
     * Restituisce la lista delle sorgenti disponibili per gli edifici 3D:
     * la sorgente default (OpenFreemap) + tutti i layer nel registry con surface_type='buildings'
     * @returns {Array<{id: string, label: string}>}
     */
    function getBuildingsSources() {
        const sources = [{ id: 'default', label: 'Default (OpenFreemap)' }];
        Object.entries(registry).forEach(([id, meta]) => {
            if (meta.metadata?.surface_type === GEO_MAP_CONSTANTS.VECTOR_FEATURE_TYPES.BUILDINGS) {
                const label = meta?.name || id;
                sources.push({ id, label });
            }
        });
        return sources;
    }

    /**
     * Cambia la sorgente usata per il layer 3D buildings.
     * Rimuove il layer corrente e ne aggiunge uno nuovo dalla sorgente indicata.
     * @param {string} sourceId - 'default' oppure layerId dal registry con surface_type='buildings'
     */
    function switchBuildingsSource(sourceId) {
        currentBuildingsSource = sourceId;
        const layerId = GEO_MAP_CONSTANTS.BUILDINGS_3D.id;

        // Rimuovi layer esistente (la source rimane in mappa per riuso)
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }

        if (sourceId === 'default') {
            add3DBuildings();
            return;
        }

        // Layer personalizzato da registry (GeoJSON con polygon features)
        const layers = map.getStyle().layers || [];
        const labelLayerId = findLabelLayerId(layers);

        // Leggi il fill-color applicato al layer GeoJSON (se esiste uno stile custom)
        const fillLayerId = `${sourceId}-fill`;
        const existingFillColor = map.getLayer(fillLayerId)
            ? map.getPaintProperty(fillLayerId, 'fill-color')
            : null;

        const extrusionColor = existingFillColor || [
            'interpolate', ['linear'],
            ['coalesce', ['get', 'height'], 5],
            0, 'lightgray',
            200, 'royalblue',
            400, 'lightblue'
        ];

        try {
            map.addLayer(
                {
                    id: layerId,
                    source: sourceId,
                    type: 'fill-extrusion',
                    minzoom: GEO_MAP_CONSTANTS.BUILDINGS_3D.minzoom,
                    paint: {
                        'fill-extrusion-color': extrusionColor,
                        'fill-extrusion-height': ['coalesce', ['get', 'height'], ['get', 'render_height'], 5],
                        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], ['get', 'render_min_height'], 0],
                        'fill-extrusion-opacity': 0.85
                    }
                },
                labelLayerId
            );
            console.log('[GeoMap] Switched 3D buildings source to:', sourceId);
        } catch (err) {
            console.error('[GeoMap] Error switching buildings source:', err);
        }
    }

    // =========================================================================
    // VISIBILITY E RENDERING DINAMICO
    // =========================================================================

    /**
     * Verifica se layer ID è visibile sulla mappa
     * @param {string} layerId - ID layer
     * @returns {boolean}
     */
    function isLayerVisible(layerId) {
        return map.getStyle().layers.some(l =>
            l.id.includes(layerId) && map.getLayoutProperty(l.id, 'visibility') === 'visible'
        );
    }

    /**
     * Toggle visibilità di un layer e zoom a bounds se attivato
     * @param {Object} layerData - Dati layer con id e metadata
     */
    function toggleLayerMapVisibility(layerData) {
        console.log('[GeoMap] Toggling visibility for layer:', layerData);

        try {
            if (!layerData?.id) {
                console.warn('[GeoMap] toggleLayerMapVisibility: manca layer id');
                return;
            }

            const styleLayersToToggle = map.getStyle().layers.filter(l => l.id.includes(layerData.id));

            styleLayersToToggle.forEach(styleLayer => {
                const currentViz = map.getLayoutProperty(styleLayer.id, 'visibility');
                const newViz = currentViz === 'visible' ? 'none' : 'visible';
                map.setLayoutProperty(styleLayer.id, 'visibility', newViz);

                // Se ora visibile e abbiamo bbox, zoom
                if (newViz === 'visible' && layerData.metadata?.['bounding-box-wgs84']) {
                    const bbox = getBoundingBoxArray(layerData.metadata['bounding-box-wgs84']);
                    zoomToBounds(bbox);
                }
            });

        } catch (err) {
            console.error('[GeoMap] Error toggling visibility:', err);
        }
    }

    /**
     * Aggiorna raster multibanda in base a timestamp selezionato
     * Chiamato da TimeSlider onChange event
     * @param {string} timestamp - ISO timestamp
     */
    function renderTimestampRasters(timestamp) {
        const timestampItems = TimeSlider.getTimestampItems(timestamp, 'raster-band');

        timestampItems.forEach(item => {
            const { layer_id, render_url, band, surface_type, cog_layer } = item;
            const isVisible = isLayerVisible(layer_id);

            if (!isVisible) {
                return;  // Salta se layer non visibile
            }

            try {
                updateRasterBandColor(render_url, band, surface_type);

                // Refresh layer sul rendering
                if (map.getLayer(layer_id)) {
                    map.removeLayer(layer_id);
                    map.addLayer({
                        ...cog_layer,
                        layout: { visibility: 'visible' }
                    });
                }

                console.log(`[GeoMap] Updated raster band:`, { layer_id, band, timestamp });

            } catch (err) {
                console.error('[GeoMap] Error updating raster band:', err);
            }
        });
    }

    /**
     * Helper: applica funzione colore a banda raster
     * @param {string} renderUrl - URL raster
     * @param {number} band - Numero banda (1-based)
     * @param {string} surfaceType - Tipo superficie
     */
    function updateRasterBandColor(renderUrl, band, surfaceType) {
        if (!surfaceColorscalesMap[surfaceType]) {
            console.warn(`[GeoMap] No colorscale for surface type: ${surfaceType}`);
            return;
        }

        const colorscale = surfaceColorscalesMap[surfaceType];
        const maxValue = colorscale.domain().at(-1);

        MaplibreCOGProtocol.setColorFunction(renderUrl, (pixel, color, metadata) => {
            const value = pixel[band];  // 1-based band

            if (value === metadata.noData) {
                color[3] = 0;  // Transparent
            } else {
                const [r, g, b] = colorscale(value * (metadata.scale || 1) + (metadata.offset || 0));

                color[0] = r;
                color[1] = g;
                color[2] = b;

                // Alpha computato con curva esponenziale
                const normalizedValue = Math.max(Math.min(value / maxValue, 1), 0);
                color[3] = normalizedValue > 0
                    ? Math.min((Math.pow(Math.E, normalizedValue - 1)), 1) * 200
                    : 10;
            }
        });
    }

    // =========================================================================
    // NAVIGATION E VIEW MANAGEMENT
    // =========================================================================

    /**
     * Zoom a bounding box se non già contenuta nella view corrente
     * @param {Array} bbox - Bounding box [SW, NE] o [minx, miny, maxx, maxy]
     * @param {number} [padding=20] - Padding in px
     * @param {number} [duration=1500] - Durata animazione ms
     */
    function zoomToBounds(bbox, padding = GEO_MAP_CONSTANTS.VIEW_DEFAULTS.zoomPadding, duration = GEO_MAP_CONSTANTS.VIEW_DEFAULTS.zoomDuration) {
        if (!map || !bbox || bbox.length < 4) {
            console.warn('[GeoMap] zoomToBounds: bbox non valido', bbox);
            return;
        }

        const targetSW = [bbox[0], bbox[1]];
        const targetNE = [bbox[2], bbox[3]];

        // Controlla se view corrente contiene già il target
        const currentBounds = map.getBounds();
        const curSW = currentBounds.getSouthWest();
        const curNE = currentBounds.getNorthEast();

        const isInside =
            curSW.lng >= targetSW[0] &&
            curSW.lat >= targetSW[1] &&
            curNE.lng <= targetNE[0] &&
            curNE.lat <= targetNE[1];

        if (!isInside) {
            map.fitBounds([targetSW, targetNE], {
                padding,
                duration
            });
        }
    }

    /**
     * Resetta la view della mappa al default
     */
    function resetView() {
        if (!map) return;

        map.easeTo({
            center: GEO_MAP_CONSTANTS.MAP_CONFIG.defaultCenter,
            zoom: GEO_MAP_CONSTANTS.VIEW_DEFAULTS.resetZoom,
            bearing: GEO_MAP_CONSTANTS.VIEW_DEFAULTS.resetBearing,
            pitch: GEO_MAP_CONSTANTS.VIEW_DEFAULTS.resetPitch,
            duration: GEO_MAP_CONSTANTS.VIEW_DEFAULTS.zoomEaseDuration
        });
    }

    /**
     * Sposta la mappa su un luogo o bounding box (PLN-015 T-015-07)
     * @param {Object} params
     * @param {Array} [params.center] - [lon, lat]
     * @param {number} [params.zoom] - Zoom level
     * @param {Object} [params.bbox] - { west, south, east, north } o [W, S, E, N]
     */
    function moveView({ center, zoom, bbox } = {}) {
        if (!map) return;
        try {
            if (bbox) {
                const w = bbox.west  ?? bbox[0];
                const s = bbox.south ?? bbox[1];
                const e = bbox.east  ?? bbox[2];
                const n = bbox.north ?? bbox[3];
                map.fitBounds([[w, s], [e, n]], { padding: 40 });
            } else if (center) {
                map.flyTo({ center, zoom: zoom ?? map.getZoom() });
            } else {
                console.warn('[GeoMap] moveView: nessun parametro valido (center o bbox richiesto)');
            }
        } catch (err) {
            console.error('[GeoMap] moveView error:', err);
        }
    }

    /**
     * Applica uno stile MapLibre a un layer già presente sulla mappa (PLN-015 T-015-08)
     * @param {string} layerId - ID base del layer (btoa(src))
     * @param {Object} style - { paint, layout, filter }
     */
    function setLayerStyle(layerId, style) {
        console.log(layerId)
        if (!map || !layerId || !style) return;
        const { paint = {}, layout = {}, filter } = style;
        const sublayerSuffixes = ['-fill', '-line', '-pt', ''];
        sublayerSuffixes.forEach(suffix => {
            const id = suffix ? `${layerId}${suffix}` : layerId;
            if (!map.getLayer(id)) return;
            Object.entries(paint).forEach(([prop, value]) => {
                try { map.setPaintProperty(id, prop, value); }
                catch (e) { /* property incompatible with sublayer type — skip */ }
            });
            Object.entries(layout).forEach(([prop, value]) => {
                try { map.setLayoutProperty(id, prop, value); }
                catch (e) { /* skip incompatible layout property */ }
            });
            if (filter !== undefined) {
                try { map.setFilter(id, filter); }
                catch (e) { /* skip invalid filter */ }
            }
        });
        console.log('[GeoMap] setLayerStyle applied to:', layerId);
    }

    /**
     * Applica uno stile raster (colormap, min/max, opacity) a un layer COG già presente sulla mappa.
     * Se cambia solo l'opacity, aggiorna direttamente il paint property.
     * Se cambia la colormap o il range, rimuove e riagggiunge source + layer con il nuovo URL.
     * @param {string} layerId - ID base del layer (btoa(src))
     * @param {Object} style - { colormap, min, max, opacity, reverse, colormapString? }
     */
    function setRasterStyle(layerId, style) {
        if (!map || !layerId || !style) return;

        const reg = registry[layerId];
        if (!reg || !reg.url) {
            console.warn('[GeoMap] setRasterStyle: layer not found in registry:', layerId);
            return;
        }

        const renderUrl = reg.url;
        const colormapChanged = style.colormap !== undefined || style.min !== undefined || style.max !== undefined || style.reverse !== undefined;

        // Quick path: only opacity changed
        if (!colormapChanged && style.opacity !== undefined) {
            map.getStyle().layers
                .filter(l => l.id.includes(layerId) && l.type === 'raster')
                .forEach(l => {
                    try { map.setPaintProperty(l.id, 'raster-opacity', style.opacity); } catch (e) { /* skip */ }
                });
            if (reg.metadata) reg.metadata.opacity = style.opacity;
            return;
        }

        const wasVisible = isLayerVisible(layerId);

        // Remove existing sub-layers and sources
        const currentStyle = map.getStyle();
        if (currentStyle) {
            currentStyle.layers
                .filter(l => l.id.includes(layerId) && l.type === 'raster')
                .map(l => l.id)
                .forEach(lid => { try { map.removeLayer(lid); } catch (e) { /* already removed */ } });

            Object.keys(currentStyle.sources || {})
                .filter(sid => sid === layerId)
                .forEach(sid => { try { map.removeSource(sid); } catch (e) { /* already removed */ } });
        }

        // Build colormap string
        const colormap = style.colormap || 'BrewerSpectral11';
        const min = style.min ?? 0;
        const max = style.max ?? 1000;
        const reverse = style.reverse || false;
        const flags = reverse ? 'c-' : 'c';
        const colorMapStr = style.colormapString || `#color:${colormap},${min},${max},${flags}`;

        // Re-add source and layer
        try {
            map.addSource(layerId, {
                type: 'raster',
                url: `cog://${renderUrl}${colorMapStr}`,
                tileSize: GEO_MAP_CONSTANTS.COG_TILE_SIZE
            });

            map.addLayer({
                id: layerId,
                type: 'raster',
                source: layerId,
                layout: { visibility: wasVisible ? 'visible' : 'none' },
                paint: { 'raster-opacity': style.opacity ?? 0.6 }
            });

            // Update registry metadata
            if (reg.metadata) {
                Object.assign(reg.metadata, { colormap, min, max, reverse, opacity: style.opacity ?? 0.6 });
            }

            console.log('[GeoMap] setRasterStyle applied to:', layerId);
        } catch (err) {
            console.error('[GeoMap] setRasterStyle failed:', err);
        }
    }

    /**
     * Cambia lo stile della mappa e ripulisce state correlati
     * @param {string} styleUrl - URL nuovo stile
     */
    function setStyle(styleUrl) {
        if (!map) return;

        try {
            map.setStyle(styleUrl);

            // Ripulisci state dipendenti
            TimeSlider.clearIntervals();
            LayerPanel.reloadProjectLayers();

            console.log('[GeoMap] Style changed');

        } catch (err) {
            console.error('[GeoMap] Error setting style:', err);
        }
    }

    // =========================================================================
    // UTILITY HELPERS
    // =========================================================================

    /**
     * Genera ID layer encodato da source string
     * @param {string} source - Source string
     * @returns {string} Base64-encoded layer ID
     */
    function createLayerIdFromSource(source) {
        return btoa(source || `layer-${Math.random()}`);
    }

    /**
     * Crea input HTML nascosto per form POST
     * @param {string} type - Tipo input
     * @param {string} name - Nome input
     * @param {string} value - Valore input
     * @returns {HTMLInputElement}
     */
    function createFormInput(type, name, value) {
        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.value = value;
        return input;
    }

    /**
     * Converte bbox object a array [minx, miny, maxx, maxy]
     * @param {Object} bboxObj - { minx, miny, maxx, maxy }
     * @returns {Array} [minx, miny, maxx, maxy]
     */
    function getBoundingBoxArray(bboxObj) {
        if (Array.isArray(bboxObj) && bboxObj.length === 4) {
            return bboxObj;
        }
        return [bboxObj.minx, bboxObj.miny, bboxObj.maxx, bboxObj.maxy];
    }

    // =========================================================================
    // LAYER REORDER
    // =========================================================================

    /**
     * Riordina i layer sulla mappa secondo l'ordine della sidebar
     * Il primo elemento dell'array corrisponde al layer visivamente in cima (z-order più alto)
     * @param {string[]} order - Array di base layer ID (btoa(src)) in ordine top→bottom del panel
     */
    function reorderLayers(order) {
        if (!map || !Array.isArray(order) || order.length === 0) return;

        const styleLayers = map.getStyle().layers;

        // Processa dal basso verso l'alto: l'ultimo processato finisce in cima
        [...order].reverse().forEach(baseId => {
            const subLayerIds = styleLayers
                .filter(l => l.id.includes(baseId))
                .map(l => l.id);

            subLayerIds.forEach(subLayerId => {
                try {
                    map.moveLayer(subLayerId);
                } catch (err) {
                    console.warn('[GeoMap] reorderLayers: impossibile spostare layer', subLayerId, err);
                }
            });
        });

        console.log('[GeoMap] Layers reordered:', order);
    }

    // =========================================================================
    // LAYER RELOAD
    // =========================================================================

    /**
     * Rimuove dalla mappa tutti i sub-layer e le sorgenti associati a un layerId.
     * Pulisce anche registry e customLayerIds.
     * @param {string} layerId - ID base del layer
     */
    function removeLayerFromMap(layerId) {
        if (!map) return;
        const style = map.getStyle();
        if (!style) return;

        // Rimuovi tutti i sub-layer che contengono questo layerId
        style.layers
            .filter(l => l.id.includes(layerId))
            .map(l => l.id)
            .forEach(lid => {
                try { map.removeLayer(lid); } catch (e) { /* già rimosso */ }
            });

        // Rimuovi tutte le sorgenti che contengono questo layerId (DEM ha prefissi)
        Object.keys(style.sources || {})
            .filter(sid => sid.includes(layerId))
            .forEach(sid => {
                try { map.removeSource(sid); } catch (e) { /* già rimosso */ }
            });

        // Disabilita terrain se era associato a questo layer
        try {
            const terrain = map.getTerrain();
            if (terrain?.source?.includes(layerId)) {
                map.setTerrain(null);
            }
        } catch (e) { /* ignora */ }

        delete registry[layerId];
        customLayerIds.delete(layerId);
    }

    /**
     * Ricarica un layer sulla mappa con la configurazione aggiornata.
     * Se il layer era visibile, lo rende nuovamente visibile dopo il reload.
     * @param {Object} layer - Oggetto layer { src, type, title, description, metadata }
     */
    async function reloadLayer(layer) {
        if (!layer?.src) return;

        const layerId = createLayerIdFromSource(layer.src);
        const existsOnMap = isLayerExists(layerId);

        if (!existsOnMap) return;  // layer non ancora aggiunto → niente da ricaricare

        const wasVisible = isLayerVisible(layerId);

        removeLayerFromMap(layerId);

        // Ricostruisce il formato atteso da addVectorLayer / addCOG
        const layerData = {
            layer_data: {
                src: layer.src,
                title: layer.title || '',
                description: layer.description || '',
                type: layer.type,
                metadata: layer.metadata || {}
            }
        };

        try {
            if (layer.type === 'vector') {
                await addVectorLayer(layerData);
            } else {
                await addCOG(layerData);
            }

            // Ripristina visibilità se era visibile
            if (wasVisible) {
                const reloadedLayerId = createLayerIdFromSource(layer.src);
                map.getStyle().layers
                    .filter(l => l.id.includes(reloadedLayerId))
                    .forEach(l => map.setLayoutProperty(l.id, 'visibility', 'visible'));
            }
        } catch (err) {
            console.error('[GeoMap] reloadLayer failed:', err);
        }
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        addVectorLayer,
        addCOG,
        reloadLayer,
        setStyle,
        resetView,
        moveView,
        setLayerStyle,
        setRasterStyle,
        toggleLayerMapVisibility,
        renderTimestampRasters,
        zoomToBounds,
        reorderLayers
    };
})();
