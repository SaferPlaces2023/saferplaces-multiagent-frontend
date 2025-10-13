// Responsabile della mappa + API per aggiungere sorgenti/layers
const GeoMap = (() => {

    const reg = {};                 // id -> meta
    const customLayerIds = new Set();
    const uid = p => (p || 'lyr') + '-' + Math.random().toString(36).slice(2, 8);

    let map;

    function init() {
        map = new maplibregl.Map({
            container: 'map',
            style: document.getElementById('styleSelect').value || 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [12.4964, 41.9028], zoom: 3
        });
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
    async function addVectorLayer(srcUrl, opts = {}) {
        console.log('addVectorLayer', srcUrl, opts);
        const id = uid('vec');
        // 1) chiedi al backend l'URL “render-ready”

        // let thread_id = localStorage.getItem('thread_id');
        // TODO: Bisogna anche registrarlo !!!!! vedi route e chiama add layer (bisognerebbe anche chiedere titolo e descrizioni.. forse con box centrale com auth-gate) ! comunque rederizza yea
        const res = await fetch("http://localhost:5000/render", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ src: srcUrl, type: 'vector' })
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
        dispatch('layer:added', { id, type: 'vector', format: format || 'geojson' });

        return id;
    }

    async function addShapefile(url) {
        const id = uid('shp');
        const geojson = await shp(url);           // shpjs -> GeoJSON
        reg[id] = { type: 'geojson', data: geojson };
        map.addSource(id, { type: 'geojson', data: geojson });
        map.addLayer({ id, type: 'line', source: id, paint: { 'line-color': '#00aaff', 'line-width': 2 } });
        customLayerIds.add(id);
        dispatch('layer:added', { id, type: 'shp' });
    }

    function addCOG(url, colormap = 'viridis', opacity = 0.85) {
        const id = uid('cog');
        const template = `https://titiler.xyz/cog/tiles/{z}/{x}/{y}.png?url=${encodeURIComponent(url)}&colormap_name=${colormap}`;
        map.addSource(id, { type: 'raster', tiles: [template], tileSize: 256 });
        map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': +opacity } });
        reg[id] = { type: 'raster', template, opacity: +opacity };
        customLayerIds.add(id);
        dispatch('layer:added', { id, type: 'cog' });
    }

    function setStyle(styleUrl) { map.setStyle(styleUrl); }
    function resetView() { map.easeTo({ center: [12.4964, 41.9028], zoom: 5, bearing: 0, pitch: 0 }); }

    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    return { init, addVectorLayer, addShapefile, addCOG, setStyle, resetView };
})();
