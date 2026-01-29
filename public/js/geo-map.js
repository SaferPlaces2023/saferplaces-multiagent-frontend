// Responsabile della mappa + API per aggiungere sorgenti/layers
const GeoMap = (() => {

    const reg = {};                 // id -> meta
    const customLayerIds = new Set();
    const uid = p => (p || 'lyr') + '-' + Math.random().toString(36).slice(2, 8);

    const surfaceColorscalesMap = {
        'rain-timeseries': MaplibreCOGProtocol.colorScale({
            colorScheme: 'BrewerSpectral11',
            min: 0, // layer_data.layer_data.metadata.min, 
            max: 200, //layer_data.layer_data.metadata.max, 
            isContinuous: true,
            isReverse: true
        })
    }

    let map;

    function init() {
        map = new maplibregl.Map({
            container: 'map',
            style: document.getElementById('styleSelect').value || 'https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=961bdf77-3689-48c2-b079-80c0d4169115', //"https://tiles.openfreemap.org/styles/bright"
            center: [12.4964, 41.9028], zoom: 3
        });
        maplibregl.addProtocol('cog', MaplibreCOGProtocol.cogProtocol);

        map.addControl(new maplibregl.NavigationControl());
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
        map.addControl(new maplibregl.GlobeControl(), 'top-right');

        map.setMaxPitch(75);

        map.on('style.load', () => {
            map.setProjection({ type: 'globe' });
            map.setSky({
                "sky-color": "#199EF3",
                "sky-horizon-blend": 0.5,
                "horizon-color": "#ffffff",
                "horizon-fog-blend": 0.5,
                "fog-color": "#0000ff",
                "fog-ground-blend": 0.5,
                "atmosphere-blend": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    0, 1, 10, 1, 12, 0
                ]
            });
            add_3d_buildings();
        });

        // UI: select stile + reset
        document.getElementById('styleSelect').onchange = e => setStyle(e.target.value);
        document.getElementById('resetView').onclick = () => resetView();

        map.on('load', () => {
            // Aggiungi edifici 3D
            // add_3d_buildings();
            DrawTools.init(map);
        });
    }

    function add_3d_buildings() {
        const layers = map.getStyle().layers;
        let labelLayerId;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
                labelLayerId = layers[i].id;
                break;
            }
        }
        map.addSource('openfreemap', {
            url: `https://tiles.openfreemap.org/planet`,
            type: 'vector',
        });
        map.addLayer(
            {
                'id': '3d-buildings',
                'source': 'openfreemap',
                'source-layer': 'building',
                'type': 'fill-extrusion',
                'minzoom': 14,
                'filter': ['!=', ['get', 'hide_3d'], true],
                'paint': {
                    'fill-extrusion-color': [
                        'interpolate',
                        ['linear'],
                        ['get', 'render_height'], 0, 'lightgray', 200, 'royalblue', 400, 'lightblue'
                    ],
                    'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        16,
                        ['get', 'render_height']
                    ],
                    'fill-extrusion-base': ['case',
                        ['>=', ['get', 'zoom'], 16],
                        ['get', 'render_min_height'], 0
                    ]
                }
            },
            labelLayerId
        );
    }


    function zoomToBounds(bbox, padding = 20, duration = 1500) {
        console.log("zoomToBounds", bbox);

        const targetSW = [bbox[0], bbox[1]];
        const targetNE = [bbox[2], bbox[3]];

        // Bounds attuali della mappa
        const current = map.getBounds();
        const curSW = current.getSouthWest();
        const curNE = current.getNorthEast();

        // Verifica se la view corrente è interamente dentro la target bbox
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


    async function addVectorLayer(layer_data) {
        console.log('addVectorLayer', layer_data);

        // !!!: Handle error otherwise will spin forever

        const id = btoa(layer_data.layer_data.src)

        if (map.getStyle().layers.some(l => l.id.includes(id))) {
            // !!!: use contains id not strict equality
            // !!!: move this into if case add as id can be inside multiple layers with prefixes (see below)
            console.warn('Layer already exists:', layer_data.id);
            return
        }

        const t = Toasts.show(`Adding layer <i>"${layer_data.layer_data.title + '"</i>'} ...`); // spinner + messaggio

        // 1) chiedi al backend l'URL “render-ready”

        let thread_id = localStorage.getItem('thread_id');
        // "http://localhost:5000/render", {
        // const res = await fetch(`http://localhost:5000/t/${thread_id}/render`, {
        const res = await fetch(Routes.Agent.RENDER(thread_id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layer_data)
        });
        if (!res.ok) throw new Error('render-layer HTTP ' + res.status);

        const info = await res.json();
        const format = 'geojson'
        const renderUrl = info.src;
        if (!renderUrl) throw new Error('render-layer: render_url mancante');

        // GeoJSON (in EPSG:4326)
        const data = await fetch(renderUrl).then(r => r.json());
        map.addSource(id, { type: 'geojson', data });

        let view = {
            layout: {
                visibility: 'none',
            }
        }

        map.addLayer({
            id: id + '-fill',
            type: 'fill',
            source: id,
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': '#6ee7b7', 'fill-opacity': 0.25 },
            ...view
        });
        map.addLayer({
            id: id + '-line',
            type: 'line',
            source: id,
            filter: ['==', ['geometry-type'], 'LineString'],
            paint: { 'line-color': '#6ee7b7', 'line-width': 2 },
            ...view
        });
        map.addLayer({
            id: id + '-pt',
            type: 'circle',
            source: id,
            filter: ['==', ['geometry-type'], 'Point'],
            paint: { 'circle-color': '#6ee7b7', 'circle-radius': 4 },
            ...view
        });

        reg[id] = { type: 'geojson', url: renderUrl, data };

        customLayerIds.add(id);

        Toasts.ok(t, `Layer <i>"${layer_data.layer_data.title}"</i> added`);

        zoomToBounds((bboxObj => [bboxObj.minx, bboxObj.miny, bboxObj.maxx, bboxObj.maxy])(info.metadata['bounding-box-wgs84']));

        return id;
    }


    async function addCOG(layer_data, view_params = {}) {
        console.log('addCOG', layer_data);

        // !!!: Handle error otherwise will spin forever
        const id = btoa(layer_data.layer_data.src)

        if (map.getStyle().layers.some(l => l.id.includes(id))) {
            // !!!: use contains id not strict equality
            // !!!: move this into if case add as id can be inside multiple layers with prefixes (see below)
            console.warn('Layer already exists:', layer_data.layer_data.id);
            return
        }

        const t = Toasts.show(`Adding layer <i>"${layer_data.layer_data.title + '"</i>'} ...`); // spinner + messaggio


        let thread_id = localStorage.getItem('thread_id');
        // const res = await fetch(`http://localhost:5000/t/${thread_id}/render`, {
        const res = await fetch(Routes.Agent.RENDER(thread_id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layer_data)
        });
        if (!res.ok) throw new Error('render-layer HTTP ' + res.status);

        const info = await res.json();
        const renderUrl = info.src;
        if (!renderUrl) throw new Error('render-layer: render_url mancante');

        function getColorMap(render_info) {
            let colormap = 'BrewerBrBG10';
            if (layer_data.layer_data?.metadata?.surface_type === 'water-depth') {
                colormap = 'CartoTealGrn';
                const min = 0//render_info.metadata?.min || 0;
                const max = 2;
                return `#color:${colormap},${min},${max},c-`;
            }
            const min = 0//render_info.metadata?.min || 0;
            const max = render_info.metadata?.max || 1000;
            return `#color:${colormap},${min},${max},c-`;
        }

        let surface_type = layer_data.layer_data.metadata?.surface_type || 'raster';

        if (surface_type === 'dem' || surface_type === 'dem-building---') {
            let dem_sources = {
                ['hipso_' + id]: {
                    type: 'raster',
                    url: `cog://${renderUrl}${getColorMap(info)}`,
                    tileSize: 256
                },
                ['hillshade_' + id]: {
                    type: 'raster-dem',
                    url: `cog://${renderUrl}#dem`,
                    tileSize: 256
                },
                ['terrain_' + id]: {
                    type: 'raster-dem',
                    url: `cog://${renderUrl}#dem`,
                    tileSize: 256
                },
            };
            let dem_layers = [{
                source: `hipso_${id}`,
                id: `image_${id}`,
                type: 'raster'
            }, {
                source: `hillshade_${id}`,
                id: `hillshade_${id}`,
                type: 'hillshade'
            }];
            let dem_terrain = {
                source: `terrain_${id}`
            };
            let view = {
                layout: {
                    visibility: 'none',
                }
            }
            let paint = {
                paint: {
                    'raster-opacity': 0.6,  // DOC: Only valid for 'type'='raster' (e.g. invalid for 'hillshade')
                }
            }
            map.addSource(`hipso_${id}`, dem_sources[`hipso_${id}`]);
            map.addSource(`hillshade_${id}`, dem_sources[`hillshade_${id}`]);
            map.addSource(`terrain_${id}`, dem_sources[`terrain_${id}`]);
            map.addLayer({ ...dem_layers[0], ...view, ...paint });
            map.addLayer({ ...dem_layers[1], ...view });
            map.setTerrain({ ...dem_terrain, exaggeration: 1.5 });
        } else if (surface_type === 'rain-timeseries') {

            // Multiband timeserie "animation"
            let cog_source = {
                type: 'raster',
                url: `cog://${renderUrl}`, //${getColorMap(info)}`,
                tileSize: 256
            }
            let cog_layer = {
                id: id,
                type: 'raster',
                source: id,
            }
            let view = {
                layout: {
                    visibility: 'none',
                }
            }
            map.addSource(id, cog_source);
            map.addLayer({ ...cog_layer, ...view });

            try {
                const tStart = layer_data.layer_data.metadata.time_start.endsWith('Z')
                    ? layer_data.layer_data.metadata.time_start
                    : `${layer_data.layer_data.metadata.time_start}Z`;

                const tEnd = layer_data.layer_data.metadata.time_end.endsWith('Z')
                    ? layer_data.layer_data.metadata.time_end
                    : `${layer_data.layer_data.metadata.time_end}Z`;

                const dStart = new Date(tStart);
                const dEnd = new Date(tEnd);

                // timestamps evenly spaced, sempre UTC
                const timestamps = TimeSlider
                    .dateRange(dStart, dEnd, layer_data.layer_data.metadata.n_bands)
                    .map(d => d.toISOString());

                timestamps.forEach((ts, ts_idx) =>
                    TimeSlider.registerTimestampItem(ts, {
                        type: 'raster-band',
                        layer_id: id,
                        render_url: renderUrl,
                        band: ts_idx + 1,
                        surface_type,
                        cog_layer
                    })
                );

                // range UTC midnight → UTC midnight +1 (minus 2 hours)
                const rangeStart = new Date(Date.UTC(
                    dStart.getUTCFullYear(),
                    dStart.getUTCMonth(),
                    dStart.getUTCDate(),
                    0, 0, 0, 0
                ) - (2 * 60 * 60 * 1000)); // minus 2 hours

                const rangeEnd = new Date(Date.UTC(
                    dEnd.getUTCFullYear(),
                    dEnd.getUTCMonth(),
                    dEnd.getUTCDate() + 1,
                    0, 0, 0, 0
                ) + (2 * 60 * 60 * 1000)); // minus 2 hours

                TimeSlider.setRange(
                    rangeStart.toISOString(),
                    rangeEnd.toISOString()
                );


                let interval = {
                    start: tStart,
                    end: tEnd,
                    label: layer_data.layer_data.title,
                    // color: '#6ee7b7' 
                }
                TimeSlider.setIntervals([interval]);
            } catch (e) {
                console.error('Error setting time slider intervals:', e);
                Toasts.error(t, `Error setting time slider intervals: ${e.message}`);
            }

        } else {
            let cog_source = {
                type: 'raster',
                url: `cog://${renderUrl}${getColorMap(info)}`,
                tileSize: 256
            }
            let cog_layer = {
                id: id,
                type: 'raster',
                source: id,
            }
            let view = {
                layout: {
                    visibility: 'none',
                }
            }
            let paint = {
                paint: {
                    'raster-opacity': 0.6,
                }
            }
            map.addSource(id, cog_source);
            map.addLayer({ ...cog_layer, ...view, ...paint, ...layer_data });
        }

        Toasts.ok(t, `Layer <i>"${layer_data.layer_data.title}"</i> added`);

        LayerPanel.sidebarOpen();

        zoomToBounds((bboxObj => [bboxObj.minx, bboxObj.miny, bboxObj.maxx, bboxObj.maxy])(layer_data.layer_data.metadata['bounding-box-wgs84']));
    }


    function renderTimestampRasters(timestamp) {
        TimeSlider.getTimestampItems(timestamp, 'raster-band').forEach(item => {
            let layer_id = item.layer_id;
            let render_url = item.render_url;
            let band = item.band;
            let surface_type = item.surface_type;
            let cog_layer = item.cog_layer;

            if (map.getLayer(layer_id) && isLayerVisible(layer_id)) {
                MaplibreCOGProtocol.setColorFunction(render_url, (pixel, color, metadata) => {
                    const value = pixel[band]; // band is 1-based
                    if (value === metadata.noData) {
                        color[3] = 0;
                    } else {
                        const [r, g, b] = surfaceColorscalesMap[surface_type](value * metadata.scale + metadata.offset);

                        zero_one_v = Math.max(Math.min(value / 50, 1), 0); // assuming max 100 mm/h for rain

                        color[0] = r;
                        color[1] = g;
                        color[2] = b;
                        color[3] = zero_one_v > 0 ? Math.min((Math.pow(Math.e, zero_one_v-1)),1) * 180 : 10; // alpha
                    }
                });
                map.removeLayer(layer_id);
                map.addLayer({ ...cog_layer, ...{ layout: { visibility: 'visible' } } });
            }
        })
    }


    function isLayerVisible(layer_id) {
        return map.getStyle().layers.some(l => l.id.includes(layer_id) && map.getLayoutProperty(l.id, 'visibility') === 'visible');
    }

    function toggleLayerMapVisibility(layer_data) {
        console.log('toggleLayerMapVisibility', layer_data);
        map.getStyle().layers.filter(l => l.id.includes(layer_data.id)).forEach(l => {
            const visibility = map.getLayoutProperty(l.id, 'visibility');
            map.setLayoutProperty(l.id, 'visibility', visibility === 'visible' ? 'none' : 'visible');
            if (map.getLayoutProperty(l.id, 'visibility') === 'visible' && layer_data.metadata?.['bounding-box-wgs84']) {
                zoomToBounds((bboxObj => [bboxObj.minx, bboxObj.miny, bboxObj.maxx, bboxObj.maxy])(layer_data.metadata['bounding-box-wgs84']));
            }
        });
    }

    function setStyle(styleUrl) { map.setStyle(styleUrl); TimeSlider.clearIntervals(); LayerPanel.reloadProjectLayers() }
    function resetView() { map.easeTo({ center: [12.4964, 41.9028], zoom: 5, bearing: 0, pitch: 0 }); }

    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    return { init, addVectorLayer, addCOG, setStyle, resetView, toggleLayerMapVisibility, renderTimestampRasters, zoomToBounds };
})();
