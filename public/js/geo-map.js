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
        'GEO_MAP_CONSTANTS.SURFACE_TYPES': 'Enum: DEM, DEM_BUILDING, RAIN_TIMESERIES, WATER_DEPTH, RASTER',
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
        add3DBuildings: 'Trova labelLayerId → addSource("openfreemap") → addLayer("3d-buildings") con fill-extrusion paint config',
        findLabelLayerId: 'Loop layers, trova primo con type="symbol" && layout["text-field"]',

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
            'sky-color': '#199EF3',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#ffffff',
            'horizon-fog-blend': 0.5,
            'fog-color': '#c5c5d0',
            'fog-ground-blend': 0.5,
            'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0]
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
            exaggeration: 1.5
        },

        // Vector layer paint styles
        VECTOR_PAINT: {
            fill: { 'fill-color': '#6ee7b7', 'fill-opacity': 0.25 },
            line: { 'line-color': '#6ee7b7', 'line-width': 2 },
            point: { 'circle-color': '#6ee7b7', 'circle-radius': 4 }
        },

        // Raster layer paint styles
        RASTER_PAINT: {
            default: { 'raster-opacity': 0.6 },
            transparent: { 'raster-opacity': 0 }
        },

        // Surface type identifiers
        SURFACE_TYPES: {
            DEM: 'dem',
            DEM_BUILDING: 'dem-building---',
            RAIN_TIMESERIES: 'rain-timeseries',
            WATER_DEPTH: 'water-depth',
            RASTER: 'raster'
        },

        // Colormaps per tipo superficie
        COLORMAPS: {
            TERRAIN_DEFAULT: 'BrewerBrBG10',
            WATER: 'CartoTealGrn',
            RAIN: 'BrewerSpectral11'
        },

        // Colormap range defaults
        COLORMAP_RANGES: {
            water: { min: 0, max: 2 },
            terrain: { min: 0, max: 1000 },
            rain: { min: 0, max: 50 }  // mm/h assumed max
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
    let surfaceColorscalesMap = {
        [GEO_MAP_CONSTANTS.SURFACE_TYPES.RAIN_TIMESERIES]: MaplibreCOGProtocol.colorScale({
            colorScheme: GEO_MAP_CONSTANTS.COLORMAPS.RAIN,
            min: 0,
            max: 200,
            isContinuous: true,
            isReverse: true
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
     * Configura i controlli della mappa
     */
    function configureControls() {
        if (!map) return;

        map.addControl(new maplibregl.NavigationControl());
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
        map.addControl(new maplibregl.GlobeControl(), 'top-right');
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
                metadata: renderInfo.metadata || {}
            });

            customLayerIds.add(layerId);

            Toasts.ok(toastId, `Layer <i>"${escapeHtml(layerData.layer_data.title)}"</i> added`);

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
            const surfaceType = layerData.layer_data.metadata?.surface_type || GEO_MAP_CONSTANTS.SURFACE_TYPES.RASTER;

            switch (surfaceType) {
                case GEO_MAP_CONSTANTS.SURFACE_TYPES.DEM:
                case GEO_MAP_CONSTANTS.SURFACE_TYPES.DEM_BUILDING:
                    await processDEMLayer(layerId, renderUrl, renderInfo, layerData);
                    break;

                case GEO_MAP_CONSTANTS.SURFACE_TYPES.RAIN_TIMESERIES:
                    await processTimeSeriesLayer(layerId, renderUrl, renderInfo, layerData);
                    break;

                default:
                    await processSimpleRasterLayer(layerId, renderUrl, renderInfo, layerData);
            }

            // Registra layer
            registerLayer(layerId, {
                type: 'raster',
                url: renderUrl,
                metadata: renderInfo.metadata || {}
            });

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
                    surface_type: GEO_MAP_CONSTANTS.SURFACE_TYPES.RAIN_TIMESERIES,
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

        if (surfaceType === GEO_MAP_CONSTANTS.SURFACE_TYPES.WATER_DEPTH) {
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

            map.addSource(GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapId, {
                url: GEO_MAP_CONSTANTS.TILE_SOURCES.openfreemapUrl,
                type: 'vector'
            });

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
        const maxValue = GEO_MAP_CONSTANTS.COLORMAP_RANGES.rain.max;  // Assunto per rain

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
                    ? Math.min((Math.pow(Math.E, normalizedValue - 1)), 1) * 180 
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
    // EXPORTED API
    // =========================================================================

    return {
        init,
        addVectorLayer,
        addCOG,
        setStyle,
        resetView,
        toggleLayerMapVisibility,
        renderTimestampRasters,
        zoomToBounds
    };
})();
