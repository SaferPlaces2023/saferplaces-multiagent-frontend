/**
 * DrawTools - Modulo per disegno di shapes sulla mappa MapLibre
 * 
 * Responsabilità:
 * - Drawing tools: point, linestring, bbox, polygon
 * - Edit mode: move/resize bbox con drag handles
 * - Feature collections: registry, persistence, sync con agent state
 * - UI panel: lista collections con actions (zoom, download, visibility)
 * 
 * Dipendenze: MapLibre-GL, _utils.js, _consts.js, GeoMap, Routes
 */
const DrawTools = (() => {

    const MODULE_SUMMARY = {
        // COSTANTI GLOBALI
        'DRAW_CONSTANTS.DRAWING': 'Modalità disegno: point, linestring, bbox, polygon',
        'DRAW_CONSTANTS.COLORS': 'Paint: #f00 (disegno), #00f (handles), opacity, width, radius',
        'DRAW_CONSTANTS.HANDLES': 'Edit handles: size 6px, tolerance click 10px, colore blu',
        'DRAW_CONSTANTS.UI_TEXT': 'Messaggi: "Nessuna collection", "details", "hide"',
        'DRAW_CONSTANTS.LAYER_NAMES': 'Prefissi: "draw-{type}-src-{id}", "draw-{type}-layer-{id}"',
        'DRAW_CONSTANTS.STORAGE': 'localStorage key per thread_id',

        // DOM_IDS
        DOM_IDS: 'Mapping 12 elementi DOM: buttons (Point,Line,Bbox,Poly,Edit,Del,Save,Cancel), panel (Collection,Panel,List,Count)',

        // STATO INTERNO - DRAWING
        'state.drawing.map': 'Istanza MapLibre',
        'state.drawing.isDrawing': 'Flag modalità disegno attiva',
        'state.drawing.drawMode': 'Tipo corrente: point|linestring|bbox|polygon',
        'state.drawing.current_collection_id': 'ID unico collezione in disegno (randomId8)',
        'state.drawing.current_feature_collection': 'FeatureCollection accumulata durante disegno',

        // STATO INTERNO - BBOX DRAWING
        'state.bbox.bboxStartLngLat': 'Primo punto click bbox',
        'state.bbox.isBboxDragging': 'Flag drag in corso',

        // STATO INTERNO - POLYGON DRAWING
        'state.polygon.polyCoords': 'Array [lng,lat] vertici accumulati',
        'state.polygon.isPolyDrawing': 'Flag polygon drawing started',
        'state.polygon.lastMouseLngLat': 'Ultima posizione mouse per preview',

        // STATO INTERNO - EDIT MODE
        'state.edit.isEditing': 'Flag edit mode attiva',
        'state.edit.editTarget': '{srcId, bbox}',
        'state.edit.dragState': '{kind, startLngLat, startBbox, cornerKey}',

        // STATO INTERNO - COLLECTIONS & UI
        'state.registry.DrawFeatureCollections': 'Object: sourceId → {type, features[], metadata{}}',
        'state.ui.domElements': 'Cache elementi DOM via cacheElements()',
        'state.ui.btnPoint...btnCancel': 'Riferimenti button disegno',
        'state.ui.dtCollection...dtCount': 'Riferimenti panel collections',

        // INIZIALIZZAZIONE
        init: 'Entry: cacheElements → bindDrawingToolButtons → bindPanelButtons → bindDocumentEvents',
        bindDrawingToolButtons: 'Bind: dtPoint, dtLine, dtBbox, dtPoly, dtEdit, dtSave, dtCancel',
        bindPanelButtons: 'Bind: dtCollection toggle panel, renderCollectionsPanel listener',
        bindDocumentEvents: 'Bind: "draw-tool:update-user-drawn-shapes" event listener',
        cacheDrawingUIElements: 'cacheElements() per 12 DOM IDs',

        // CONTROLLO MODALITA
        setActive: 'Attiva button, stop drawing corrente se attivo, applica classe "active"',
        start: 'START drawing: setup event listeners, mostra drawConfirm, azzera stato',
        stop: 'STOP drawing: rimuove listeners, salva o cancella collection',

        // HANDLERS EVENTO - UNIFICATI
        'onClick': 'Gestore click: branch per isEditing vs isDrawing vs modo',
        'onClickDraw': 'Sub-handler: logica punto/polygon su click',
        'onClickEdit': 'Sub-handler: hit-test bbox fill, seleziona e mostra handles',

        'onMouseDown': 'Gestore mousedown: branch per isEditing vs isDrawing',
        'onMouseDownDraw': 'Sub-handler: setup bbox drag, disabilita map pan',
        'onMouseDownEdit': 'Sub-handler: hit-test handles (resize) o inside bbox (move)',

        'onMouseMove': 'Gestore mousemove: branch per isEditing vs isDrawing',
        'onMouseMoveDraw': 'Sub-handler: aggiorna bbox/polygon feature preview',
        'onMouseMoveEdit': 'Sub-handler: calcola offset move/resize, applica bbox',

        'onMouseUp': 'Gestore mouseup: riabilita map pan',
        'onKeyDown': 'Escape key: cancella polygon drawing', 

        // LAYER MANAGEMENT - CREATION
        drawPointLayer: 'Aggiunge source geojson + layer circle per points',
        drawBboxLayer: 'Aggiunge source geojson + layers fill+line per bbox/polygon',
        drawBboxFeatureCollection: 'API pubblica: aggiunge feature collection bbox da backend',
        drawPolygonLayer: 'Aggiunge source geojson + layers fill+line per polygon preview',

        // FEATURE UPDATES
        pushPoint: 'Aggiunge Point feature a collezione corrente',
        updateBboxFeature: 'Crea/aggiorna Polygon rettangolo da due LngLat',
        updatePolygonPreview: 'Aggiorna polygon preview con mouse position (LineString→Polygon se ≥3pt)',
        finishPolygon: 'Chiude ring polygon, disabilita disegno, riabilita dgbClickZoom',

        // EDIT MODE
        startEditBboxMode: 'Attiva modalità edit: bind listeners, mostra handles layer',
        stopEditMode: 'Disattiva modalità edit: salva changes, unbind listeners',
        ensureHandlesLayer: 'Crea source+layer handles se non esiste',
        clearHandles: 'Ripulisce handle features da map',
        setHandlesFromBbox: 'Crea 4 handle points da bbox corners',
        handleFeature: 'Factory: crea Point feature handle con key (sw/se/ne/nw)',
        beginDrag: 'Setup dragState {kind, startLngLat, startBbox, cornerKey}',
        applyBbox: 'Applica bbox nuovo: aggiorna editTarget, source, handles',
        bboxToPolygonFeature: 'Converte bbox {minLng,minLat,maxLng,maxLat} a Polygon Feature',
        bboxFromFeatureCollection: 'Estrae bbox da Feature Polygon rettangolare',
        getAllBboxFillLayerIds: 'Lista layer IDs di tutte bbox nel registry',

        // COLLECTIONS PERSISTENCE
        saveFeatureCollection: 'Salva collection in registry, calcola bounds, sync agent state',
        updateUserDrawnShapesAgentState: 'POST /state con user_drawn_shapes array',
        getFeatureCollection: 'Retrieves da DrawFeatureCollections',
        listFeatureCollections: 'Returns array di collection keys',
        removeFeatureCollection: 'Rimuove da registry e mappa',
        clearAllFeatureCollections: 'Pulisce intero registry',

        // UI PANEL
        renderCollectionsPanel: 'Popola dtList con items, bind eye toggle + menu actions',
        guessType: 'Indovina tipo feature da geometry (Point→point, etc)',
        renderTypeIcon: 'Mappa tipo → icon material (location_on, polyline, etc)',

        // UTILITY
        randomId8: 'Genera ID random 8 char per collection_id',
        zoom_to_feature_collection: 'Chiama GeoMap.zoomToBounds() per collection bounds',
        createLayerSourceId: 'Genera source ID "draw-{type}-src-{collection_id}"',
        createLayerLayerId: 'Genera layer ID "draw-{type}-layer-{collection_id}"',

        // PUBLIC API
        'return.init': 'Inizializzazione',
        'return.start': 'Inizio disegno',
        'return.stop': 'Fine disegno (salva/cancella)',
        'return.drawBBoxFeatureCollection': 'Aggiunge bbox da backend',
        'return.DrawFeatureCollections': 'Accesso diretto al registry',
        'return.saveFeatureCollection': 'Salva collection',
        'return.getFeatureCollection': 'Retrieves collection',
        'return.listFeatureCollections': 'Lista keys',
        'return.removeFeatureCollection': 'Rimuove collection',
        'return.clearAllFeatureCollections': 'Pulisce tutto',
        'return.renderCollectionsPanel': 'Riposiziona UI panel'
    };

    // =========================================================================
    // COSTANTI LOCALI
    // =========================================================================
    const DRAW_CONSTANTS = {
        // Modalità disegno
        MODES: {
            POINT: 'point',
            LINESTRING: 'linestring',
            BBOX: 'bbox',
            POLYGON: 'polygon'
        },

        // Colori e paint config
        DRAW_COLOR: '#f00',
        HANDLE_COLOR: '#00f',
        PAINT: {
            point: {
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
                'circle-color': '#f00'
            },
            fill: {
                'fill-color': '#f00',
                'fill-opacity': 0.15
            },
            line: {
                'line-color': '#f00',
                'line-width': 2
            },
            handle: {
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
                'circle-color': '#00f'
            }
        },

        // Handle edit config
        HANDLE_SOURCE_ID: 'edit-bbox-handles-src',
        HANDLE_LAYER_ID: 'edit-bbox-handles-layer',
        HANDLE_PIXEL_TOLERANCE: 10,  // soglia click su corner in px
        HANDLE_CORNER_KEYS: ['sw', 'se', 'ne', 'nw'],

        // Layer naming convention
        LAYER_SOURCE_PREFIX: 'draw',
        LAYER_TYPE_SUFFIX: 'src',

        // UI messages
        UI_MESSAGES: {
            NO_COLLECTIONS: 'Nessuna collection disegnata.',
            DETAILS_SHOW: 'details',
            DETAILS_HIDE: 'hide'
        },

        // Type icon mapping
        TYPE_ICONS: {
            point: 'location_on',
            linestring: 'polyline',
            bbox: 'crop_free',
            polygon: 'pentagon',
            default: 'cards'
        },

        // Storage
        STORAGE_THREAD_KEY: 'thread_id'
    };

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        // Drawing tools buttons
        dtPoint: 'dtPoint',
        dtLine: 'dtLine',
        dtBbox: 'dtBbox',
        dtPoly: 'dtPoly',
        dtEdit: 'dtEdit',
        dtDel: 'dtDel',
        dtSave: 'dtSave',
        dtCancel: 'dtCancel',
        drawConfirm: 'draw-confirm',

        // Collections panel
        dtCollection: 'dtCollections',
        dtPanel: 'dtCollectionsPanel',
        dtList: 'dtCollectionsList',
        dtCount: 'dtCollectionsCount'
    };

    // =========================================================================
    // STATO INTERNO - GROUPING
    // =========================================================================

    let domElements = {};

    // --- Drawing state
    let map = null;
    let isDrawing = false;
    let drawMode = null;
    let current_collection_id = null;
    let current_feature_collection = null;

    // --- BBox drawing state
    let bboxStartLngLat = null;
    let isBboxDragging = false;

    // --- Polygon drawing state
    let polyCoords = [];
    let isPolyDrawing = false;
    let lastMouseLngLat = null;

    // --- Edit mode state
    let isEditing = false;
    let editTarget = null;  // {srcId, bbox}
    let dragState = null;   // {kind, startLngLat, startBbox, cornerKey}

    // --- Collections registry
    let DrawFeatureCollections = {};

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo DrawTools
     * @param {maplibregl.Map} mapInstance - Istanza mappa MapLibre
     * @throws {Error} Se mappa non valida
     */
    function init(mapInstance) {
        if (!mapInstance) {
            throw new Error('DrawTools.init(map) richiede una mappa valida');
        }

        map = mapInstance;
        domElements = cacheElements(DOM_IDS);

        bindDrawingToolButtons();
        bindPanelButtons();
        bindDocumentEvents();

        console.log('[DrawTools] Initialized');
    }

    /**
     * Associa event listeners ai drawing tool buttons
     */
    function bindDrawingToolButtons() {
        if (domElements.dtPoint) {
            domElements.dtPoint.addEventListener('click', () => {
                setActive(domElements.dtPoint);
                start(DRAW_CONSTANTS.MODES.POINT);
            });
        }

        if (domElements.dtLine) {
            domElements.dtLine.addEventListener('click', () => {
                setActive(domElements.dtLine);
                start(DRAW_CONSTANTS.MODES.LINESTRING);
            });
        }

        if (domElements.dtBbox) {
            domElements.dtBbox.addEventListener('click', () => {
                setActive(domElements.dtBbox);
                start(DRAW_CONSTANTS.MODES.BBOX);
            });
        }

        if (domElements.dtPoly) {
            domElements.dtPoly.addEventListener('click', () => {
                setActive(domElements.dtPoly);
                start(DRAW_CONSTANTS.MODES.POLYGON);
            });
        }

        if (domElements.dtEdit) {
            domElements.dtEdit.addEventListener('click', () => {
                if (isEditing) {
                    stopEditMode();
                } else {
                    startEditBboxMode();
                }
            });
        }

        if (domElements.dtSave) {
            domElements.dtSave.addEventListener('click', () => stop(true));
        }

        if (domElements.dtCancel) {
            domElements.dtCancel.addEventListener('click', () => stop(false));
        }
    }

    /**
     * Associa event listeners ai panel buttons
     */
    function bindPanelButtons() {
        if (domElements.dtCollection) {
            domElements.dtCollection.addEventListener('click', () => {
                const isHidden = domElements.dtPanel.classList.contains('hidden');
                if (isHidden) {
                    dtPanelOpen();
                } else {
                    dtPanelClose();
                }
            });
        }
    }

    /**
     * Associa custom document events
     */
    function bindDocumentEvents() {
        document.addEventListener('draw-tool:update-user-drawn-shapes', (ev) => {
            if (ev.detail?.user_drawn_shapes && Array.isArray(ev.detail.user_drawn_shapes)) {
                ev.detail.user_drawn_shapes.forEach(fc => {
                    if (fc.metadata?.feature_type === DRAW_CONSTANTS.MODES.BBOX) {
                        drawBboxFeatureCollection(fc);
                    }
                });
            }
        });
    }

    // =========================================================================
    // CONTROLLO MODALITA
    // =========================================================================

    /**
     * Attiva un button e ferma disegno corrente se attivo
     * @param {HTMLElement} btn - Button da attivare
     */
    function setActive(btn) {
        if (isDrawing) {
            stop(true);
        }
        document.querySelectorAll('.dt-btn.active').forEach(b => b.classList.remove('active'));
        if (btn) {
            btn.classList.add('active');
        }
    }

    /**
     * Avvia modalità disegno
     * @param {string} mode - Modalità: 'point'|'linestring'|'bbox'|'polygon'
     */
    function start(mode = DRAW_CONSTANTS.MODES.POINT) {
        dtPanelClose();

        drawMode = mode;
        isDrawing = true;
        current_collection_id = randomId8();
        current_feature_collection = null;

        if (domElements.drawConfirm) {
            domElements.drawConfirm.classList.remove('closed');
        }

        // Bind event listeners per il disegno
        map.on('click', onClickHandler);
        map.on('mousedown', onMouseDownHandler);
        map.on('mousemove', onMouseMoveHandler);
        map.on('mouseup', onMouseUpHandler);
        document.addEventListener('keydown', onKeyDownHandler);

        console.log('[DrawTools] Start drawing:', mode, current_collection_id);
    }

    /**
     * Ferma modalità disegno e salva o cancella collection
     * @param {boolean} [stopStatus=true] - true=salva, false=cancella
     */
    function stop(stopStatus = true) {
        const current_source_id = createLayerSourceId(drawMode, current_collection_id);

        if (!stopStatus) {
            // Cancella collection senza salvare
            if ([DRAW_CONSTANTS.MODES.BBOX, DRAW_CONSTANTS.MODES.POLYGON].includes(drawMode)) {
                const fillLayerId = createLayerLayerId(`${drawMode}-fill`, current_collection_id);
                const lineLayerId = createLayerLayerId(`${drawMode}-line`, current_collection_id);

                if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
                if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
            } else {
                const layerId = createLayerLayerId(drawMode, current_collection_id);
                if (map.getLayer(layerId)) map.removeLayer(layerId);
            }

            if (map.getSource(current_source_id)) {
                map.removeSource(current_source_id);
            }

            removeFeatureCollection(current_source_id);

        } else {
            // Salva collection
            if (drawMode === DRAW_CONSTANTS.MODES.POLYGON) {
                finishPolygon();
            }

            saveFeatureCollection(current_collection_id, current_source_id, current_feature_collection);
        }

        // Reset stato
        drawMode = null;
        isDrawing = false;
        current_collection_id = null;
        current_feature_collection = null;

        if (domElements.drawConfirm) {
            domElements.drawConfirm.classList.add('closed');
        }

        document.querySelectorAll('.dt-btn.active').forEach(btn => btn.classList.remove('active'));

        // Unbind event listeners
        map.off('click', onClickHandler);
        map.off('mousedown', onMouseDownHandler);
        map.off('mousemove', onMouseMoveHandler);
        map.off('mouseup', onMouseUpHandler);
        document.removeEventListener('keydown', onKeyDownHandler);

        console.log('[DrawTools] Stop drawing. Collections:', Object.keys(DrawFeatureCollections));
    }

    // =========================================================================
    // UI PANEL MANAGEMENT
    // =========================================================================

    /**
     * Chiude il panel collections
     */
    function dtPanelClose() {
        if (domElements.dtPanel) {
            domElements.dtPanel.classList.add('hidden');
        }
    }

    /**
     * Apre il panel collections
     */
    function dtPanelOpen() {
        if (domElements.dtPanel) {
            domElements.dtPanel.classList.remove('hidden');
            renderCollectionsPanel();
        }
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    /**
     * Gestore click - unificato per disegno e edit
     */
    function onClickHandler(e) {
        if (isEditing) {
            onClickEdit(e);
        } else if (isDrawing) {
            onClickDraw(e);
        }
    }

    /**
     * Sub-handler click per disegno
     */
    function onClickDraw(e) {
        if (drawMode === DRAW_CONSTANTS.MODES.POINT) {
            drawPointLayer();
            pushPoint(e.lngLat);
        }

        if (drawMode === DRAW_CONSTANTS.MODES.POLYGON) {
            drawPolygonLayer();
            if (map.doubleClickZoom) {
                map.doubleClickZoom.disable();
            }
            isPolyDrawing = true;
            polyCoords.push([e.lngLat.lng, e.lngLat.lat]);
            updatePolygonPreview(e.lngLat);
        }
    }

    /**
     * Sub-handler click per edit mode
     */
    function onClickEdit(e) {
        const bboxFillLayers = getAllBboxFillLayerIds();
        const hits = map.queryRenderedFeatures(e.point, { layers: bboxFillLayers });

        if (!hits.length) {
            editTarget = null;
            clearHandles();
            return;
        }

        const hit = hits[0];
        const srcId = hit.source;
        const fc = DrawFeatureCollections[srcId];

        if (fc) {
            current_collection_id = fc.collection_id;
            current_feature_collection = fc;
            const bbox = bboxFromFeatureCollection(fc);
            editTarget = { srcId, bbox };
            setHandlesFromBbox(bbox);
        }
    }

    /**
     * Gestore mousedown - unificato
     */
    function onMouseDownHandler(e) {
        if (isEditing && editTarget) {
            onMouseDownEdit(e);
        } else if (isDrawing && drawMode === DRAW_CONSTANTS.MODES.BBOX) {
            onMouseDownDraw(e);
        }
    }

    /**
     * Sub-handler mousedown per disegno bbox
     */
    function onMouseDownDraw(e) {
        map.dragPan.disable();
        bboxStartLngLat = e.lngLat;
        isBboxDragging = true;
        drawBboxLayer();
        updateBboxFeature(bboxStartLngLat, bboxStartLngLat);
    }

    /**
     * Sub-handler mousedown per edit: resize handles o move bbox
     */
    function onMouseDownEdit(e) {
        // Test hit su handles
        const handleHits = map.queryRenderedFeatures(e.point, { layers: [DRAW_CONSTANTS.HANDLE_LAYER_ID] });
        if (handleHits.length) {
            const cornerKey = handleHits[0].properties.key;
            beginDrag('resize', e.lngLat, cornerKey);
            map.dragPan.disable();
            e.preventDefault();
            return;
        }

        // Test hit su bbox fill
        const bboxFillLayers = getAllBboxFillLayerIds();
        const bboxHits = map.queryRenderedFeatures(e.point, { layers: bboxFillLayers });
        const insideSelected = bboxHits.some(f => f.source === editTarget.srcId);

        if (insideSelected) {
            beginDrag('move', e.lngLat, null);
            map.dragPan.disable();
            e.preventDefault();
        }
    }

    /**
     * Gestore mousemove - unificato
     */
    function onMouseMoveHandler(e) {
        if (isEditing && editTarget && dragState) {
            onMouseMoveEdit(e);
        } else if (isDrawing && drawMode === DRAW_CONSTANTS.MODES.BBOX) {
            onMouseMoveDraw(e);
        } else if (isDrawing && drawMode === DRAW_CONSTANTS.MODES.POLYGON && isPolyDrawing) {
            lastMouseLngLat = e.lngLat;
            updatePolygonPreview(e.lngLat);
        }
    }

    /**
     * Sub-handler mousemove per disegno bbox
     */
    function onMouseMoveDraw(e) {
        if (!isBboxDragging || !bboxStartLngLat) return;
        updateBboxFeature(bboxStartLngLat, e.lngLat);
    }

    /**
     * Sub-handler mousemove per edit: move o resize
     */
    function onMouseMoveEdit(e) {
        if (dragState.kind === 'move') {
            const dx = e.lngLat.lng - dragState.startLngLat.lng;
            const dy = e.lngLat.lat - dragState.startLngLat.lat;
            const b = dragState.startBbox;

            const next = {
                minLng: b.minLng + dx,
                maxLng: b.maxLng + dx,
                minLat: b.minLat + dy,
                maxLat: b.maxLat + dy
            };

            applyBbox(next);

        } else if (dragState.kind === 'resize') {
            const b = dragState.startBbox;
            const c = dragState.cornerKey;

            // Determina corner opposto fisso
            const cornerMap = {
                'sw': { lng: b.maxLng, lat: b.maxLat },
                'se': { lng: b.minLng, lat: b.maxLat },
                'ne': { lng: b.minLng, lat: b.minLat },
                'nw': { lng: b.maxLng, lat: b.minLat }
            };

            const fixed = cornerMap[c] || { lng: b.minLng, lat: b.minLat };
            const minLng = Math.min(fixed.lng, e.lngLat.lng);
            const maxLng = Math.max(fixed.lng, e.lngLat.lng);
            const minLat = Math.min(fixed.lat, e.lngLat.lat);
            const maxLat = Math.max(fixed.lat, e.lngLat.lat);

            applyBbox({ minLng, maxLng, minLat, maxLat });
        }
    }

    /**
     * Gestore mouseup
     */
    function onMouseUpHandler(e) {
        if (isEditing && editTarget) {
            dragState = null;
            map.dragPan.enable();
        } else if (isDrawing && (drawMode === DRAW_CONSTANTS.MODES.BBOX || drawMode === DRAW_CONSTANTS.MODES.POLYGON)) {
            isBboxDragging = false;
            map.dragPan.enable();
        }
    }

    /**
     * Gestore keydown - Escape per cancellare polygon
     */
    function onKeyDownHandler(ev) {
        if (ev.key !== 'Escape') return;
        if (!isDrawing || ![DRAW_CONSTANTS.MODES.BBOX, DRAW_CONSTANTS.MODES.POLYGON].includes(drawMode)) return;

        isPolyDrawing = false;
        polyCoords = [];
        lastMouseLngLat = null;

        const srcId = createLayerSourceId(drawMode, current_collection_id);
        if (map.getSource(srcId)) {
            map.getSource(srcId).setData({ type: 'FeatureCollection', features: [] });
        }

        stop(false);
    }

    // =========================================================================
    // LAYER MANAGEMENT
    // =========================================================================

    /**
     * Crea source + layer circle per points
     */
    function drawPointLayer() {
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.POINT, current_collection_id);
        const layerId = createLayerLayerId(DRAW_CONSTANTS.MODES.POINT, current_collection_id);

        if (!map.getSource(srcId)) {
            map.addSource(srcId, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!map.getLayer(layerId)) {
            map.addLayer({
                id: layerId,
                type: 'circle',
                source: srcId,
                paint: DRAW_CONSTANTS.PAINT.point
            });
        }
    }

    /**
     * Crea source + layers fill+line per bbox/polygon
     */
    function drawBboxLayer(collection_id = null) {
        collection_id = collection_id || current_collection_id;
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.BBOX, collection_id);
        const fillLayerId = createLayerLayerId(`${DRAW_CONSTANTS.MODES.BBOX}-fill`, collection_id);
        const lineLayerId = createLayerLayerId(`${DRAW_CONSTANTS.MODES.BBOX}-line`, collection_id);

        if (!map.getSource(srcId)) {
            map.addSource(srcId, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!map.getLayer(fillLayerId)) {
            map.addLayer({
                id: fillLayerId,
                type: 'fill',
                source: srcId,
                paint: DRAW_CONSTANTS.PAINT.fill
            });
        }

        if (!map.getLayer(lineLayerId)) {
            map.addLayer({
                id: lineLayerId,
                type: 'line',
                source: srcId,
                paint: DRAW_CONSTANTS.PAINT.line
            });
        }
    }

    /**
     * Aggiunge feature collection bbox da backend/event
     * @param {Object} featureCollection - FC con metadata.collection_id
     */
    function drawBboxFeatureCollection(featureCollection) {
        console.log('[DrawTools] Drawing bbox feature collection:', featureCollection);

        const collection_id = featureCollection.collection_id;
        if (!collection_id) return;

        drawBboxLayer(collection_id);
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.BBOX, collection_id);

        if (map.getSource(srcId)) {
            map.getSource(srcId).setData(featureCollection);
        }

        saveFeatureCollection(collection_id, srcId, featureCollection, false);
        zoom_to_feature_collection(collection_id);
    }

    /**
     * Crea source + layers fill+line per polygon
     */
    function drawPolygonLayer() {
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.POLYGON, current_collection_id);
        const fillId = createLayerLayerId(`${DRAW_CONSTANTS.MODES.POLYGON}-fill`, current_collection_id);
        const lineId = createLayerLayerId(`${DRAW_CONSTANTS.MODES.POLYGON}-line`, current_collection_id);

        if (!map.getSource(srcId)) {
            map.addSource(srcId, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!map.getLayer(fillId)) {
            map.addLayer({
                id: fillId,
                type: 'fill',
                source: srcId,
                paint: DRAW_CONSTANTS.PAINT.fill
            });
        }

        if (!map.getLayer(lineId)) {
            map.addLayer({
                id: lineId,
                type: 'line',
                source: srcId,
                paint: DRAW_CONSTANTS.PAINT.line
            });
        }
    }

    // =========================================================================
    // FEATURE UPDATES
    // =========================================================================

    /**
     * Aggiunge Point feature alla collezione corrente
     * @param {maplibregl.LngLat} lngLat - Coordinate punto
     */
    function pushPoint(lngLat) {
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.POINT, current_collection_id);
        const pointFeatures = current_feature_collection?.features || [];

        pointFeatures.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lngLat.lng, lngLat.lat]
            },
            properties: { ts: Date.now() }
        });

        const fc = { type: 'FeatureCollection', features: pointFeatures };
        if (map.getSource(srcId)) {
            map.getSource(srcId).setData(fc);
        }

        current_feature_collection = fc;
    }

    /**
     * Crea/aggiorna Polygon rettangolo da due LngLat
     * @param {maplibregl.LngLat} a - Primo punto
     * @param {maplibregl.LngLat} b - Secondo punto
     */
    function updateBboxFeature(a, b) {
        const minLng = Math.min(a.lng, b.lng);
        const maxLng = Math.max(a.lng, b.lng);
        const minLat = Math.min(a.lat, b.lat);
        const maxLat = Math.max(a.lat, b.lat);

        const poly = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [minLng, minLat],
                    [maxLng, minLat],
                    [maxLng, maxLat],
                    [minLng, maxLat],
                    [minLng, minLat]
                ]]
            },
            properties: { ts: Date.now() }
        };

        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.BBOX, current_collection_id);
        const fc = { type: 'FeatureCollection', features: [poly] };

        if (map.getSource(srcId)) {
            map.getSource(srcId).setData(fc);
        }

        current_feature_collection = fc;
    }

    /**
     * Aggiorna polygon preview con mouse position
     * Se ≥3 punti: polygon; altrimenti: linestring
     * @param {maplibregl.LngLat} mouseLngLat - Posizione mouse
     */
    function updatePolygonPreview(mouseLngLat) {
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.POLYGON, current_collection_id);

        if (polyCoords.length === 0) return;

        const preview = polyCoords.slice();
        if (mouseLngLat) {
            preview.push([mouseLngLat.lng, mouseLngLat.lat]);
        }

        let feature;
        if (preview.length >= 3) {
            const ring = preview.slice();
            ring.push(ring[0]);

            feature = {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [ring] },
                properties: { ts: Date.now(), preview: true }
            };
        } else {
            feature = {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: preview },
                properties: { ts: Date.now(), preview: true }
            };
        }

        const fc = { type: 'FeatureCollection', features: [feature] };
        if (map.getSource(srcId)) {
            map.getSource(srcId).setData(fc);
        }

        current_feature_collection = fc;
    }

    /**
     * Chiude ring polygon e disabilita disegno
     */
    function finishPolygon() {
        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.POLYGON, current_collection_id);

        const ring = polyCoords.slice();
        ring.push(ring[0]);

        const feature = {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: { ts: Date.now() }
        };

        const fc = { type: 'FeatureCollection', features: [feature] };

        if (map.getSource(srcId)) {
            map.getSource(srcId).setData(fc);
        }

        isPolyDrawing = false;
        polyCoords = [];
        lastMouseLngLat = null;

        if (map.doubleClickZoom) {
            map.doubleClickZoom.enable();
        }
    }

    // =========================================================================
    // EDIT MODE
    // =========================================================================

    /**
     * Attiva modalità edit bbox
     */
    function startEditBboxMode() {
        map.on('click', onClickHandler);
        map.on('mousedown', onMouseDownHandler);
        map.on('mousemove', onMouseMoveHandler);
        map.on('mouseup', onMouseUpHandler);

        isEditing = true;
        drawMode = DRAW_CONSTANTS.MODES.BBOX;

        if (domElements.dtEdit) {
            domElements.dtEdit.classList.add('active');
        }

        ensureHandlesLayer();

        console.log('[DrawTools] Edit mode started');
    }

    /**
     * Disattiva modalità edit
     */
    function stopEditMode() {
        if (current_collection_id && editTarget) {
            saveFeatureCollection(current_collection_id, editTarget.srcId, current_feature_collection);
        }

        map.off('click', onClickHandler);
        map.off('mousedown', onMouseDownHandler);
        map.off('mousemove', onMouseMoveHandler);
        map.off('mouseup', onMouseUpHandler);

        isEditing = false;
        drawMode = null;
        editTarget = null;
        dragState = null;

        if (domElements.dtEdit) {
            domElements.dtEdit.classList.remove('active');
        }

        clearHandles();

        console.log('[DrawTools] Edit mode stopped');
    }

    /**
     * Crea source + layer per edit handles se non esiste
     */
    function ensureHandlesLayer() {
        if (!map.getSource(DRAW_CONSTANTS.HANDLE_SOURCE_ID)) {
            map.addSource(DRAW_CONSTANTS.HANDLE_SOURCE_ID, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!map.getLayer(DRAW_CONSTANTS.HANDLE_LAYER_ID)) {
            map.addLayer({
                id: DRAW_CONSTANTS.HANDLE_LAYER_ID,
                type: 'circle',
                source: DRAW_CONSTANTS.HANDLE_SOURCE_ID,
                paint: DRAW_CONSTANTS.PAINT.handle
            });
        }
    }

    /**
     * Ripulisce handle features da mappa
     */
    function clearHandles() {
        const src = map.getSource(DRAW_CONSTANTS.HANDLE_SOURCE_ID);
        if (src) {
            src.setData({ type: 'FeatureCollection', features: [] });
        }
    }

    /**
     * Crea 4 handle points da bbox corners
     * @param {Object} bbox - {minLng, minLat, maxLng, maxLat}
     */
    function setHandlesFromBbox(bbox) {
        const features = [
            handleFeature('sw', bbox.minLng, bbox.minLat),
            handleFeature('se', bbox.maxLng, bbox.minLat),
            handleFeature('ne', bbox.maxLng, bbox.maxLat),
            handleFeature('nw', bbox.minLng, bbox.maxLat)
        ];

        const src = map.getSource(DRAW_CONSTANTS.HANDLE_SOURCE_ID);
        if (src) {
            src.setData({ type: 'FeatureCollection', features });
        }
    }

    /**
     * Factory: crea Point feature handle
     * @param {string} key - Corner key: sw|se|ne|nw
     * @param {number} lng - Longitudine
     * @param {number} lat - Latitudine
     * @returns {Object} Feature
     */
    function handleFeature(key, lng, lat) {
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: { key }
        };
    }

    /**
     * Setup dragState per move o resize
     * @param {string} kind - 'move' | 'resize'
     * @param {maplibregl.LngLat} startLngLat - Posizione inizio drag
     * @param {string} cornerKey - Chiave corner per resize
     */
    function beginDrag(kind, startLngLat, cornerKey) {
        dragState = {
            kind,
            startLngLat,
            startBbox: { ...editTarget.bbox },
            cornerKey
        };
    }

    /**
     * Applica bbox nuovo: aggiorna editTarget, source data, handles
     * @param {Object} bbox - Nuovo {minLng, minLat, maxLng, maxLat}
     */
    function applyBbox(bbox) {
        editTarget.bbox = bbox;

        const poly = bboxToPolygonFeature(bbox);
        const fc = { type: 'FeatureCollection', features: [poly] };

        const src = map.getSource(editTarget.srcId);
        if (src) {
            src.setData(fc);
        }

        current_feature_collection = fc;
        setHandlesFromBbox(bbox);
    }

    /**
     * Converte bbox a Polygon Feature rettangolare
     * @param {Object} bbox - {minLng, minLat, maxLng, maxLat}
     * @returns {Object} Feature Polygon
     */
    function bboxToPolygonFeature(bbox) {
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [bbox.minLng, bbox.minLat],
                    [bbox.maxLng, bbox.minLat],
                    [bbox.maxLng, bbox.maxLat],
                    [bbox.minLng, bbox.maxLat],
                    [bbox.minLng, bbox.minLat]
                ]]
            },
            properties: { ts: Date.now() }
        };
    }

    /**
     * Estrae bbox da Feature Collection Polygon
     * @param {Object} fc - Feature collection con 1 poly rectangle
     * @returns {Object} {minLng, minLat, maxLng, maxLat}
     */
    function bboxFromFeatureCollection(fc) {
        const coords = fc.features[0]?.geometry?.coordinates?.[0] || [];
        if (coords.length < 3) return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };

        const minLng = coords[0][0];
        const minLat = coords[0][1];
        const maxLng = coords[2][0];
        const maxLat = coords[2][1];

        return { minLng, minLat, maxLng, maxLat };
    }

    /**
     * Lista ID layer di tutti bbox fill del registry
     * @returns {Array<string>} Layer IDs
     */
    function getAllBboxFillLayerIds() {
        return Object.keys(DrawFeatureCollections)
            .filter(k => DrawFeatureCollections[k]?.metadata?.feature_type === DRAW_CONSTANTS.MODES.BBOX)
            .map(k => {
                const fc = DrawFeatureCollections[k];
                return createLayerLayerId(`${DRAW_CONSTANTS.MODES.BBOX}-fill`, fc.collection_id);
            });
    }

    // =========================================================================
    // COLLECTIONS PERSISTENCE
    // =========================================================================

    /**
     * Salva collection nel registry con bounds calcolati
     * @param {string} collection_id - ID collezione
     * @param {string} srcId - Source ID registrazione
     * @param {Object} featureCollection - FC
     * @param {boolean} [updateAgentState=true] - Sync con agent state
     */
    function saveFeatureCollection(collection_id, srcId, featureCollection, updateAgentState = true) {
        if (!srcId || !featureCollection?.features?.length) return;

        // Calcola bounds totali
        const bounds = featureCollection.features.reduce((acc, feature) => {
            const geom = feature.geometry;

            if (geom.type === 'Point') {
                acc.extend([geom.coordinates[0], geom.coordinates[1]]);
            } else if (['Polygon', 'MultiPolygon'].includes(geom.type)) {
                const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
                rings.forEach(polygon => {
                    polygon.forEach(coord => {
                        acc.extend([coord[0], coord[1]]);
                    });
                });
            } else if (['LineString', 'MultiLineString'].includes(geom.type)) {
                const lines = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates;
                lines.forEach(coords => {
                    coords.forEach(coord => {
                        acc.extend([coord[0], coord[1]]);
                    });
                });
            }

            return acc;
        }, new maplibregl.LngLatBounds());

        // Aggiungi metadata
        featureCollection.metadata = featureCollection.metadata || {};
        featureCollection.metadata.bounds = {
            minx: bounds.getWest(),
            miny: bounds.getSouth(),
            maxx: bounds.getEast(),
            maxy: bounds.getNorth()
        };
        featureCollection.metadata.feature_type = featureCollection.metadata.feature_type || drawMode;
        featureCollection.metadata.name = srcId;
        featureCollection.metadata.description = null;
        featureCollection.collection_id = collection_id;

        // Salva nel registry
        DrawFeatureCollections[srcId] = JSON.parse(JSON.stringify(featureCollection));

        if (updateAgentState) {
            updateUserDrawnShapesAgentState();
        }

        console.log('[DrawTools] Collection saved:', srcId);
    }

    /**
     * Synca user_drawn_shapes con agent state via REST
     */
    function updateUserDrawnShapesAgentState() {
        const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID) || localStorage.getItem(DRAW_CONSTANTS.STORAGE_THREAD_KEY);

        if (!threadId) {
            console.warn('[DrawTools] No thread_id available for state sync');
            return;
        }

        fetch(Routes.Agent.STATE(threadId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                state_updates: {
                    user_drawn_shapes: Object.values(DrawFeatureCollections)
                }
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('[DrawTools] user_drawn_shapes synced:', data);
            })
            .catch(err => {
                console.error('[DrawTools] Error updating user_drawn_shapes:', err);
            });
    }

    /**
     * Recupera collection dal registry
     * @param {string} name - Source ID
     * @returns {Object|null}
     */
    function getFeatureCollection(name) {
        return DrawFeatureCollections[name] || null;
    }

    /**
     * Lista keys di tutte le collections
     * @returns {Array<string>}
     */
    function listFeatureCollections() {
        return Object.keys(DrawFeatureCollections);
    }

    /**
     * Rimuove collection da registry e mappa
     * @param {string} name - Source ID
     */
    function removeFeatureCollection(name) {
        const fc = DrawFeatureCollections[name];
        if (!fc) return;

        const collection_id = fc.metadata?.collection_id;
        const fc_type = fc.metadata?.feature_type;

        delete DrawFeatureCollections[name];

        const srcId = createLayerSourceId(fc_type, collection_id);
        const fillLayerId = createLayerLayerId(`${fc_type}-fill`, collection_id);
        const lineLayerId = createLayerLayerId(`${fc_type}-line`, collection_id);
        const layerId = createLayerLayerId(fc_type, collection_id);

        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(srcId)) map.removeSource(srcId);

        console.log('[DrawTools] Collection removed:', name);
    }

    /**
     * Pulisce tutte le collections dal registry
     */
    function clearAllFeatureCollections() {
        Object.keys(DrawFeatureCollections).forEach(k => delete DrawFeatureCollections[k]);
        console.log('[DrawTools] All collections cleared');
    }

    // =========================================================================
    // UI PANEL
    // =========================================================================

    /**
     * Popola panel con lista collections
     */
    function renderCollectionsPanel() {
        if (!domElements.dtList) return;

        const names = Object.keys(DrawFeatureCollections);

        if (domElements.dtCount) {
            domElements.dtCount.textContent = String(names.length);
        }

        if (!names.length) {
            domElements.dtList.innerHTML = `<div class="small text-secondary">${DRAW_CONSTANTS.UI_MESSAGES.NO_COLLECTIONS}</div>`;
            return;
        }

        domElements.dtList.innerHTML = '';

        names.forEach(name => {
            const fc = DrawFeatureCollections[name];
            const meta = fc?.metadata || {};
            const type = meta.feature_type || guessType(fc);
            const description = meta.description || 'No description available.';
            const iconName = DRAW_CONSTANTS.TYPE_ICONS[type.toLowerCase()] || DRAW_CONSTANTS.TYPE_ICONS.default;

            const item = document.createElement('div');
            item.className = 'dt-panel-item';
            item.dataset.key = name;

            item.innerHTML = `
                <div class="dt-row">
                    <div class="dt-meta">
                        <div class="d-flex col gap-2 align-items-center">
                            <span class="material-symbols-outlined fs-6">${iconName}</span>
                            <div class="dt-name">${escapeHtml(name)}</div>
                            <div class="dt-type"><code>${escapeHtml(type)}</code></div>
                        </div>
                        <button class="dt-link dt-details-toggle text-start" type="button">${DRAW_CONSTANTS.UI_MESSAGES.DETAILS_SHOW}</button>
                    </div>

                    <div class="dt-actions">
                        <button class="btn btn-sm btn-outline-light dt-eye collection-btn" title="Visibility">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-light collection-btn" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
                            <ul class="dropdown-menu dropdown-menu-dark">
                                <li><a class="dropdown-item" href="#" data-action="zoom">Zoom to</a></li>
                                <li><a class="dropdown-item" href="#" data-action="download">Download</a></li>
                                <li><a class="dropdown-item" href="#" data-action="register">Register as layer</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="dt-details hidden">
                    <div class="small text-secondary mb-1">Info</div>
                    <div class="small">features: <code>${fc.features.length}</code></div>
                    <div class="small">bounds: <code>${
                        meta.bounds 
                            ? `[${meta.bounds.minx.toFixed(5)}, ${meta.bounds.miny.toFixed(5)}, ${meta.bounds.maxx.toFixed(5)}, ${meta.bounds.maxy.toFixed(5)}]`
                            : 'N/A'
                    }</code></div>
                    <div class="small">description: <code>${escapeHtml(description)}</code></div>
                </div>
            `;

            // Details toggle
            const toggle = item.querySelector('.dt-details-toggle');
            const details = item.querySelector('.dt-details');
            toggle.addEventListener('click', () => {
                const isHidden = details.classList.toggle('hidden');
                toggle.textContent = isHidden 
                    ? DRAW_CONSTANTS.UI_MESSAGES.DETAILS_SHOW 
                    : DRAW_CONSTANTS.UI_MESSAGES.DETAILS_HIDE;
            });

            // Eye toggle (visibility)
            const eyeBtn = item.querySelector('.dt-eye');
            eyeBtn.addEventListener('click', () => {
                const hidden = eyeBtn.classList.toggle('dt-collection-hidden');
                const icon = eyeBtn.querySelector('.material-symbols-outlined');
                icon.textContent = hidden ? 'visibility_off' : 'visibility';

                document.dispatchEvent(new CustomEvent('draw:collection:visible', {
                    detail: { key: name, visible: !hidden, fc }
                }));
            });

            // Menu actions
            item.addEventListener('click', (e) => {
                const a = e.target.closest('[data-action]');
                if (!a) return;

                e.preventDefault();
                const action = a.getAttribute('data-action');

                if (action === 'zoom') {
                    document.dispatchEvent(new CustomEvent('draw:collection:zoom', { detail: { key: name, fc } }));
                } else if (action === 'download') {
                    document.dispatchEvent(new CustomEvent('draw:collection:download', { detail: { key: name, fc } }));
                }
            });

            domElements.dtList.appendChild(item);
        });
    }

    /**
     * Indovina tipo feature da geometry
     * @param {Object} fc - Feature collection
     * @returns {string} Tipo feature
     */
    function guessType(fc) {
        const geomType = fc?.features?.[0]?.geometry?.type || '';
        if (/point/i.test(geomType)) return DRAW_CONSTANTS.MODES.POINT;
        if (/line/i.test(geomType)) return DRAW_CONSTANTS.MODES.LINESTRING;
        if (/polygon/i.test(geomType)) return DRAW_CONSTANTS.MODES.POLYGON;
        return 'collection';
    }

    // =========================================================================
    // UTILITY HELPERS
    // =========================================================================

    /**
     * Genera ID random 8 caratteri
     * @returns {string}
     */
    function randomId8() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);

        let out = '';
        for (let i = 0; i < bytes.length; i++) {
            out += chars[bytes[i] % chars.length];
        }

        return out;
    }

    /**
     * Zoom a bounds di feature collection
     * @param {string} collection_id - ID collezione
     */
    function zoom_to_feature_collection(collection_id) {
        if (!collection_id) return;

        const srcId = createLayerSourceId(DRAW_CONSTANTS.MODES.BBOX, collection_id);
        const fc = DrawFeatureCollections[srcId];

        if (!fc?.metadata?.bounds) return;

        const bounds = fc.metadata.bounds;
        GeoMap.zoomToBounds([bounds.minx, bounds.miny, bounds.maxx, bounds.maxy]);
    }

    /**
     * Crea layer source ID
     * @param {string} type - Feature type
     * @param {string} collection_id - Collection ID
     * @returns {string}
     */
    function createLayerSourceId(type, collection_id) {
        return `${DRAW_CONSTANTS.LAYER_SOURCE_PREFIX}-${type}-${DRAW_CONSTANTS.LAYER_TYPE_SUFFIX}-${collection_id}`;
    }

    /**
     * Crea layer ID
     * @param {string} type - Feature type (con eventuale suffisso -fill/-line)
     * @param {string} collection_id - Collection ID
     * @returns {string}
     */
    function createLayerLayerId(type, collection_id) {
        return `${DRAW_CONSTANTS.LAYER_SOURCE_PREFIX}-${type}-layer-${collection_id}`;
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        start,
        stop,
        drawBBoxFeatureCollection: drawBboxFeatureCollection,
        DrawFeatureCollections,
        saveFeatureCollection,
        getFeatureCollection,
        listFeatureCollections,
        removeFeatureCollection,
        clearAllFeatureCollections,
        renderCollectionsPanel
    };
})();
