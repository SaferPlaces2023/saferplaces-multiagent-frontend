/**
 * LayerRasterSymbology - Pannello selezione simbologia per layer raster (COG)
 *
 * Responsabilità:
 * - Aprire il modal di selezione stile per un layer raster
 * - Selezionare colormap, min/max valori e opacity
 * - Applicare lo stile via GeoMap.setRasterStyle
 * - Persistere layer.style per rivalorizzazione futura
 *
 * Dipendenze: geo-map.js (GeoMap), _utils.js, _consts.js
 */
const LayerRasterSymbology = (() => {

    // =========================================================================
    // COLORMAPS
    // Curated selection from maplibre-cog-protocol.
    // For each Brewer series, only the variant with the most intervals is kept.
    // =========================================================================

    const COLORMAPS = [
        // ---- Sequential: single hue ----------------------------------------
        {
            name: 'BrewerBlues9', label: 'Blues',
            stops: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#08519c','#08306b']
        },
        {
            name: 'BrewerGreens9', label: 'Greens',
            stops: ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#006d2c','#00441b']
        },
        {
            name: 'BrewerReds9', label: 'Reds',
            stops: ['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#a50f15','#67000d']
        },
        {
            name: 'BrewerOranges9', label: 'Oranges',
            stops: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#a63603','#7f2704']
        },
        {
            name: 'BrewerPurples9', label: 'Purples',
            stops: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#54278f','#3f007d']
        },
        {
            name: 'BrewerGreys9', label: 'Greys',
            stops: ['#ffffff','#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525','#000000']
        },
        {
            name: 'BrewerYlOrRd9', label: 'Yellow → Red',
            stops: ['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026']
        },
        {
            name: 'BrewerYlGn9', label: 'Yellow → Green',
            stops: ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529']
        },
        {
            name: 'BrewerOrRd9', label: 'Orange → Red',
            stops: ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000']
        },
        {
            name: 'BrewerPuBu9', label: 'Purple → Blue',
            stops: ['#fff7fb','#ece7f2','#d0d1e6','#a6bddb','#74a9cf','#3690c0','#0570b0','#045a8d','#023858']
        },
        // ---- Sequential: multi-hue (Carto) ----------------------------------
        {
            name: 'CartoBluYl', label: 'Carto Blue-Yellow',
            stops: ['#f7feae','#b7e6a5','#7ccba2','#46aea0','#089099','#00718b','#045275']
        },
        {
            name: 'CartoTealGrn', label: 'Carto Teal-Green',
            stops: ['#b0f2bc','#89e8ac','#67dba5','#4cc8a3','#38b2a3','#2c98a0','#257d98']
        },
        {
            name: 'CartoDarkMint', label: 'Carto Dark Mint',
            stops: ['#d2fbd4','#a5dbc2','#7bbcb0','#559c9e','#3a7c89','#235d72','#123f5a']
        },
        {
            name: 'CartoEmrld', label: 'Carto Emerald',
            stops: ['#d3f2a3','#97e196','#6cc08b','#4c9b82','#217a79','#105965','#074050']
        },
        {
            name: 'CartoSunset', label: 'Carto Sunset',
            stops: ['#f3e79b','#fac484','#f8a07e','#eb7f86','#ce6693','#a059a0','#5c53a5']
        },
        // ---- Diverging -------------------------------------------------------
        {
            name: 'BrewerSpectral11', label: 'Spectral',
            stops: ['#9e0142','#d53e4f','#f46d43','#fdae61','#fee08b','#ffffbf','#e6f598','#abdda4','#66c2a5','#3288bd','#5e4fa2']
        },
        {
            name: 'BrewerRdBu11', label: 'Red → Blue',
            stops: ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061']
        },
        {
            name: 'BrewerRdYlBu11', label: 'Red-Yellow-Blue',
            stops: ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695']
        },
        {
            name: 'BrewerBrBG11', label: 'Brown → Teal',
            stops: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e','#003c30']
        },
        {
            name: 'BrewerPRGn11', label: 'Purple → Green',
            stops: ['#40004b','#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837','#00441b']
        },
        {
            name: 'BrewerRdYlGn11', label: 'Red-Yellow-Green',
            stops: ['#a50026','#d73027','#f46d43','#fdae61','#fee08b','#ffffbf','#d9ef8b','#a6d96a','#66bd63','#1a9850','#006837']
        },
        {
            name: 'CartoTemps', label: 'Carto Temps',
            stops: ['#009392','#39b185','#9ccb86','#e9e29c','#eeb479','#e88471','#cf597e']
        },
        {
            name: 'CartoGeyser', label: 'Carto Geyser',
            stops: ['#008080','#70a494','#b4c8a8','#f6edbd','#edbb8a','#de8a5a','#ca562c']
        },
        {
            name: 'CartoArmyRose', label: 'Carto Army-Rose',
            stops: ['#798234','#a3ad62','#d0d3a2','#fdfbe4','#f0c6c3','#df91a3','#d46780']
        }
    ];

    // =========================================================================
    // STATE
    // =========================================================================

    let currentLayer = null;
    let currentState = null;

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Stato default derivato dai metadati del layer
     * @param {Object} layer
     * @returns {Object}
     */
    function defaultStateForLayer(layer) {
        const meta = layer.metadata || {};
        return {
            colormap: 'BrewerSpectral11',
            min: meta.min != null ? meta.min : 0,
            max: meta.max != null ? meta.max : 1000,
            opacity: 0.6,
            reverse: false
        };
    }

    /**
     * Ricava lo stato corrente dal layer.style se disponibile
     * @param {Object} layer
     * @returns {Object}
     */
    function parseStyleFromLayer(layer) {
        const base = defaultStateForLayer(layer);
        const s = layer.style;
        if (!s) return base;
        if (s.colormap) base.colormap = s.colormap;
        if (s.min != null) base.min = s.min;
        if (s.max != null) base.max = s.max;
        if (s.opacity != null) base.opacity = s.opacity;
        if (s.reverse != null) base.reverse = s.reverse;
        return base;
    }

    /**
     * Costruisce la stringa colormap per maplibre-cog-protocol
     * @param {string} colormap
     * @param {number} min
     * @param {number} max
     * @param {boolean} reverse
     * @returns {string}  e.g. "#color:BrewerBlues9,0,100,c"
     */
    function buildColormapString(colormap, min, max, reverse) {
        const flags = reverse ? 'c-' : 'c';
        return `#color:${colormap},${min},${max},${flags}`;
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function setState(patch) {
        Object.assign(currentState, patch);
        render();
    }

    function render() {
        const layer = currentLayer;
        const state = currentState;

        const titleEl = document.getElementById('lrsym-title');
        const metaEl = document.getElementById('lrsym-meta');
        if (titleEl) titleEl.textContent = layer.title || 'Raster layer';
        if (metaEl) {
            const meta = layer.metadata || {};
            const parts = [];
            if (meta.n_bands != null) parts.push(`${meta.n_bands} band${meta.n_bands !== 1 ? 's' : ''}`);
            if (meta.crs) parts.push(meta.crs);
            metaEl.innerHTML = parts.map(p => `<span>${escapeHtml(p)}</span>`).join('<span class="lsym-meta-sep">•</span>');
        }

        const body = document.getElementById('lrsym-body');
        if (!body) return;

        const selectedCm = COLORMAPS.find(c => c.name === state.colormap) || COLORMAPS[0];

        body.innerHTML = `
          <div class="lsym-style-card">

            <div class="lsym-field-row">
              <label class="lsym-label">Color ramp</label>
              <div class="lrsym-cm-grid" id="lrsym-cm-grid"></div>
            </div>

            <div class="lsym-field-row" style="align-items:center;gap:6px;">
              <label class="lsym-label">Reverse</label>
              <input id="lrsym-reverse" type="checkbox" ${state.reverse ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;" />
            </div>

            <hr class="lsym-divider" />

            <div class="lsym-row2">
              <div class="lsym-field-row">
                <label class="lsym-label">Min value</label>
                <input id="lrsym-min" type="number" class="lsym-input" value="${state.min}" step="any" />
              </div>
              <div class="lsym-field-row">
                <label class="lsym-label">Max value</label>
                <input id="lrsym-max" type="number" class="lsym-input" value="${state.max}" step="any" />
              </div>
            </div>

            <hr class="lsym-divider" />

            <div class="lsym-field-row">
              <label class="lsym-label">Opacity</label>
              <div class="lsym-range-row">
                <input id="lrsym-opacity" type="range" min="0" max="1" step="0.01" value="${state.opacity}" />
                <span id="lrsym-opacity-value">${Math.round(state.opacity * 100)}%</span>
              </div>
            </div>
          </div>

          <div class="lsym-field-row">
            <label class="lsym-label">Preview</label>
            <div id="lrsym-preview" style="width:100%;height:24px;border-radius:6px;overflow:hidden;"></div>
          </div>

          <div class="lsym-field-row">
            <label class="lsym-label">Colormap string</label>
            <div class="lsym-json-box" id="lrsym-string-output"></div>
          </div>
        `;

        // ---- colormap grid ----
        const grid = document.getElementById('lrsym-cm-grid');
        if (grid) {
            COLORMAPS.forEach(cm => {
                const wrapper = document.createElement('div');
                wrapper.className = 'lsym-cm-option' + (cm.name === state.colormap ? ' selected' : '');
                wrapper.title = cm.label;
                wrapper.addEventListener('click', () => setState({ colormap: cm.name }));

                const canvas = document.createElement('canvas');
                canvas.width = 140;
                canvas.height = 22;
                wrapper.appendChild(canvas);

                const label = document.createElement('div');
                label.className = 'lrsym-cm-label';
                label.textContent = cm.label;
                wrapper.appendChild(label);

                grid.appendChild(wrapper);
                drawColorstrip(canvas, cm.stops, state.reverse);
            });
        }

        // ---- preview ----
        const preview = document.getElementById('lrsym-preview');
        if (preview) {
            const stops = [...selectedCm.stops];
            if (state.reverse) stops.reverse();
            preview.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
        }

        // ---- colormap string output ----
        const stringOut = document.getElementById('lrsym-string-output');
        if (stringOut) {
            stringOut.textContent = buildColormapString(state.colormap, state.min, state.max, state.reverse);
        }

        // ---- bind events ----

        document.getElementById('lrsym-reverse').addEventListener('change', e => {
            setState({ reverse: e.target.checked });
        });

        document.getElementById('lrsym-min').addEventListener('input', e => {
            setState({ min: parseFloat(e.target.value) || 0 });
        });

        document.getElementById('lrsym-max').addEventListener('input', e => {
            setState({ max: parseFloat(e.target.value) || 0 });
        });

        document.getElementById('lrsym-opacity').addEventListener('input', e => {
            const val = Number(e.target.value);
            currentState.opacity = val;
            const valEl = document.getElementById('lrsym-opacity-value');
            if (valEl) valEl.textContent = Math.round(val * 100) + '%';
            // update preview only (no full re-render for smoother UX)
        });
    }

    /**
     * Disegna una strip di colori su canvas
     * @param {HTMLCanvasElement} canvas
     * @param {string[]} stops
     * @param {boolean} reverse
     */
    function drawColorstrip(canvas, stops, reverse) {
        const ctx = canvas.getContext('2d');
        const displayStops = reverse ? [...stops].reverse() : stops;
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        displayStops.forEach((color, i) => {
            grad.addColorStop(i / Math.max(1, displayStops.length - 1), color);
        });
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Apre il modal per un layer raster
     * @param {Object} layer - Oggetto layer con src, title, metadata, style?
     */
    function open(layer) {
        currentLayer = layer;
        currentState = parseStyleFromLayer(layer);
        const modal = document.getElementById('layerRasterSymbologyModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        render();
    }

    /**
     * Chiude il modal senza applicare
     */
    function close() {
        const modal = document.getElementById('layerRasterSymbologyModal');
        if (modal) modal.classList.add('hidden');
        currentLayer = null;
        currentState = null;
    }

    // ---- DOM events (DOMContentLoaded) ----

    document.addEventListener('DOMContentLoaded', () => {
        const resetBtn = document.getElementById('lrsym-reset-btn');
        const applyBtn = document.getElementById('lrsym-apply-btn');
        const closeBtn = document.getElementById('lrsym-close-btn');
        const overlay = document.getElementById('layerRasterSymbologyModal');

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!currentLayer) return;
                currentState = parseStyleFromLayer(currentLayer);
                render();
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (!currentLayer || !currentState) return;

                // Build style object
                const style = {
                    colormap: currentState.colormap,
                    min: currentState.min,
                    max: currentState.max,
                    opacity: currentState.opacity,
                    reverse: currentState.reverse,
                    colormapString: buildColormapString(
                        currentState.colormap,
                        currentState.min,
                        currentState.max,
                        currentState.reverse
                    )
                };

                // Apply on map
                const layerId = btoa(currentLayer.src || `layer-${Math.random()}`);
                GeoMap.setRasterStyle(layerId, style);

                // Persist on layer object
                currentLayer.style = style;

                // Notify layer panel
                document.dispatchEvent(new CustomEvent('layer:raster-style-applied', {
                    detail: { layer: currentLayer }
                }));

                // Sync to server
                const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);
                if (threadId) {
                    fetch(Routes.Agent.STATE(threadId), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state_updates: { layer_registry: [currentLayer] } })
                    }).catch(err => console.warn('[LayerRasterSymbology] Failed to sync style to server:', err));
                }
            });
        }

        if (closeBtn) closeBtn.addEventListener('click', close);

        if (overlay) {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) close();
            });
        }
    });

    function getColorStops(colormapName) {
        const entry = COLORMAPS.find(c => c.name === colormapName);
        return entry ? { stops: entry.stops, label: entry.label } : null;
    }

    return { open, close, getColorStops };
})();
