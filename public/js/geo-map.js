// Responsabile della mappa + API per aggiungere sorgenti/layers
const GeoMap = (() => {

    const reg = {};                 // id -> meta
    const customLayerIds = new Set();
    const uid = p => (p || 'lyr') + '-' + Math.random().toString(36).slice(2, 8);

    const surfaceColorscalesMap = {
        'rain-timeseries': MaplibreCOGProtocol.colorScale({
            colorScheme: 'BrewerRdYlBu10', 
            min: 0, // layer_data.layer_data.metadata.min, 
            max: 50, //layer_data.layer_data.metadata.max, 
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

    // async function addGeoJSON(url) {
    //     const id = uid('geojson');
    //     const data = await fetch(url).then(r => r.json());
    //     reg[id] = { type: 'geojson', data };
    //     map.addSource(id, { type: 'geojson', data });
    //     map.addLayer({ id: id + 'fill', type: 'fill', source: id, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#6ee7b7', 'fill-opacity': 0.25 } });
    //     map.addLayer({ id: id + 'line', type: 'line', source: id, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#6ee7b7', 'line-width': 2 } });
    //     map.addLayer({ id: id + 'pt', type: 'circle', source: id, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': '#6ee7b7', 'circle-radius': 4 } });

    //     customLayerIds.add(id);
    //     dispatch('layer:added', { id, type: 'geojson' });
    // }
    async function addVectorLayer(layer_data) {
        console.log('addVectorLayer', layer_data);

        // !!!: Handle error otherwise will spin forever
        const t = Toasts.show(`Adding layer <i>"${layer_data.layer_data.title + '"</i>'} ...`); // spinner + messaggio

        if (map.getStyle().layers.some(l => l.id === layer_data.id)) {
            // !!!: use contains id not strict equality
            // !!!: move this into if case add as id can be inside multiple layers with prefixes (see below)
            console.warn('Layer already exists:', layer_data.id);
            Toasts.ok(t, `Layer <i>"${layer_data.layer_data.title}"</i> added`);
            return
        }

        const id = btoa(layer_data.layer_data.src) //uid('vec');
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

        return id;
    }

    async function addCOG(layer_data, view_params = {}) {
        console.log('addCOG', layer_data);

        // !!!: Handle error otherwise will spin forever
        const t = Toasts.show(`Adding layer <i>"${layer_data.layer_data.title + '"</i>'} ...`); // spinner + messaggio

        if (map.getStyle().layers.some(l => l.id === layer_data.layer_data.id)) {
            // !!!: use contains id not strict equality
            // !!!: move this into if case add as id can be inside multiple layers with prefixes (see below)
            console.warn('Layer already exists:', layer_data.layer_data.id);
            Toasts.ok(t, `Layer <i>"${layer_data.layer_data.title}"</i> added`);
            return
        }

        const id = btoa(layer_data.layer_data.src)

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
                console.log('aaaa')
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
                    'raster-opacity': 0.6,
                }
            }
            map.addSource(`hipso_${id}`, dem_sources[`hipso_${id}`]);
            map.addSource(`hillshade_${id}`, dem_sources[`hillshade_${id}`]);
            map.addSource(`terrain_${id}`, dem_sources[`terrain_${id}`]);
            map.addLayer({ ...dem_layers[0], ...view, ...paint });
            map.addLayer({ ...dem_layers[1], ...view, ...paint });
            map.setTerrain(dem_terrain);
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
                let tStart = `${layer_data.layer_data.metadata.time_start}${layer_data.layer_data.metadata.time_start.endsWith('Z') ? '' : 'Z'}`
                let dStart = new Date(tStart);
                let tEnd = `${layer_data.layer_data.metadata.time_end}${layer_data.layer_data.metadata.time_end.endsWith('Z') ? '' : 'Z'}`;
                let dEnd = new Date(tEnd);
                let timestamps = TimeSlider.dateRange(dStart, dEnd, layer_data.layer_data.metadata.n_bands).map(d => d.toISOString())
                timestamps.forEach((ts, ts_idx) => TimeSlider.registerTimestampItem(ts, {
                    type: 'raster-band',
                    layer_id: id,
                    render_url: renderUrl,
                    band: ts_idx + 1,
                    surface_type: surface_type,
                    cog_layer
                }));
                TimeSlider.setRange(
                    new Date(dStart.setUTCHours(0,0,0,0)).toISOString(),
                    new Date(new Date(dEnd.setDate(dEnd.getUTCDate()+1)).setUTCHours(0,0,0,0)).toISOString()
                )
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



            // let b = 0;
            // let n_bands = layer_data.layer_data.metadata.n_bands

            // const colorScale = MaplibreCOGProtocol.colorScale({
            //     colorScheme: 'BrewerRdYlBu10', 
            //     min: 0, // layer_data.layer_data.metadata.min, 
            //     max: 50, //layer_data.layer_data.metadata.max, 
            //     isContinuous: true, 
            //     isReverse: true 
            // });

            // function showBand(band) {
            //     MaplibreCOGProtocol.setColorFunction(renderUrl, (pixel, color, metadata) => {
            //         const value = pixel[band];
            //         if (value === metadata.noData) {
            //             color[3] = 0;
            //         } else {
            //             const [r, g, b] = colorScale(value * metadata.scale + metadata.offset);
            //             color[0] = r;
            //             color[1] = g;
            //             color[2] = b;
            //             color[3] = value > 0 ? 224 : 50
            //         }
            //     });
            // }
            // setInterval(() => {
            //     // !!!: check every 0.1s it's quite unefficient (bisogna trovare il modo di abilitare o non abilitare) ... however, it works fast
            //     if (isLayerVisible(id)) {
            //         b = (b + 1) % n_bands;
            //         showBand(b);
            //         if (map.getLayer(id)) {
            //             map.removeLayer(id);
            //             map.addLayer({...cog_layer, ...{ layout: { visibility: 'visible' } }});
            //         }
            //     }
            // }, 300);

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
                        color[0] = r;
                        color[1] = g;
                        color[2] = b;
                        color[3] = value > 0 ? 224 : 50; // alpha
                    }
                });
                map.removeLayer(layer_id);
                map.addLayer({...cog_layer, ...{ layout: { visibility: 'visible' } }});
            }
        })
    }


    function isLayerVisible(layer_id) {
        return map.getStyle().layers.some(l => l.id.includes(layer_id) && map.getLayoutProperty(l.id, 'visibility') === 'visible');
    }

    function toggleLayerMapVisibility(layer_data) {
        map.getStyle().layers.filter(l => l.id.includes(layer_data.id)).forEach(l => {
            const visibility = map.getLayoutProperty(l.id, 'visibility');
            map.setLayoutProperty(l.id, 'visibility', visibility === 'visible' ? 'none' : 'visible');
        });
    }

    function setStyle(styleUrl) { map.setStyle(styleUrl); TimeSlider.clearIntervals(); LayerPanel.reloadProjectLayers() }
    function resetView() { map.easeTo({ center: [12.4964, 41.9028], zoom: 5, bearing: 0, pitch: 0 }); }

    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    return { init, addVectorLayer, addCOG, setStyle, resetView, toggleLayerMapVisibility, renderTimestampRasters };
})();
