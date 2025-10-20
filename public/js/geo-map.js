// Responsabile della mappa + API per aggiungere sorgenti/layers
const GeoMap = (() => {

    const reg = {};                 // id -> meta
    const customLayerIds = new Set();
    const uid = p => (p || 'lyr') + '-' + Math.random().toString(36).slice(2, 8);

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
        });

        // UI: select stile + reset
        document.getElementById('styleSelect').onchange = e => setStyle(e.target.value);
        document.getElementById('resetView').onclick = () => resetView();

        map.on('load', () => {
            // Aggiungi edifici 3D
            add_3d_buildings();
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
                'minzoom': 15,
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

        if (map.getStyle().layers.some(l => l.id === layer_data.id)) {
            console.warn('Layer already exists:', layer_data.id);
            return
        }

        const id = btoa(layer_data.layer_data.src) //uid('vec');
        // 1) chiedi al backend l'URL “render-ready”

        let thread_id = localStorage.getItem('thread_id');
        // "http://localhost:5000/render", {
        const res = await fetch(`http://localhost:5000/t/${thread_id}/render`, {
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

        map.addLayer({
            id: id + '-fill',
            type: 'fill',
            source: id,
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': '#6ee7b7', 'fill-opacity': 0.25 }
        });
        map.addLayer({
            id: id + '-line',
            type: 'line',
            source: id,
            filter: ['==', ['geometry-type'], 'LineString'],
            paint: { 'line-color': '#6ee7b7', 'line-width': 2 }
        });
        map.addLayer({
            id: id + '-pt',
            type: 'circle',
            source: id,
            filter: ['==', ['geometry-type'], 'Point'],
            paint: { 'circle-color': '#6ee7b7', 'circle-radius': 4 }
        });

        reg[id] = { type: 'geojson', url: renderUrl, data };

        customLayerIds.add(id);

        return id;
    }

    async function addCOG(layer_data, view_params={}) {

        if (map.getStyle().layers.some(l => l.id === layer_data.id)) {
            console.warn('Layer already exists:', layer_data.id);
            return
        }

        const id = btoa(layer_data.layer_data.src)

        let thread_id = localStorage.getItem('thread_id');
        const res = await fetch(`http://localhost:5000/t/${thread_id}/render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layer_data)
        });
        if (!res.ok) throw new Error('render-layer HTTP ' + res.status);

        const info = await res.json();
        const renderUrl = info.src;
        if (!renderUrl) throw new Error('render-layer: render_url mancante');

        function getColorMap(render_info) {
            const colormap = 'BrewerBrBG10';
            const min = render_info.metadata?.min || 0;
            const max = render_info.metadata?.max || 1000;
            return `#color:${colormap},${min},${max},c-`;
        }

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
        map.addSource(id, cog_source);
        map.addLayer({...cog_layer, ...view});
        debugger


        // layer_data = layer_data.layer_data

        // debugger
        // const url = layer_data.src;
        // const colormap = layer_data.metadata?.colormap || 'viridis';
        // const opacity = layer_data.metadata?.opacity || 1.0;





        // // DOC: YEEEEEEEEEES
        // // map.addSource('imageSource', {
        // //     type: 'raster',
        // //     url: 'cog://https://s3.us-east-1.amazonaws.com/saferplaces.co/SaferPlaces-Agent/GECOSISTEMA_ITALY_132250.tif#color:BrewerSpectral7,0,30,c',
        // //     tileSize: 256
        // // });
        // // map.addLayer({
        // //     source: 'imageSource',
        // //     id: 'imageLayer',
        // //     type: 'raster'
        // // });




        // const sources = {
        //     'hipsoSource': {
        //         type: 'raster',
        //         url: 'cog://https://s3.us-east-1.amazonaws.com/saferplaces.co/SaferPlaces-Agent/GECOSISTEMA_ITALY_165506.tif' +
        //             '#color:BrewerBrBG10,0,70,c-',
        //         tileSize: 256
        //     },
        //     'hillshadeSource': {
        //         type: 'raster-dem',
        //         url: 'cog://https://s3.us-east-1.amazonaws.com/saferplaces.co/SaferPlaces-Agent/GECOSISTEMA_ITALY_165506.tif#dem',
        //         tileSize: 256
        //     },
        //     'terrainSource': {
        //         type: 'raster-dem',
        //         url: 'cog://https://s3.us-east-1.amazonaws.com/saferplaces.co/SaferPlaces-Agent/GECOSISTEMA_ITALY_165506.tif#dem',
        //         tileSize: 256
        //     },
        // };

        // const layers = [{
        //     source: 'hipsoSource',
        //     id: 'imageLayer',
        //     type: 'raster'
        // }, {
        //     source: 'hillshadeSource',
        //     id: 'hillshadingLayer',
        //     type: 'hillshade'
        // }];

        // const terrain = {
        //     source: 'terrainSource'
        // };

        // map.addSource('hipsoSource', sources.hipsoSource);
        // map.addSource('hillshadeSource', sources.hillshadeSource);
        // map.addSource('terrainSource', sources.terrainSource);

        // map.addLayer(layers[0]);
        // map.addLayer(layers[1]);
        // map.setTerrain(terrain);
    }

    function toggleLayerMapVisibility(layer_data) {
        if (map.getStyle().layers.some(l => l.id === layer_data.id)) {
            const visibility = map.getLayoutProperty(layer_data.id, 'visibility');
            map.setLayoutProperty(layer_data.id, 'visibility', visibility === 'visible' ? 'none' : 'visible');
        }
    }

    function setStyle(styleUrl) { map.setStyle(styleUrl); }
    function resetView() { map.easeTo({ center: [12.4964, 41.9028], zoom: 5, bearing: 0, pitch: 0 }); }

    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    return { init, addVectorLayer, addCOG, setStyle, resetView, toggleLayerMapVisibility };
})();
