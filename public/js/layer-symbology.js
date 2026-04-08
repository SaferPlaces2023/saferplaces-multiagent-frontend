/**
 * LayerSymbology - Pannello selezione stile per layer vettoriali
 *
 * Responsabilità:
 * - Aprire il modal di selezione stile per un layer vector
 * - Generare espressioni MapLibre (single / graduated / categorized)
 * - Applicare lo stile via GeoMap.setLayerStyle
 *
 * Dipendenze: geo-map.js (GeoMap)
 */
const LayerSymbology = (() => {

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    const STYLE_TYPES = [
        { value: 'single', label: 'Single color' },
        { value: 'graduated', label: 'Graduated' },
        { value: 'categorized', label: 'Categorized' }
    ];

    const COLORMAPS = [
        { name: 'Blues', stops: ['#eff3ff', '#6baed6', '#084594'] },
        { name: 'Reds', stops: ['#fee5d9', '#fb6a4a', '#a50f15'] },
        { name: 'Greens', stops: ['#f7fcf5', '#74c476', '#00441b'] },
        { name: 'Terrain', stops: ['#0d0221', '#81b29a', '#f2cc8f', '#e07a5f'] },
        { name: 'Viridis', stops: ['#440154', '#31688e', '#35b779', '#fde725'] },
        { name: 'Plasma', stops: ['#0d0887', '#9c179e', '#ed7953', '#f0f921'] },
        { name: 'Gray', stops: ['#ffffff', '#969696', '#252525'] }
    ];

    const CAT_PALETTES =[
        {
            name: 'Pastel',
            colors: [
            '#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f', '#cab2d6',
            '#ffffcc', '#e5d8bd', '#fddaec', '#f2f2f2', '#ccebc5',
            '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec',
            '#f2f2f2', '#ccebc5', '#decbe4', '#fed9a6', '#fff2ae'
            ]
        },
        {
            name: 'Bold',
            colors: [
            '#1f78b4', '#33a02c', '#e31a1c', '#ff7f00', '#6a3d9a',
            '#b15928', '#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f',
            '#cab2d6', '#ffff99', '#8dd3c7', '#ffffb3', '#bebada',
            '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5'
            ]
        },
        {
            name: 'Muted',
            colors: [
            '#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3',
            '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd',
            '#ccebc5', '#ffed6f', '#e5c494', '#b3b3b3', '#cbd5e8',
            '#f4cae4', '#e6f5c9', '#fff2ae', '#f1e2cc', '#cccccc'
            ]
        }
    ];

    // =========================================================================
    // STATE
    // =========================================================================

    let currentLayer = null;
    let currentState = null;

    // =========================================================================
    // GEOMETRY / ATTRIBUTE HELPERS
    // =========================================================================

    function getLayerGeometryKind(layer) {
        const raw = (layer.metadata?.geometry_type || [''])[0].toLowerCase();
        if (raw.includes('polygon')) return 'polygon';
        if (raw.includes('line')) return 'line';
        if (raw.includes('point')) return 'point';
        return 'polygon';
    }

    function getNonGeometryAttributes(layer) {
        const attrs = layer.metadata?.attributes || {};
        return Object.entries(attrs)
            .filter(([name, meta]) => {
                if (name === 'geometry') return false;
                if (typeof meta === 'string') return meta !== 'geometry';
                return meta.type !== 'geometry';
            })
            .map(([name, meta]) => {
                if (typeof meta === 'string') {
                    // legacy format: { height: "float64", class: "str", ... }
                    const dtype = (meta === 'float64' || meta === 'int64') ? 'numeric' : 'categorical';
                    return { name, dtype, meta: {} };
                }
                // new format: { height: { type: "numeric", min, max, mean }, class: { type: "categorical", unique_values: [...] } }
                return { name, dtype: meta.type === 'numeric' ? 'numeric' : 'categorical', meta };
            });
    }

    function getCompatibleFields(layer, styleType) {
        const attrs = getNonGeometryAttributes(layer);
        return attrs.filter(({ dtype }) => {
            if (styleType === 'graduated') return dtype === 'numeric' || dtype === 'float64' || dtype === 'int64';
            if (styleType === 'categorized') return dtype === 'categorical' || dtype === 'str' || dtype === 'bool';
            return true;
        });
    }

    // =========================================================================
    // STATE HELPERS
    // =========================================================================

    function defaultStateForLayer(layer) {
        const attrs = getNonGeometryAttributes(layer);
        const numericAttr = attrs.find(a => a.dtype === 'numeric' || a.dtype === 'float64' || a.dtype === 'int64');
        const categoricalAttr = attrs.find(a => a.dtype === 'categorical' || a.dtype === 'str' || a.dtype === 'bool');
        const numericField = numericAttr?.name || '';
        const categoricalField = categoricalAttr?.name || attrs[0]?.name || '';
        return {
            styleType: numericField ? 'graduated' : 'single',
            field: numericField || categoricalField,
            color: '#4a90d9',
            colormap: 0,
            classes: 5,
            opacity: 0.8,
            catPalette: 0,
            min: numericAttr?.meta?.min != null ? String(numericAttr.meta.min) : '',
            max: numericAttr?.meta?.max != null ? String(numericAttr.meta.max) : '',
            lineWidth: 2,
            radius: 6
        };
    }

    function parseStyleFromLayer(layer) {
        const base = defaultStateForLayer(layer);
        const paint = layer.style?.paint || {};
        const kind = getLayerGeometryKind(layer);

        const colorProp = kind === 'polygon' ? 'fill-color' : (kind === 'line' ? 'line-color' : 'circle-color');
        const opacityProp = kind === 'polygon' ? 'fill-opacity' : (kind === 'line' ? 'line-opacity' : 'circle-opacity');

        if (typeof paint[opacityProp] === 'number') base.opacity = paint[opacityProp];
        if (typeof paint['line-width'] === 'number') base.lineWidth = paint['line-width'];
        if (typeof paint['circle-radius'] === 'number') base.radius = paint['circle-radius'];

        const colorExpr = paint[colorProp];
        if (!colorExpr) return base;

        if (typeof colorExpr === 'string') {
            base.styleType = 'single';
            base.color = colorExpr;
            return base;
        }

        if (Array.isArray(colorExpr)) {
            const field = extractFieldFromExpression(colorExpr);
            const mapIndex = guessColormapIndexFromExpression(colorExpr);
            if (field) base.field = field;
            if (mapIndex >= 0) base.colormap = mapIndex;

            if (colorExpr[0] === 'match') {
                base.styleType = 'categorized';
                base.catPalette = guessPaletteIndexFromExpression(colorExpr);
                return base;
            }

            if (String(colorExpr[0]).startsWith('interpolate')) {
                base.styleType = 'graduated';
                const stops = extractStopValues(colorExpr);
                if (stops.length) {
                    base.classes = Math.max(2, Math.min(10, stops.length));
                    base.min = String(stops[0]);
                    base.max = String(stops[stops.length - 1]);
                }
                return base;
            }
        }

        return base;
    }

    function normalizeStateForLayer(layer, state) {
        const compatible = getCompatibleFields(layer, state.styleType);
        if (!compatible.some(f => f.name === state.field)) {
            state.field = compatible[0]?.name || getNonGeometryAttributes(layer)[0]?.name || '';
        }
        if (state.styleType === 'graduated' && !compatible.length) state.styleType = 'single';
        if (state.styleType === 'categorized' && !compatible.length) state.styleType = 'single';
    }

    // =========================================================================
    // EXPRESSION PARSING HELPERS
    // =========================================================================

    function extractFieldFromExpression(expr) {
        if (!Array.isArray(expr)) return '';
        for (let i = 0; i < expr.length - 1; i++) {
            if (expr[i] === 'get' && typeof expr[i + 1] === 'string') return expr[i + 1];
            if (Array.isArray(expr[i]) && expr[i][0] === 'get' && typeof expr[i][1] === 'string') return expr[i][1];
        }
        return '';
    }

    function extractColorsFromExpression(expr) {
        if (!Array.isArray(expr)) return [];
        if (expr[0] === 'match') {
            return expr.slice(3).filter(v => typeof v === 'string' && /^#/.test(v));
        }
        if (String(expr[0]).startsWith('interpolate')) {
            return expr.filter(v => typeof v === 'string' && /^#/.test(v));
        }
        return [];
    }

    function extractStopValues(expr) {
        if (!Array.isArray(expr) || !String(expr[0]).startsWith('interpolate')) return [];
        const values = [];
        for (let i = 3; i < expr.length; i += 2) {
            if (typeof expr[i] === 'number') values.push(expr[i]);
        }
        return values;
    }

    function guessColormapIndexFromExpression(expr) {
        const colors = extractColorsFromExpression(expr);
        if (!colors.length) return -1;
        let bestIndex = -1;
        let bestScore = -Infinity;
        COLORMAPS.forEach((cm, index) => {
            let score = 0;
            colors.forEach(c => { if (cm.stops.includes(c)) score += 2; });
            if (colors[0] === cm.stops[0]) score += 1;
            if (colors[colors.length - 1] === cm.stops[cm.stops.length - 1]) score += 1;
            if (score > bestScore) { bestScore = score; bestIndex = index; }
        });
        return bestIndex;
    }

    function guessPaletteIndexFromExpression(expr) {
        const colors = extractColorsFromExpression(expr);
        if (!colors.length) return 0;
        let bestIndex = 0;
        let bestScore = -Infinity;
        CAT_PALETTES.forEach((palette, index) => {
            let score = 0;
            colors.forEach(c => { if (palette.colors.includes(c)) score += 1; });
            if (score > bestScore) { bestScore = score; bestIndex = index; }
        });
        return bestIndex;
    }

    // =========================================================================
    // MAPLIBRE STYLE GENERATION
    // =========================================================================

    function getMaplibreStyle(layer, state) {
        const kind = getLayerGeometryKind(layer);
        const paint = {};
        const colorProp = kind === 'polygon' ? 'fill-color' : (kind === 'line' ? 'line-color' : 'circle-color');
        const opacityProp = kind === 'polygon' ? 'fill-opacity' : (kind === 'line' ? 'line-opacity' : 'circle-opacity');

        if (state.styleType === 'single') {
            paint[colorProp] = state.color;
        }

        if (state.styleType === 'graduated') {
            const ramp = COLORMAPS[state.colormap];
            const steps = state.classes || ramp.stops.length;
            const min = state.min !== '' ? Number(state.min) : 0;
            const max = state.max !== '' ? Number(state.max) : 100;

            const expr = [
                'interpolate',
                ['linear'],
                ['get', state.field]
            ];

            for (let i = 0; i < steps; i++) {
                const t = steps === 1 ? 0 : i / (steps - 1);
                const value = +(min + (max - min) * t).toFixed(2);
                const colorIndex = Math.round(t * (ramp.stops.length - 1));

                expr.push(value, ramp.stops[colorIndex]);
            }

            paint[colorProp] = expr;
        }

        if (state.styleType === 'categorized') {
            const palette = CAT_PALETTES[state.catPalette].colors;
            const attrs = getNonGeometryAttributes(layer);
            const fieldMeta = attrs.find(a => a.name === state.field)?.meta;
            const uniqueValues = fieldMeta?.unique_values?.length ? fieldMeta.unique_values : null;
            if (uniqueValues) {
                const matchExpr = ['match', ['to-string', ['get', state.field]]];
                uniqueValues.forEach((val, i) => matchExpr.push(String(val), palette[i % palette.length]));
                matchExpr.push('#9ca3af');
                paint[colorProp] = matchExpr;
            } else {
                paint[colorProp] = [
                    'match', ['to-string', ['get', state.field]],
                    'class_1', palette[0],
                    'class_2', palette[1],
                    'class_3', palette[2],
                    'class_4', palette[3],
                    'class_5', palette[4],
                    '#9ca3af'
                ];
            }
        }

        paint[opacityProp] = state.opacity;
        if (kind === 'line') {
            paint['line-width'] = state.lineWidth;
        }
        if (kind === 'point') {
            paint['circle-radius'] = state.radius;
            paint['circle-stroke-color'] = '#ffffff';
            paint['circle-stroke-width'] = 1;
        }

        return { type: kind === 'polygon' ? 'fill' : (kind === 'line' ? 'line' : 'circle'), paint };
    }

    // =========================================================================
    // CANVAS / PREVIEW HELPERS
    // =========================================================================

    function drawColormap(canvas, stops) {
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        stops.forEach((color, i) => grad.addColorStop(i / Math.max(1, stops.length - 1), color));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function renderPreview(layer, state) {
        const kind = getLayerGeometryKind(layer);
        const style = getMaplibreStyle(layer, state);
        const colorProp = kind === 'polygon' ? 'fill-color' : (kind === 'line' ? 'line-color' : 'circle-color');
        const opacityProp = kind === 'polygon' ? 'fill-opacity' : (kind === 'line' ? 'line-opacity' : 'circle-opacity');
        const paintColor = style.paint[colorProp];
        const opacity = style.paint[opacityProp] ?? 1;

        if (Array.isArray(paintColor) && String(paintColor[0]).startsWith('interpolate')) {
            return `<canvas id="lsym-preview-canvas" width="460" height="24" style="width:100%;height:24px;border-radius:8px"></canvas>`;
        }

        if (kind === 'line') {
            const color = Array.isArray(paintColor) ? '#64748b' : paintColor;
            return `<svg viewBox="0 0 300 70" width="100%" height="70" aria-hidden="true">
              <path d="M20 50 C70 10, 130 60, 180 28 S260 34, 280 16" fill="none" stroke="${color}" stroke-width="${style.paint['line-width'] || 2}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />
            </svg>`;
        }

        if (kind === 'point') {
            const color = Array.isArray(paintColor) ? '#64748b' : paintColor;
            const radius = style.paint['circle-radius'] || 6;
            return `<svg viewBox="0 0 300 70" width="100%" height="70" aria-hidden="true">
              <circle cx="150" cy="35" r="${radius}" fill="${color}" opacity="${opacity}" stroke="#ffffff" stroke-width="1.2" />
            </svg>`;
        }

        const color = Array.isArray(paintColor) ? '#94a3b8' : paintColor;
        return `<svg viewBox="0 0 300 70" width="100%" height="70" aria-hidden="true">
          <path d="M28 56 L48 18 L94 22 L130 12 L176 28 L210 20 L270 34 L250 58 Z" fill="${color}" opacity="${opacity}" stroke="rgba(15,23,42,0.18)" stroke-width="1" />
        </svg>`;
    }

    // =========================================================================
    // RENDER
    // =========================================================================

    function setState(patch) {
        Object.assign(currentState, patch);
        normalizeStateForLayer(currentLayer, currentState);
        render();
    }

    function render() {
        const layer = currentLayer;
        const state = currentState;
        const kind = getLayerGeometryKind(layer);
        const compatible = getCompatibleFields(layer, state.styleType);
        const attrs = getNonGeometryAttributes(layer);

        const titleEl = document.getElementById('lsym-title');
        const metaEl = document.getElementById('lsym-meta');
        if (titleEl) titleEl.textContent = layer.title || 'Layer';
        if (metaEl) metaEl.innerHTML = [
            `<span>${kind}</span>`,
            `<span>${(layer.metadata?.n_features || 0).toLocaleString()} features</span>`,
            `<span>${attrs.length} attributes</span>`
        ].join('<span class="lsym-meta-sep">•</span>');

        const body = document.getElementById('lsym-body');
        if (!body) return;

        body.innerHTML = `
          <div class="lsym-style-card">
            <div class="lsym-field-row">
              <label class="lsym-label">Style type</label>
              <select id="lsym-style-type" class="lsym-select">
                ${STYLE_TYPES
                .filter(t => getCompatibleFields(layer, t.value).length > 0 || t.value === 'single')
                .map(t => `<option value="${t.value}" ${t.value === state.styleType ? 'selected' : ''}>${t.label}</option>`)
                .join('')}
              </select>
            </div>

            ${state.styleType === 'single' ? `
              <div class="lsym-field-row">
                <label class="lsym-label">Color</label>
                <div class="lsym-range-row" style="align-items:center">
                  <input id="lsym-single-color" type="color" value="${state.color}" class="lsym-color-input" />
                  <span class="lsym-color-label">${kind === 'polygon' ? 'fill' : kind === 'line' ? 'stroke' : 'marker'}</span>
                </div>
              </div>
            ` : ''}

            ${(state.styleType === 'graduated' || state.styleType === 'categorized') ? `
              <div class="lsym-field-row">
                <label class="lsym-label">Field</label>
                <select id="lsym-field-select" class="lsym-select">
                  ${compatible.map(f => `<option value="${f.name}" ${f.name === state.field ? 'selected' : ''}>${f.name} (${f.dtype})</option>`).join('')}
                </select>
              </div>
            ` : ''}

            ${state.styleType === 'graduated' ? `
              <div class="lsym-field-row">
                <label class="lsym-label">Color ramp</label>
                <div class="lsym-colormap-grid" id="lsym-cm-grid"></div>
              </div>
              <div class="lsym-field-row">
                <label class="lsym-label">Classes</label>
                <div class="lsym-range-row">
                  <input id="lsym-classes-range" type="range" min="2" max="10" step="1" value="${state.classes}" />
                  <span id="lsym-classes-value">${state.classes}</span>
                </div>
              </div>
              <div class="lsym-row2">
                <div class="lsym-field-row">
                  <label class="lsym-label">Min</label>
                  <input id="lsym-min" type="number" class="lsym-input" placeholder="auto" value="${state.min}" />
                </div>
                <div class="lsym-field-row">
                  <label class="lsym-label">Max</label>
                  <input id="lsym-max" type="number" class="lsym-input" placeholder="auto" value="${state.max}" />
                </div>
              </div>
            ` : ''}

            ${state.styleType === 'categorized' ? `
              <div class="lsym-field-row">
                <label class="lsym-label">Palette</label>
                <div class="lsym-palette-list" id="lsym-palette-list"></div>
              </div>
            ` : ''}

            ${kind === 'line' ? `
              <div class="lsym-field-row">
                <label class="lsym-label">Line width</label>
                <div class="lsym-range-row">
                  <input id="lsym-line-width" type="range" min="1" max="12" step="0.5" value="${state.lineWidth}" />
                  <span id="lsym-line-width-value">${state.lineWidth}px</span>
                </div>
              </div>
            ` : ''}

            ${kind === 'point' ? `
              <div class="lsym-field-row">
                <label class="lsym-label">Marker radius</label>
                <div class="lsym-range-row">
                  <input id="lsym-radius" type="range" min="2" max="18" step="1" value="${state.radius}" />
                  <span id="lsym-radius-value">${state.radius}px</span>
                </div>
              </div>
            ` : ''}

            <hr class="lsym-divider" />

            <div class="lsym-field-row">
              <label class="lsym-label">Opacity</label>
              <div class="lsym-range-row">
                <input id="lsym-opacity" type="range" min="0" max="1" step="0.01" value="${state.opacity}" />
                <span id="lsym-opacity-value">${Math.round(state.opacity * 100)}%</span>
              </div>
            </div>
          </div>

          <div class="lsym-field-row">
            <label class="lsym-label">Preview</label>
            <div class="lsym-preview-area" id="lsym-preview-area">${renderPreview(layer, state)}</div>
          </div>

          <div class="lsym-field-row">
            <label class="lsym-label">Generated MapLibre style</label>
            <div class="lsym-json-box" id="lsym-json-output"></div>
          </div>
        `;

        // ---- bind events ----

        document.getElementById('lsym-style-type').addEventListener('change', e => {
            currentState.styleType = e.target.value;
            normalizeStateForLayer(currentLayer, currentState);
            render();
        });

        const fieldSel = document.getElementById('lsym-field-select');
        if (fieldSel) fieldSel.addEventListener('change', e => {
            const newField = e.target.value;
            const patch = { field: newField };
            if (currentState.styleType === 'graduated') {
                const fieldMeta = getNonGeometryAttributes(currentLayer).find(a => a.name === newField)?.meta;
                if (fieldMeta?.min != null) patch.min = String(fieldMeta.min);
                if (fieldMeta?.max != null) patch.max = String(fieldMeta.max);
            }
            setState(patch);
        });

        const singleColor = document.getElementById('lsym-single-color');
        if (singleColor) singleColor.addEventListener('input', e => setState({ color: e.target.value }));

        document.getElementById('lsym-opacity').addEventListener('input', e => {
            setState({ opacity: Number(e.target.value) });
            const valEl = document.getElementById('lsym-opacity-value');
            if (valEl) valEl.textContent = Math.round(Number(e.target.value) * 100) + '%';
        });

        const classesRange = document.getElementById('lsym-classes-range');
        if (classesRange) classesRange.addEventListener('input', e => {
            setState({ classes: Number(e.target.value) });
            const valEl = document.getElementById('lsym-classes-value');
            if (valEl) valEl.textContent = e.target.value;
        });

        const minInput = document.getElementById('lsym-min');
        if (minInput) minInput.addEventListener('input', e => setState({ min: e.target.value }));

        const maxInput = document.getElementById('lsym-max');
        if (maxInput) maxInput.addEventListener('input', e => setState({ max: e.target.value }));

        const lineWidthRange = document.getElementById('lsym-line-width');
        if (lineWidthRange) lineWidthRange.addEventListener('input', e => {
            setState({ lineWidth: Number(e.target.value) });
            const valEl = document.getElementById('lsym-line-width-value');
            if (valEl) valEl.textContent = e.target.value + 'px';
        });

        const radiusRange = document.getElementById('lsym-radius');
        if (radiusRange) radiusRange.addEventListener('input', e => {
            setState({ radius: Number(e.target.value) });
            const valEl = document.getElementById('lsym-radius-value');
            if (valEl) valEl.textContent = e.target.value + 'px';
        });

        // colormap grid
        const cmGrid = document.getElementById('lsym-cm-grid');
        if (cmGrid) {
            COLORMAPS.forEach((cm, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'lsym-cm-option' + (index === state.colormap ? ' selected' : '');
                wrapper.title = cm.name;
                wrapper.addEventListener('click', () => setState({ colormap: index }));
                const canvas = document.createElement('canvas');
                canvas.width = 140;
                canvas.height = 22;
                wrapper.appendChild(canvas);
                cmGrid.appendChild(wrapper);
                drawColormap(canvas, cm.stops);
            });
        }

        // palette list
        const paletteList = document.getElementById('lsym-palette-list');
        if (paletteList) {
            CAT_PALETTES.forEach((palette, index) => {
                const row = document.createElement('div');
                row.className = 'lsym-palette-row' + (index === state.catPalette ? ' active' : '');
                row.addEventListener('click', () => setState({ catPalette: index }));
                const label = document.createElement('span');
                label.className = 'lsym-palette-name';
                label.textContent = palette.name;
                const swatches = document.createElement('div');
                swatches.className = 'lsym-palette-swatches';
                palette.colors.forEach(color => {
                    const node = document.createElement('div');
                    node.className = 'lsym-swatch';
                    node.style.background = color;
                    swatches.appendChild(node);
                });
                row.append(label, swatches);
                paletteList.appendChild(row);
            });
        }

        // preview canvas (graduated colormap bar)
        const previewCanvas = document.getElementById('lsym-preview-canvas');
        if (previewCanvas && state.styleType === 'graduated') {
            drawColormap(previewCanvas, COLORMAPS[state.colormap].stops);
        }

        // json output
        const generated = getMaplibreStyle(layer, state);
        document.getElementById('lsym-json-output').textContent = JSON.stringify(generated, null, 2);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    function open(layer) {
        currentLayer = layer;
        currentState = parseStyleFromLayer(layer);
        const modal = document.getElementById('layerSymbologyModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        render();
    }

    function close() {
        const modal = document.getElementById('layerSymbologyModal');
        if (modal) modal.classList.add('hidden');
        currentLayer = null;
        currentState = null;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const resetBtn = document.getElementById('lsym-reset-btn');
        const applyBtn = document.getElementById('lsym-apply-btn');
        const closeBtn = document.getElementById('lsym-close-btn');
        const overlay = document.getElementById('layerSymbologyModal');

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
                const style = getMaplibreStyle(currentLayer, currentState);
                GeoMap.setLayerStyle(currentLayer.id, style);
                currentLayer.style = style;
                document.dispatchEvent(new CustomEvent('layer:style-applied', { detail: { layer: currentLayer } }));
                const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);
                if (threadId) {
                    fetch(Routes.Agent.STATE(threadId), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ state_updates: { layer_registry: [currentLayer], ...GeoMap.getViewportState() } })
                    }).catch(err => console.warn('[LayerSymbology] Failed to sync style to server:', err));
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

    return { open, close };
})();
