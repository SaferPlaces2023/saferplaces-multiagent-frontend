const DrawTools = (() => {
    // --- stato interno
    let map = null;
    let isDrawing = false;
    let drawMode = null; // 'point' | 'linestring' | 'bbox' | 'polygon'

    const DrawFeatureCollections = {};

    let current_collection_id = null; // per gestire gli ID univoci delle feature
    let current_feature_collection = null; // per il feature collection corrente

    let get_source_id = (feature_type, collection_id) => `draw-${feature_type}-src-${collection_id}`;
    let get_layer_id = (feature_type, collection_id) => `draw-${feature_type}-layer-${collection_id}`;

    let btnPoint;
    let btnLine;
    let btnBbox;
    let btnPoly;
    let btnEdit;
    let btnDel;
    let btnSave;
    let btnCancel;
    let drawConfirm;

    let dtCollection;
    let dtPanel;
    let dtList;
    let dtCount;

    // --- stato per il disegno di bbox
    let bboxStartLngLat = null;
    let isBboxDragging = false;

    // --- stato per il disegno di poligoni
    let polyCoords = [];          // array di [lng, lat]
    let isPolyDrawing = false;    // true dopo il primo click
    let lastMouseLngLat = null;   // per preview

    let isEditing = false;
    let editTarget = null;
    // { srcId, fillLayerId, lineLayerId, bbox:{minLng,minLat,maxLng,maxLat} }

    let dragState = null;
    // { kind:'move'|'resize', startLngLat, startBbox, cornerKey }

    const HANDLE_SRC = 'edit-bbox-handles-src';
    const HANDLE_LAYER = 'edit-bbox-handles-layer';
    const HANDLE_PX_TOL = 10; // soglia click su corner (in pixel)

    // --- init
    function init(mapInstance) {
        map = mapInstance;
        if (!map) throw new Error('DrawTools.init(map) richiede una mappa valida');

        btnPoint = document.getElementById('dtPoint');
        btnLine = document.getElementById('dtLine');
        btnBbox = document.getElementById('dtBbox');
        btnPoly = document.getElementById('dtPoly');
        btnEdit = document.getElementById('dtEdit');
        btnDel = document.getElementById('dtDel');
        btnSave = document.getElementById('dtSave');
        btnCancel = document.getElementById('dtCancel');
        drawConfirm = document.getElementById('draw-confirm');

        dtCollection = document.getElementById('dtCollections');
        dtPanel = document.getElementById('dtCollectionsPanel');
        dtList = document.getElementById('dtCollectionsList');
        dtCount = document.getElementById('dtCollectionsCount');

        btnPoint?.addEventListener('click', () => {
            setActive(btnPoint);
            start('point');
        });
        btnLine?.addEventListener('click', () => {
            setActive(btnLine);
            start('linestring');
        });
        btnBbox?.addEventListener('click', () => {
            setActive(btnBbox);
            start('bbox');
        });
        btnPoly?.addEventListener('click', () => {
            setActive(btnPoly);
            start('polygon');
        });

        btnEdit?.addEventListener('click', () => {
            if (isEditing) {
                stopEditMode();
            } else {
                startEditBboxMode();
            }
        })

        btnSave?.addEventListener('click', () => stop(true));
        btnCancel?.addEventListener('click', () => stop(false));

        dtCollection?.addEventListener('click', () => {
            if (dtPanel.classList.contains('hidden')) {
                dtPanelOpen();
            } else {
                dtPanelClose();
            }
        });

        // dispathced draw-tool:update-user-drawn-shapes
        document.addEventListener('draw-tool:update-user-drawn-shapes', (ev) => {
            // console.log('DrawTools: update-user-drawn-shapes', ev.detail.); 
            if (ev.detail?.user_drawn_shapes) {
                ev.detail.user_drawn_shapes.forEach(fc => {
                    switch (fc.metadata.feature_type) {
                        case 'bbox':
                            drawBboxFeatureCollection(fc);
                            break;
                        default:
                            break;
                    }
                })
            }
        });
    }

    function randomId8() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        let out = "";
        for (let i = 0; i < bytes.length; i++) {
            out += chars[bytes[i] % chars.length];
        }
        return out;
    }

    function zoom_to_feature_collection(collection_id) {
        console.log('zoom_to_feature_collection', collection_id);
        source_id = get_source_id('bbox', collection_id);
        if (!collection_id || !DrawFeatureCollections[source_id]) return;
        const fc = DrawFeatureCollections[source_id];
        if (!fc.metadata?.bounds) return;
        GeoMap.zoomToBounds([
            fc.metadata.bounds['minx'],
            fc.metadata.bounds['miny'],
            fc.metadata.bounds['maxx'],
            fc.metadata.bounds['maxy']
        ]);
    }

    function start(mode = 'point') {
        dtPanelClose();
        drawMode = mode;
        isDrawing = true;
        current_collection_id = randomId8() // (Object.values(DrawFeatureCollections).map(fc => fc.collection_id).reduce((max, id) => Math.max(max, id), 0) + 1) || 0;
            current_feature_collection = null;
        console.log('DrawTools.start:', drawMode, current_collection_id);
        drawConfirm.classList.remove('closed');

        map.on('click', onClick);
        map.on('mousedown', onMouseDown);
        map.on('mousemove', onMouseMove);
        map.on('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
    }
    function stop(stopStatus = true) {
        let current_source_id = get_source_id(drawMode, current_collection_id);
        if (!stopStatus) {
            if (drawMode === 'bbox' || drawMode === 'polygon') {
                let current_layer_fill_id = get_layer_id(`${drawMode}-fill`, current_collection_id);
                let current_layer_line_id = get_layer_id(`${drawMode}-line`, current_collection_id);
                if (map.getLayer(current_layer_fill_id)) {
                    map.removeLayer(current_layer_fill_id);
                }
                if (map.getLayer(current_layer_line_id)) {
                    map.removeLayer(current_layer_line_id);
                }
            }
            let current_layer_id = get_layer_id(drawMode, current_collection_id);
            if (map.getLayer(current_layer_id)) {
                map.removeLayer(get_layer_id(drawMode, current_collection_id));
            }
            if (map.getSource(current_source_id)) {
                map.removeSource(current_source_id);
            }
            removeFeatureCollection(current_source_id);
        } else {
            if (drawMode === 'polygon') {
                finishPolygon();
            }
            saveFeatureCollection(current_collection_id, current_source_id, current_feature_collection);
        }
        drawMode = null;
        isDrawing = false;
        current_collection_id = null;
        current_feature_collection = null;
        drawConfirm.classList.add('closed');
        document.querySelectorAll('.dt-btn.active').forEach(btn => btn.classList.remove('active'));

        console.log('DrawFeatureCollections:', DrawFeatureCollections);

        map.off('click', onClick);
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);
        map.off('mousemove', onMouseMove);
        document.removeEventListener('keydown', onKeyDown);
    }

    function setActive(btn) {
        if (isDrawing) {
            stop(true);
        }
        document.querySelectorAll('.dt-btn.active').forEach(btn => btn.classList.remove('active'));
        btn.classList.add('active');
    }

    function dtPanelClose() {
        if (dtPanel) {
            dtPanel.classList.add('hidden');
        }
    }
    function dtPanelOpen() {
        if (dtPanel) {
            dtPanel.classList.remove('hidden');
            renderCollectionsPanel();
        }
    }


    // --- handlers
    function onClick(e) {
        function onClickEdit() {
            // 1) prima prova a selezionare una bbox cliccando sul fill
            const bboxFillLayers = getAllBboxFillLayerIds();
            const hits = map.queryRenderedFeatures(e.point, { layers: bboxFillLayers });

            if (!hits.length) {
                editTarget = null;
                clearHandles();
                return;
            }

            // prendiamo la prima feature hittata
            const hit = hits[0];

            // 2) ricava srcId / layer (dipende da come hai costruito i layer)
            // se la feature viene da una source geojson dedicata, puoi leggere:
            const srcId = hit.source;

            // 3) leggi bbox dai dati (dal tuo storage o ricostruendola dalla geometria)
            // prendo la geometry dal tuo DrawFeatureCollections (consigliato)
            const fc = DrawFeatureCollections[srcId]; // nel tuo componente
            current_collection_id = fc.collection_id
            current_feature_collection = fc;
            const bbox = bboxFromFeatureCollection(fc);

            editTarget = { srcId, bbox };

            // 4) mostra handles ai 4 angoli
            setHandlesFromBbox(bbox);
        }

        if (isEditing) {
            onClickEdit();
            return;
        }


        if (!isDrawing || !map) return;

        if (drawMode === 'point') {
            drawPointLayer();
            pushPoint(e.lngLat);
        }

        if (drawMode === 'polygon') {
            drawPolygonLayer();
            map.doubleClickZoom && map.doubleClickZoom.disable();
            isPolyDrawing = true;
            polyCoords.push([e.lngLat.lng, e.lngLat.lat]);
            updatePolygonPreview(e.lngLat);
        }
    }
    function onMouseDown(e) {

        function mouseDownEdit(e) {
            // A) se clicco un handle -> resize
            const h = map.queryRenderedFeatures(e.point, { layers: [HANDLE_LAYER] });
            if (h.length) {
                const cornerKey = h[0].properties.key; // 'sw'|'se'|'ne'|'nw'
                beginDrag('resize', e.lngLat, cornerKey);
                map.dragPan.disable();
                e.preventDefault();
                return;
            }

            // B) altrimenti: se sono dentro la bbox selezionata -> move
            // (hit test sul fill layer della bbox selezionata: in pratica ricontrollo col click)
            const bboxFillLayers = getAllBboxFillLayerIds();
            const hits = map.queryRenderedFeatures(e.point, { layers: bboxFillLayers });
            const insideSelected = hits.some(f => f.source === editTarget.srcId);

            if (insideSelected) {
                beginDrag('move', e.lngLat, null);
                map.dragPan.disable();
                e.preventDefault();
            }
        }

        if (isEditing && editTarget) {
            mouseDownEdit(e);
            return;
        }



        if (!isDrawing || !map) return;
        if (drawMode !== 'bbox') return;

        // evita che la mappa trascini mentre disegni
        map.dragPan.disable();

        bboxStartLngLat = e.lngLat;
        isBboxDragging = true;

        drawBboxLayer();
        updateBboxFeature(bboxStartLngLat, bboxStartLngLat); // rettangolo “degenerato” iniziale
    }

    function onMouseMove(e) {

        function mouseMoveEdit() {

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
                return;
            }

            if (dragState.kind === 'resize') {
                const b = dragState.startBbox;
                const c = dragState.cornerKey;

                // opposto fisso
                let fixed = null;
                if (c === 'sw') fixed = { lng: b.maxLng, lat: b.maxLat };
                if (c === 'se') fixed = { lng: b.minLng, lat: b.maxLat };
                if (c === 'ne') fixed = { lng: b.minLng, lat: b.minLat };
                if (c === 'nw') fixed = { lng: b.maxLng, lat: b.minLat };

                const minLng = Math.min(fixed.lng, e.lngLat.lng);
                const maxLng = Math.max(fixed.lng, e.lngLat.lng);
                const minLat = Math.min(fixed.lat, e.lngLat.lat);
                const maxLat = Math.max(fixed.lat, e.lngLat.lat);

                applyBbox({ minLng, minLat, maxLng, maxLat });
            }
        }
        if (isEditing && editTarget && dragState) {
            mouseMoveEdit();
            return;
        }


        if (!isDrawing || !map) return;
        if (drawMode !== 'bbox') return;
        if (!isBboxDragging || !bboxStartLngLat) return;

        if (drawMode === 'bbox') {
            updateBboxFeature(bboxStartLngLat, e.lngLat);
        }
        if (drawMode === 'polygon') {
            lastMouseLngLat = e.lngLat;
            updatePolygonPreview(e.lngLat);
        }
    }

    function onMouseUp(e) {

        function mouseUpEdit() {
            dragState = null;
            map.dragPan.enable();
        }
        if (isEditing && editTarget) {
            mouseUpEdit();
            return;
        }

        if (!isDrawing || !map) return;
        if (drawMode !== 'bbox' && drawMode !== 'polygon') return;
        if (!isBboxDragging && !isPolyDrawing) return;

        isBboxDragging = false;
        map.dragPan.enable();

        // se vuoi: qui potresti “validare” bbox minima (no click senza drag)
        // oppure lasciare comunque una bbox anche piccola
    }

    function onKeyDown(ev) {
        if (ev.key !== 'Escape') return;
        if (!isDrawing || (drawMode !== 'bbox' && drawMode !== 'polygon')) return;

        // cancella solo il polygon in costruzione
        isPolyDrawing = false;
        polyCoords = [];
        lastMouseLngLat = null;

        // pulisci source (mantieni layer)
        const srcId = get_source_id(drawMode, current_collection_id);
        if (map.getSource(srcId)) {
            map.getSource(srcId).setData({ type: 'FeatureCollection', features: [] });
        }
        stop(false); // chiude il disegno, ma non salva
    }


    // --- internals
    function drawPointLayer() {

        let current_source_id = get_source_id('point', current_collection_id);
        let current_layer_id = get_layer_id('point', current_collection_id);

        if (!map.getSource(current_source_id)) {
            map.addSource(current_source_id, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!map.getLayer(current_layer_id)) {
            map.addLayer({
                id: current_layer_id,
                type: 'circle',
                source: current_source_id,
                paint: {
                    'circle-radius': 6,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#fff',
                    'circle-color': '#f00'
                }
            });
        }
    }
    function drawBboxFeatureCollection(feature_collection) {
        console.log('drawBboxFeatureCollection', feature_collection);
        let collection_id = feature_collection.collection_id
        if (!collection_id) {
            return
        }
        drawBboxLayer(collection_id);
        collection_source_id = get_source_id('bbox', collection_id);
        map.getSource(collection_source_id).setData(feature_collection);
        saveFeatureCollection(collection_id, collection_source_id, feature_collection, updateAgentState = false);
        zoom_to_feature_collection(collection_id);
    }
    function drawBboxLayer(collection_id = null) {
        collection_id = collection_id || current_collection_id;
        const current_source_id = get_source_id('bbox', collection_id);
        const current_layer_fill_id = get_layer_id('bbox-fill', collection_id);
        const current_layer_line_id = get_layer_id('bbox-line', collection_id);

        if (!map.getSource(current_source_id)) {
            map.addSource(current_source_id, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        if (!map.getLayer(current_layer_fill_id)) {
            map.addLayer({
                id: current_layer_fill_id,
                type: 'fill',
                source: current_source_id,
                paint: {
                    'fill-color': '#f00',
                    'fill-opacity': 0.15
                }
            });
        }

        if (!map.getLayer(current_layer_line_id)) {
            map.addLayer({
                id: current_layer_line_id,
                type: 'line',
                source: current_source_id,
                paint: {
                    'line-color': '#f00',
                    'line-width': 2
                }
            });
        }
    }
    function drawPolygonLayer() {
        const srcId = get_source_id('polygon', current_collection_id);
        const fillId = get_layer_id('polygon-fill', current_collection_id);
        const lineId = get_layer_id('polygon-line', current_collection_id);

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
                paint: {
                    'fill-color': '#f00',
                    'fill-opacity': 0.15
                }
            });
        }

        if (!map.getLayer(lineId)) {
            map.addLayer({
                id: lineId,
                type: 'line',
                source: srcId,
                paint: {
                    'line-color': '#f00',
                    'line-width': 2
                }
            });
        }
    }


    function pushPoint(lngLat) {
        let current_source_id = get_source_id('point', current_collection_id);

        pointFeatures = current_feature_collection?.features || [];

        pointFeatures.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lngLat.lng, lngLat.lat]
            },
            properties: { ts: Date.now() }
        });

        let feature_collection = {
            type: 'FeatureCollection',
            features: pointFeatures
        }

        map.getSource(current_source_id).setData(feature_collection);

        current_feature_collection = feature_collection; // aggiorna la collezione corrente
    }
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

        const current_source_id = get_source_id('bbox', current_collection_id);

        const feature_collection = {
            type: 'FeatureCollection',
            features: [poly]
        };

        map.getSource(current_source_id).setData(feature_collection);
        current_feature_collection = feature_collection; // aggiorna la collezione corrente
    }
    function updatePolygonPreview(mouseLngLat) {
        const srcId = get_source_id('polygon', current_collection_id);

        // se ho meno di 2 punti, mostro una linea/shape minima (o niente)
        if (polyCoords.length === 0) return;

        // per preview: aggiungo il punto mouse come ultimo vertice “temporaneo”
        const preview = polyCoords.slice();
        if (mouseLngLat) preview.push([mouseLngLat.lng, mouseLngLat.lat]);

        // se ho almeno 3 punti (compreso preview), posso già renderizzare un Polygon
        let feature = null;

        if (preview.length >= 3) {
            const ring = preview.slice();
            ring.push(ring[0]); // chiudo il ring

            feature = {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [ring] },
                properties: { ts: Date.now(), preview: true }
            };
        } else {
            // opzionale: potresti disegnare una LineString di preview.
            // per ora: non aggiorno finché non ho almeno 3 vertici (con mouse)
            feature = {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: preview },
                properties: { ts: Date.now(), preview: true }
            };
        }

        const fc = { type: 'FeatureCollection', features: [feature] };
        map.getSource(srcId).setData(fc);
        current_feature_collection = fc; // aggiorna la collezione corrente
    }
    function finishPolygon() {
        const srcId = get_source_id('polygon', current_collection_id);

        const ring = polyCoords.slice();
        ring.push(ring[0]);

        const feature = {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: { ts: Date.now() }
        };

        const fc = { type: 'FeatureCollection', features: [feature] };

        map.getSource(srcId).setData(fc);

        // reset stato “corrente” polygon, ma resto in drawMode polygon (se vuoi)
        isPolyDrawing = false;
        polyCoords = [];
        lastMouseLngLat = null;

        // riabilita zoom su dblclick
        map.doubleClickZoom && map.doubleClickZoom.enable();
    }




    // REGION: [Edit]

    function startEditBboxMode() {
        map.on('click', onClick);
        map.on('mousedown', onMouseDown);
        map.on('mousemove', onMouseMove);
        map.on('mouseup', onMouseUp);

        isEditing = true;
        drawMode = 'bbox'; // per mantenere lo stato coerente
        btnEdit.classList.add('active');

        ensureHandlesLayer();
    }

    function stopEditMode() {
        saveFeatureCollection(current_collection_id, editTarget.srcId, current_feature_collection);

        map.off('click', onClick);
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);

        isEditing = false;
        drawMode = null;
        editTarget = null;
        dragState = null;
        btnEdit.classList.remove('active');

        clearHandles();
    }

    function ensureHandlesLayer() {
        if (!map.getSource(HANDLE_SRC)) {
            map.addSource(HANDLE_SRC, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!map.getLayer(HANDLE_LAYER)) {
            map.addLayer({
                id: HANDLE_LAYER,
                type: 'circle',
                source: HANDLE_SRC,
                paint: {
                    'circle-radius': 6,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#fff',
                    'circle-color': '#00f'
                }
            });
        }
    }

    function clearHandles() {
        const s = map.getSource(HANDLE_SRC);
        if (s) s.setData({ type: 'FeatureCollection', features: [] });
    }

    function getAllBboxFillLayerIds() {
        // TODO: implementa con il tuo LayerRegistry / DrawFeatureCollections
        // Deve ritornare array di layer id fill delle bbox
        let collection_ids = Object.keys(DrawFeatureCollections)
            .filter(k => DrawFeatureCollections[k]?.metadata?.feature_type === 'bbox')
            .map(k => DrawFeatureCollections[k]?.collection_id)
            .map(id => get_layer_id('bbox-fill', id));
        console.log('getAllBboxFillLayerIds:', collection_ids);
        return collection_ids
    }

    function bboxFromFeatureCollection(fc) {
        // assume 1 feature polygon rettangolare
        const coords = fc.features[0].geometry.coordinates[0];
        // coords: [ [minLng,minLat], [maxLng,minLat], [maxLng,maxLat], [minLng,maxLat], [minLng,minLat] ]
        const minLng = coords[0][0];
        const minLat = coords[0][1];
        const maxLng = coords[2][0];
        const maxLat = coords[2][1];
        return { minLng, minLat, maxLng, maxLat };
    }

    function setHandlesFromBbox(b) {
        const features = [
            handleFeature('sw', b.minLng, b.minLat),
            handleFeature('se', b.maxLng, b.minLat),
            handleFeature('ne', b.maxLng, b.maxLat),
            handleFeature('nw', b.minLng, b.maxLat),
        ];
        map.getSource(HANDLE_SRC).setData({ type: 'FeatureCollection', features });
    }

    function handleFeature(key, lng, lat) {
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: { key }
        };
    }

    function beginDrag(kind, startLngLat, cornerKey) {
        dragState = {
            kind,
            startLngLat,
            startBbox: { ...editTarget.bbox },
            cornerKey
        };
    }


    function applyBbox(b) {
        // 1) aggiorna target in memoria
        editTarget.bbox = b;

        // 2) aggiorna geojson nella source bbox selezionata
        const poly = bboxToPolygonFeature(b);

        const fc = { type: 'FeatureCollection', features: [poly] };

        const src = map.getSource(editTarget.srcId);
        if (src) src.setData(fc);

        // 3) aggiorna anche il tuo registry (DrawFeatureCollections)
        current_feature_collection = fc;
        // 4) aggiorna handles
        setHandlesFromBbox(b);
    }

    function bboxToPolygonFeature(b) {
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [b.minLng, b.minLat],
                    [b.maxLng, b.minLat],
                    [b.maxLng, b.maxLat],
                    [b.minLng, b.maxLat],
                    [b.minLng, b.minLat],
                ]]
            },
            properties: { ts: Date.now() }
        };
    }



    // ENDREGION: [Edit]






    function saveFeatureCollection(collection_id, name, featureCollection, updateAgentState = true) {
        if (!name || !featureCollection) return;
        if (!featureCollection.features?.length) return;
        // compute total bounds
        const bounds = featureCollection.features.reduce((acc, feature) => {
            if (feature.geometry.type === 'Point') {
                acc.extend([feature.geometry.coordinates[0], feature.geometry.coordinates[1]]);
            } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                feature.geometry.coordinates.forEach(polygon => {
                    polygon.forEach(coord => {
                        acc.extend([coord[0], coord[1]]);
                    });
                });
            } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                feature.geometry.coordinates.forEach(coord => {
                    acc.extend([coord[0], coord[1]]);
                });
            }
            return acc;
        }, new maplibregl.LngLatBounds());
        featureCollection['metadata'] = featureCollection['metadata'] || {};
        featureCollection['metadata']['bounds'] = {
            minx: bounds.getWest(),
            miny: bounds.getSouth(),
            maxx: bounds.getEast(),
            maxy: bounds.getNorth()
        };
        featureCollection['metadata']['feature_type'] = featureCollection.metadata?.feature_type || drawMode;
        featureCollection['metadata']['name'] = name;
        featureCollection['metadata']['description'] = null; // placeholder, puoi aggiungere un campo per la descrizione se vuoi
        featureCollection['collection_id'] = collection_id
        DrawFeatureCollections[name] = JSON.parse(JSON.stringify(featureCollection));

        if (updateAgentState) {
            updateUserDrawnShapesAgentState();
        }
    }

    function updateUserDrawnShapesAgentState() {
        const LS_THREAD = 'thread_id';
        let thread_id = localStorage.getItem(LS_THREAD)
        fetch(Routes.Agent.STATE(thread_id), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                state_updates: {
                    user_drawn_shapes: Object.values(DrawFeatureCollections)
                }
            })
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to update user_drawn_shapes');
                return response.json();
            })
            .then(data => {
                console.log('user_drawn_shapes updated:', data);
            })
            .catch(error => {
                console.error('Error updating user_drawn_shapes:', error);
            });
    }

    function getFeatureCollection(name) {
        return DrawFeatureCollections[name] || null;
    }

    function listFeatureCollections() {
        return Object.keys(DrawFeatureCollections);
    }

    function removeFeatureCollection(name) {
        let collection_id = DrawFeatureCollections[name]?.metadata?.collection_id;
        let fc_type = DrawFeatureCollections[name]?.metadata?.feature_type;
        delete DrawFeatureCollections[name];
        if (map.getSource(get_source_id(fc_type, collection_id))) {
            map.removeLayer(get_layer_id(fc_type, collection_id));
            map.removeSource(get_source_id(fc_type, collection_id));
        }
    }

    function clearAllFeatureCollections() {
        Object.keys(DrawFeatureCollections).forEach(k => delete DrawFeatureCollections[k]);
    }


    function renderCollectionsPanel() {
        if (!dtList) return;

        const names = Object.keys(DrawFeatureCollections);
        dtCount.textContent = String(names.length);

        if (!names.length) {
            dtList.innerHTML = `<div class="small text-secondary">Nessuna collection disegnata.</div>`;
            return;
        }

        let typeIconMap = {
            point: 'location_on',
            linestring: 'polyline',
            bbox: 'crop_free',
            polygon: 'pentagon',
            default: 'cards'
        };

        dtList.innerHTML = '';
        for (const name of names) {
            const fc = DrawFeatureCollections[name];
            const meta = fc?.metadata || {};
            const id = fc?.collection_id;
            const type = meta.feature_type || guessType(fc);
            const description = meta.description || 'No description yet.';

            const item = document.createElement('div');
            item.className = 'dt-panel-item';
            item.dataset.key = name;

            icon = typeIconMap[type.toLowerCase()] || typeIconMap.default;

            item.innerHTML = `
            <div class="dt-row">
                <div class="dt-meta">
                    <div class="d-flex col gap-2 align-items-center">
                        <span class="material-symbols-outlined fs-6">${icon}</span>
                        <div class="dt-name">${escapeHtml(name)}</div>
                        <div class="dt-type"><code>${escapeHtml(type)}</code></div>
                    </div>
                    <button class="dt-link dt-details-toggle text-start" type="button">details</button>
                </div>

                <div class="dt-actions">
                <button class="btn btn-sm btn-outline-light dt-eye collection-btn" title="Visible">
                    <span class="material-symbols-outlined">visibility</span>
                </button>

                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-light collection-btn" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
                    <ul class="dropdown-menu dropdown-menu-dark">
                        <li><a class="dropdown-item" href="#" data-action="zoom">Zoom to</a></li>
                        <li><a class="dropdown-item" href="#" data-action="download">Download</a></li>
                        <li><a class="dropdown-item" href="#" data-action="regiter">Register as layer</a></li>
                    </ul>
                </div>
                </div>
            </div>

            <div class="dt-details hidden">
                <div class="small text-secondary mb-1">Info</div>
                <div class="small">features: <code>${(fc.features.length)}</code></div>
                <div class="small">bounds: <code>${meta.bounds ? `[${meta.bounds.minx.toFixed(5)}, ${meta.bounds.miny.toFixed(5)}, ${meta.bounds.maxx.toFixed(5)}, ${meta.bounds.maxy.toFixed(5)}]` : 'N/A'}</code></div>
                <!-- <div class="small">key: <code>${escapeHtml(name)}</code></div> -->
                <div class="small">description: <code>${escapeHtml(description)}</code></div>
            </div>
            `;

            // details toggle
            const toggle = item.querySelector('.dt-details-toggle');
            const details = item.querySelector('.dt-details');
            toggle.addEventListener('click', () => {
                const isHidden = details.classList.toggle('hidden');
                toggle.textContent = isHidden ? 'details' : 'hide';
            });

            // visibility toggle (solo UI + evento)
            const eyeBtn = item.querySelector('.dt-eye');
            eyeBtn.addEventListener('click', () => {
                const hidden = eyeBtn.classList.toggle('dt-collection-hidden');
                const icon = eyeBtn.querySelector('.material-symbols-outlined');
                icon.textContent = hidden ? 'visibility_off' : 'visibility';
                document.dispatchEvent(new CustomEvent('draw:collection:visible', {
                    detail: { key: name, visible: !hidden, fc }
                }));
            });

            // menu actions
            item.addEventListener('click', (e) => {
                const a = e.target.closest('[data-action]');
                if (!a) return;
                e.preventDefault();
                const action = a.dataset.action;

                if (action === 'zoom') {
                    document.dispatchEvent(new CustomEvent('draw:collection:zoom', { detail: { key: name, fc } }));
                } else if (action === 'download') {
                    document.dispatchEvent(new CustomEvent('draw:collection:download', { detail: { key: name, fc } }));
                }
            });

            dtList.appendChild(item);
        }
    }
    function guessType(fc) {
        const t = fc?.features?.[0]?.geometry?.type || '';
        if (/point/i.test(t)) return 'point';
        if (/line/i.test(t)) return 'linestring';
        if (/polygon/i.test(t)) return 'polygon';
        return 'collection';
    }
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }



    // --- export
    return {
        init, start, stop,

        drawBBoxFeatureCollection: drawBboxFeatureCollection,
        DrawFeatureCollections,

        saveFeatureCollection, getFeatureCollection, listFeatureCollections, removeFeatureCollection, clearAllFeatureCollections,

        renderCollectionsPanel
    };
})();
