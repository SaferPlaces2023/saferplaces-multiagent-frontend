/**
 * LayerPanel - Modulo gestione sidebar dei layers
 * 
 * Responsabilità:
 * - Visualizzazione lista layers del progetto
 * - Aggiunta manuale di layers (GeoJSON, COG)
 * - Registrazione layers nel backend
 * - Drag-and-drop reordering
 * - Toggle visibility e download
 * 
 * Dipendenze: _utils.js, _consts.js
 */
const LayerPanel = (() => {

    const MODULE_SUMMARY = {
        // COSTANTI E CONFIGURAZIONE
        LAYER_CONSTANTS: 'Costanti locali: messaggi, delay, errori',
        DOM_IDS: 'Mapping ID elementi DOM: sidebar, layers, modal, buttons',

        // STATO INTERNO
        domElements: 'Cache riferimenti DOM elements dalla mappa DOM_IDS',
        pendingReg: 'Payload layer in attesa di registrazione nel modal',
        draggingFromHandle: 'Flag per tracciare drag da drag-handle',

        // INIZIALIZZAZIONE
        init: 'Entry point: cachea DOM, bind events principali',
        bindMainEvents: 'Bind: toggle sidebar, add GeoJSON, add COG, reload',
        bindModalEvents: 'Bind: cancel e confirm registrazione layer',
        bindLayerLoadEvents: 'Bind: auth:ready e layer:reload-project-layers events',

        // UI - SIDEBAR
        sidebarOpen: 'Apre la sidebar rimuovendo classe closed',
        sidebarClose: 'Chiude la sidebar aggiungendo classe closed',

        // AGGIUNTA LAYERS
        handleAddGeoJSON: 'Gestisce submit button GeoJSON: valida URL, apre modal o dispatcha',
        handleAddCOG: 'Gestisce submit button COG: valida URL+colormap, apre modal o dispatcha',

        // MODAL - REGISTRAZIONE LAYER
        openRegModal: 'Popola e mostra modal registrazione layer, focus title input',
        closeRegModal: 'Nasconde modal e pulisce pendingReg',
        handleConfirmRegistration: 'Valida title, costruisce layer_data, dispatcha evento add',
        showRegModalError: 'Mostra messaggio errore nel modal',
        hideRegModalError: 'Nasconde messaggio errore del modal',

        // CARICAMENTO LAYERS DAL BACKEND
        reloadProjectLayers: 'Fetchia layers da backend, aggiorna badge, renderizza lista',

        // RENDERING LISTA LAYERS
        renderLayerList: 'Popola lista DOM con layer items, abilita drag-sort',
        createLayerItemElement: 'Crea elemento layer item HTML con dettagli, actions, drag-handle',
        bindLayerItemEvents: 'Bind: eye toggle, download action, drag tracking su item',

        // DRAG AND DROP - REORDER
        enableLayerDragSort: 'Setup drag-drop listeners per reordering layers in lista',
        dispatchNewOrder: 'Estrae ordine layer da DOM e dispatcha evento layers:reordered',

        // DOWNLOAD LAYER
        downloadLayer: 'Gestisce download layer: usa URL metadata o richiede al backend',
        performDownload: 'Esegue fetch blob e trigger browser download',

        // EXPORTED API
        'return.init': 'Inizializzazione modulo',
        'return.reloadProjectLayers': 'API pubblica: ricarica lista layers',
        'return.sidebarOpen': 'API pubblica: apre sidebar',
        'return.sidebarClose': 'API pubblica: chiude sidebar',
        'return.listWrap': 'Riferimento element lista layers (per accesso esterno)'
    }


    // =========================================================================
    // COSTANTI LOCALI
    // =========================================================================

    // Surface type options per tipo layer
    const SURFACE_TYPE_OPTIONS = {
        vector: [
            { value: 'buildings', label: 'Buildings' },
            { value: 'roads',     label: 'Roads' }
        ],
        raster: [
            { value: 'dem',                    label: 'DEM (terrain elevation)' },
            { value: 'dem-building',            label: 'DEM Building' },
            { value: 'rain-timeseries',         label: 'Rain (time series)' },
            { value: 'temperature-timeseries',  label: 'Temperature (time series)' },
            { value: 'water-depth',             label: 'Water Depth' },
            { value: 'raster',                  label: 'Generic Raster' }
        ]
    };

    const LAYER_CONSTANTS = {
        DRAG_DELAY_MS: 30,
        NO_PROJECT_MSG: 'No selected project.',
        NO_LAYERS_MSG: 'This project has no layers (yet).',
        LOADING_MSG: 'Loading layers ...',
        LOADING_FAILED_MSG: 'Loading layers failed.',
        ERR_TITLE_REQUIRED: 'Insert at least the title.',
        ERR_LAYER_TYPE_UNSUPPORTED: 'Layer type is not supported.',
        NO_DOWNLOAD_URL: 'No download URL provided by backend',
        ERR_FETCH_DOWNLOAD_URL: 'Error fetching download URL:'
    };

    // =========================================================================
    // LEFT SIDEBAR RESIZE CONFIGURATION
    // =========================================================================
    const LEFT_SIDEBAR_CONFIG = {
        MIN_WIDTH: 48,
        DEFAULT_WIDTH: 360,
        MAX_WIDTH: 800,
        COLLAPSE_THRESHOLD: 100,
        STORAGE_WIDTH_KEY: 'left_sidebar_width',
        STORAGE_PREV_WIDTH_KEY: 'left_sidebar_prev_width'
    };

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        sidebar: 'sidebar',
        layerCount: 'layerCount',
        toggleBtn: 'toggleBtn',
        projectLayersList: 'projectLayersList',
        reloadLayers: 'reloadLayers',
        // GeoJSON section
        btnGeojson: 'btnGeojson',
        geojsonUrl: 'geojsonUrl',
        regSwitchVector: 'regSwitchVector',
        // COG section
        btnCog: 'btnCog',
        cogUrl: 'cogUrl',
        cmap: 'cmap',
        regSwitchRaster: 'regSwitchRaster',
        // Modal registrazione layer
        layerRegModal: 'layerRegModal',
        lrSrc: 'lrSrc',
        lrTitle: 'lrTitle',
        lrDesc: 'lrDesc',
        lrType: 'lrType',
        lrCancel: 'lrCancel',
        lrConfirm: 'lrConfirm',
        lrError: 'lrError',
        // Modal configurazione layer
        layerConfigModal: 'layerConfigModal',
        lcLayerTitle: 'lcLayerTitle',
        lcSurfaceType: 'lcSurfaceType',
        lcCancel: 'lcCancel',
        lcSave: 'lcSave',
        lcError: 'lcError'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};
    let pendingReg = null;
    let draggingFromHandle = false;
    let layerConfigCurrent = null;

    // Resize state for left sidebar
    let leftResizing = false;
    let leftResizeStartX = 0;
    let leftResizeStartWidth = 0;
    let leftPreviousWidth = LEFT_SIDEBAR_CONFIG.DEFAULT_WIDTH;

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo LayerPanel
     */
    function init() {
        domElements = cacheElements(DOM_IDS);
        restoreLeftSidebarState();
        setupLeftResizeHandle();
        bindMainEvents();
        bindModalEvents();
        bindLayerLoadEvents();
    }

    /**
     * Associa i principali eventi UI
     */
    function bindMainEvents() {
        if (!domElements.toggleBtn) return;

        domElements.toggleBtn.addEventListener('click', () => {
            if (domElements.sidebar) {
                const isClosed = domElements.sidebar.classList.contains(CSS_CLASSES.CLOSED);
                if (isClosed) {
                    sidebarOpen();
                } else {
                    sidebarClose();
                }
            }
        });

        // Button GeoJSON
        domElements.btnGeojson?.addEventListener('click', handleAddGeoJSON);

        // Button COG
        domElements.btnCog?.addEventListener('click', handleAddCOG);

        // Reload button
        domElements.reloadLayers?.addEventListener('click', reloadProjectLayers);
    }

    /**
     * Associa gli eventi del modal di registrazione
     */
    function bindModalEvents() {
        domElements.lrCancel?.addEventListener('click', closeRegModal);
        domElements.lrConfirm?.addEventListener('click', handleConfirmRegistration);

        domElements.lcCancel?.addEventListener('click', closeLayerConfigModal);
        domElements.lcSave?.addEventListener('click', handleConfirmLayerConfig);
    }

    /**
     * Associa gli eventi di caricamento layers
     */
    function bindLayerLoadEvents() {
        document.addEventListener('auth:ready', reloadProjectLayers);
        document.addEventListener('layer:reload-project-layers', reloadProjectLayers);
        document.addEventListener('layer:style-applied', (e) => {
            const layer = e.detail?.layer;
            if (!layer) return;
            const key = btoa(layer.src || '');
            const item = domElements.projectLayersList?.querySelector(`[data-layer-key="${CSS.escape(key)}"]`);
            if (!item) return;
            // remove old legend if present
            const oldLegend = item.querySelector('.layer-legend-wrap');
            if (oldLegend) oldLegend.remove();
            // update stored layer data
            try {
                const stored = JSON.parse(item.dataset.layerData);
                stored.style = layer.style;
                item.dataset.layerData = JSON.stringify(stored);
            } catch (_) {}
            // inject new legend
            if (layer.style && layer.style.paint) {
                const legendEl = buildStyleLegendElement(layer.style);
                if (legendEl) {
                    const details = item.querySelector('.layer-details');
                    if (details) details.appendChild(legendEl);
                }
            }
        });

        document.addEventListener('layer:raster-style-applied', (e) => {
            const layer = e.detail?.layer;
            if (!layer) return;
            const key = btoa(layer.src || '');
            const item = domElements.projectLayersList?.querySelector(`[data-layer-key="${CSS.escape(key)}"]`);
            if (!item) return;
            // remove old legend if present
            const oldLegend = item.querySelector('.layer-legend-wrap');
            if (oldLegend) oldLegend.remove();
            // update stored layer data
            try {
                const stored = JSON.parse(item.dataset.layerData);
                stored.style = layer.style;
                item.dataset.layerData = JSON.stringify(stored);
            } catch (_) {}
            // inject new raster legend
            if (layer.style && layer.style.colormap) {
                const legendEl = buildRasterLegendElement(layer.style);
                if (legendEl) {
                    const details = item.querySelector('.layer-details');
                    if (details) details.appendChild(legendEl);
                }
            }
        });
    }

    // =========================================================================
    // UI - SIDEBAR HELPERS
    // =========================================================================

    /**
     * Apre la sidebar layer e espande il wrapper sinistro
     */
    function sidebarOpen() {
        if (domElements.sidebar && domElements.sidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            domElements.sidebar.classList.remove(CSS_CLASSES.CLOSED);
        }
        // Close user panel if open (mutually exclusive)
        const userSidebar = document.getElementById('userSidebar');
        if (userSidebar && !userSidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            userSidebar.classList.add(CSS_CLASSES.CLOSED);
        }
        expandLeftSidebar();
    }

    /**
     * Chiude la sidebar layer; se nessun panel è aperto, collassa il wrapper
     */
    function sidebarClose() {
        if (domElements.sidebar && !domElements.sidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            domElements.sidebar.classList.add(CSS_CLASSES.CLOSED);
        }
        // Collapse wrapper only if user panel is also closed
        const userSidebar = document.getElementById('userSidebar');
        if (!userSidebar || userSidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            collapseLeftSidebar();
        }
    }

    // =========================================================================
    // LEFT SIDEBAR - Wrapper expand / collapse / resize
    // =========================================================================

    /**
     * Espande il wrapper sinistro alla larghezza salvata (o default)
     * @param {number} [width] - Larghezza target in px
     */
    function expandLeftSidebar(width) {
        const wrapper = document.getElementById('leftSidebarWrapper');
        if (!wrapper) return;
        const targetWidth = width || leftPreviousWidth;
        wrapper.style.width = targetWidth + 'px';
        saveLeftSidebarState();
    }

    /**
     * Collassa il wrapper sinistro a 48px (solo strip pulsanti)
     */
    function collapseLeftSidebar() {
        const wrapper = document.getElementById('leftSidebarWrapper');
        if (!wrapper) return;
        const currentWidth = wrapper.offsetWidth;
        if (currentWidth > LEFT_SIDEBAR_CONFIG.MIN_WIDTH) {
            leftPreviousWidth = currentWidth;
        }
        wrapper.style.width = LEFT_SIDEBAR_CONFIG.MIN_WIDTH + 'px';
        // Close all panels
        if (domElements.sidebar && !domElements.sidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            domElements.sidebar.classList.add(CSS_CLASSES.CLOSED);
        }
        const userSidebar = document.getElementById('userSidebar');
        if (userSidebar && !userSidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            userSidebar.classList.add(CSS_CLASSES.CLOSED);
        }
        saveLeftSidebarState();
    }

    /**
     * Configura il resize handle del sidebar sinistro
     */
    function setupLeftResizeHandle() {
        const handle = document.getElementById('leftResizeHandle');
        if (!handle) return;
        handle.addEventListener('mousedown', handleLeftResizeStart);
    }

    /**
     * Inizia il resize del wrapper sinistro
     * @param {MouseEvent} e
     */
    function handleLeftResizeStart(e) {
        const wrapper = document.getElementById('leftSidebarWrapper');
        if (!wrapper) return;
        // Only allow resize if a panel is visible (width > 48px)
        if (wrapper.offsetWidth <= LEFT_SIDEBAR_CONFIG.MIN_WIDTH) return;

        e.preventDefault();
        leftResizing = true;
        leftResizeStartX = e.clientX;
        leftResizeStartWidth = wrapper.offsetWidth;

        wrapper.classList.add('no-transition');
        document.addEventListener('mousemove', handleLeftResizeMove);
        document.addEventListener('mouseup', handleLeftResizeEnd);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    /**
     * Gestisce il trascinamento del resize handle
     * @param {MouseEvent} e
     */
    function handleLeftResizeMove(e) {
        if (!leftResizing) return;
        const wrapper = document.getElementById('leftSidebarWrapper');
        if (!wrapper) return;

        const deltaX = e.clientX - leftResizeStartX; // Neg = left = wider (sidebar on right side)
        const newWidth = leftResizeStartWidth - deltaX;
        const constrained = Math.max(
            LEFT_SIDEBAR_CONFIG.MIN_WIDTH,
            Math.min(newWidth, LEFT_SIDEBAR_CONFIG.MAX_WIDTH)
        );
        wrapper.style.width = constrained + 'px';

        // Auto-collapse if dragged under threshold
        if (constrained <= LEFT_SIDEBAR_CONFIG.COLLAPSE_THRESHOLD) {
            collapseLeftSidebar();
        }
    }

    /**
     * Finalizza il resize
     */
    function handleLeftResizeEnd() {
        if (!leftResizing) return;
        leftResizing = false;

        document.removeEventListener('mousemove', handleLeftResizeMove);
        document.removeEventListener('mouseup', handleLeftResizeEnd);
        document.body.style.cursor = 'auto';
        document.body.style.userSelect = 'auto';

        const wrapper = document.getElementById('leftSidebarWrapper');
        if (!wrapper) return;

        wrapper.classList.remove('no-transition');

        const currentWidth = wrapper.offsetWidth;
        if (currentWidth <= LEFT_SIDEBAR_CONFIG.COLLAPSE_THRESHOLD) {
            collapseLeftSidebar();
        } else {
            leftPreviousWidth = currentWidth;
            saveLeftSidebarState();
        }
    }

    /**
     * Salva la larghezza corrente del wrapper in localStorage
     */
    function saveLeftSidebarState() {
        localStorage.setItem(LEFT_SIDEBAR_CONFIG.STORAGE_PREV_WIDTH_KEY, String(leftPreviousWidth));
    }

    /**
     * Ripristina la larghezza salvata del wrapper da localStorage
     */
    function restoreLeftSidebarState() {
        const saved = localStorage.getItem(LEFT_SIDEBAR_CONFIG.STORAGE_PREV_WIDTH_KEY);
        if (saved) {
            leftPreviousWidth = Math.max(
                LEFT_SIDEBAR_CONFIG.MIN_WIDTH,
                Math.min(Number(saved), LEFT_SIDEBAR_CONFIG.MAX_WIDTH)
            );
        }
    }

    // =========================================================================
    // AGGIUNTA LAYERS - GEOJSON
    // =========================================================================

    /**
     * Gestisce l'aggiunta di un layer GeoJSON
     */
    function handleAddGeoJSON() {
        const url = (domElements.geojsonUrl?.value || '').trim();
        if (!url) return;

        const wantRegister = domElements.regSwitchVector?.checked || false;
        const baseLayerData = { src: url, type: 'vector' };

        if (wantRegister) {
            openRegModal(baseLayerData);
        } else {
            dispatchEvent('layer:add-geojson', { layer_data: { ...baseLayerData, register: false } });
        }
    }

    /**
     * Gestisce l'aggiunta di un layer COG (raster)
     */
    function handleAddCOG() {
        const url = (domElements.cogUrl?.value || '').trim();
        if (!url) return;

        const colormap = domElements.cmap?.value || '';
        const wantRegister = domElements.regSwitchRaster?.checked || false;
        const baseLayerData = { src: url, type: 'raster', metadata: { colormap } };

        if (wantRegister) {
            openRegModal(baseLayerData);
        } else {
            dispatchEvent('layer:add-cog', { layer_data: { ...baseLayerData, register: false } });
        }
    }

    // =========================================================================
    // MODAL - REGISTRAZIONE LAYER
    // =========================================================================

    /**
     * Apre il modal di registrazione layer
     * @param {Object} payload - Dati layer { src, type, metadata? }
     */
    function openRegModal(payload) {
        pendingReg = payload;

        if (domElements.lrSrc) domElements.lrSrc.value = payload.src || '';
        if (domElements.lrTitle) domElements.lrTitle.value = '';
        if (domElements.lrDesc) domElements.lrDesc.value = '';
        if (domElements.lrType) domElements.lrType = payload.type || '';

        if (domElements.lrError) {
            domElements.lrError.classList.add(CSS_CLASSES.D_NONE);
        }

        if (domElements.layerRegModal) {
            domElements.layerRegModal.classList.remove(CSS_CLASSES.HIDDEN);
        }

        delayedFocus(domElements.lrTitle, LAYER_CONSTANTS.DRAG_DELAY_MS);

        // Setup auto-expand textarea
        if (domElements.lrDesc) {
            domElements.lrDesc.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
        }
    }

    /**
     * Chiude il modal di registrazione
     */
    function closeRegModal() {
        if (domElements.layerRegModal) {
            domElements.layerRegModal.classList.add(CSS_CLASSES.HIDDEN);
        }
        pendingReg = null;
    }

    /**
     * Gestisce la conferma della registrazione layer
     */
    function handleConfirmRegistration() {
        const title = (domElements.lrTitle?.value || '').trim();

        if (!title) {
            showRegModalError(LAYER_CONSTANTS.ERR_TITLE_REQUIRED);
            return;
        }

        hideRegModalError();

        if (!pendingReg) {
            showRegModalError(LAYER_CONSTANTS.ERR_LAYER_TYPE_UNSUPPORTED);
            return;
        }

        const layerData = {
            src: pendingReg.src,
            title: title,
            description: (domElements.lrDesc?.value || '').trim(),
            type: pendingReg.type,
            register: true
        };

        if (pendingReg.type === 'vector') {
            dispatchEvent('layer:add-geojson', { layer_data: layerData });
        } else if (pendingReg.type === 'raster') {
            dispatchEvent('layer:add-cog', { layer_data: layerData });
        } else {
            console.error('[LayerPanel] Unsupported layer type:', pendingReg.type);
            showRegModalError(LAYER_CONSTANTS.ERR_LAYER_TYPE_UNSUPPORTED);
            return;
        }

        closeRegModal();
    }

    /**
     * Mostra errore nel modal
     * @param {string} message - Messaggio di errore
     */
    function showRegModalError(message) {
        if (domElements.lrError) {
            domElements.lrError.textContent = message;
            domElements.lrError.classList.remove(CSS_CLASSES.D_NONE);
        }
    }

    /**
     * Nasconde errore nel modal
     */
    function hideRegModalError() {
        if (domElements.lrError) {
            domElements.lrError.classList.add(CSS_CLASSES.D_NONE);
        }
    }

    // =========================================================================
    // MODAL - CONFIGURAZIONE LAYER
    // =========================================================================

    /**
     * Apre il modal di configurazione layer
     * @param {Object} layer - Oggetto layer da configurare
     */
    function openLayerConfigModal(layer) {
        layerConfigCurrent = layer;

        // Popola header
        if (domElements.lcLayerTitle) {
            domElements.lcLayerTitle.textContent = layer.title || layer.src || '';
        }

        // Popola il select surface_type con le opzioni per il tipo di layer
        if (domElements.lcSurfaceType) {
            const options = SURFACE_TYPE_OPTIONS[layer.type] || [];
            const currentSurfaceType = layer.metadata?.surface_type || '';

            domElements.lcSurfaceType.innerHTML =
                '<option value="">— none —</option>' +
                options.map(opt =>
                    `<option value="${escapeHtml(opt.value)}"${opt.value === currentSurfaceType ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
                ).join('');
        }

        // Nascondi errori precedenti
        if (domElements.lcError) {
            domElements.lcError.classList.add(CSS_CLASSES.D_NONE);
            domElements.lcError.textContent = '';
        }

        if (domElements.layerConfigModal) {
            domElements.layerConfigModal.classList.remove(CSS_CLASSES.HIDDEN);
        }
    }

    /**
     * Chiude il modal di configurazione layer
     */
    function closeLayerConfigModal() {
        if (domElements.layerConfigModal) {
            domElements.layerConfigModal.classList.add(CSS_CLASSES.HIDDEN);
        }
        layerConfigCurrent = null;
    }

    /**
     * Conferma la configurazione layer, persiste al server e ricarica il layer sulla mappa
     */
    function handleConfirmLayerConfig() {
        if (!layerConfigCurrent) return;

        const surfaceType = domElements.lcSurfaceType?.value || '';

        const updatedMetadata = { ...(layerConfigCurrent.metadata || {}) };
        if (surfaceType) {
            updatedMetadata.surface_type = surfaceType;
        } else {
            delete updatedMetadata.surface_type;
        }

        const updatedLayer = { ...layerConfigCurrent, metadata: updatedMetadata };

        // Persisti al backend (stesso pattern di LayerSymbology)
        const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);
        if (threadId) {
            fetch(Routes.Agent.STATE(threadId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state_updates: { layer_registry: [updatedLayer] } })
            }).catch(err => {
                console.warn('[LayerPanel] Config persist failed (non-blocking):', err);
            });
        }

        closeLayerConfigModal();

        // Ricarica il layer sulla mappa per applicare il nuovo surface_type
        reloadProjectLayers(render=false);
        // renderLayerList()
        GeoMap.reloadLayer(updatedLayer);
    }

    // =========================================================================
    // CARICAMENTO LAYERS DAL BACKEND
    // =========================================================================

    /**
     * Ricarica la lista di layers dal backend
     */
    function reloadProjectLayers(render = true) {
        const projectId = getStorageValue(STORAGE_KEYS.PROJECT_ID);

        if (!domElements.projectLayersList) return;

        if (!projectId) {
            domElements.projectLayersList.innerHTML = `<div class="text-secondary">${LAYER_CONSTANTS.NO_PROJECT_MSG}</div>`;
            return;
        }

        // Show loading
        domElements.projectLayersList.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            <span style="color: whitesmoke;">${LAYER_CONSTANTS.LOADING_MSG}</span>
        `;

        const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);

        fetch(Routes.Agent.LAYERS(threadId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                const layers = Array.isArray(data) ? data : (Array.isArray(data?.layers) ? data.layers : []);
                if (domElements.layerCount) {
                    domElements.layerCount.textContent = String(layers.length);
                }
                renderLayerList(layers, render);
            })
            .catch(err => {
                console.error('[LayerPanel] Error loading layers:', err);
                domElements.projectLayersList.innerHTML = `<div class="text-danger">${LAYER_CONSTANTS.LOADING_FAILED_MSG}</div>`;
            });
    }

    // =========================================================================
    // RENDERING LISTA LAYERS
    // =========================================================================

    /**
     * Renderizza la lista di layers
     * @param {Array<Object>} layers - Array di layer objects
     */
    function renderLayerList(layers, render = true) {
        if (!domElements.projectLayersList) return;

        if (!layers || layers.length === 0) {
            domElements.projectLayersList.innerHTML = `<div class="text-secondary">${LAYER_CONSTANTS.NO_LAYERS_MSG}</div>`;
            return;
        }

        domElements.projectLayersList.innerHTML = '';

        layers.forEach(layer => {
            const layerItem = createLayerItemElement(layer);
            domElements.projectLayersList.appendChild(layerItem);

            // Dispatch layer add events
            if (render) {
                if (layer.type === 'vector') {
                    dispatchEvent('layer:add-geojson', { layer_data: layer });
                } else if (layer.type === 'raster') {
                    dispatchEvent('layer:add-cog', { layer_data: layer });
                }
            }
        });

        enableLayerDragSort();
    }

    /**
     * Crea un elemento layer item per la lista
     * @param {Object} layer - Oggetto layer
     * @returns {HTMLElement} L'elemento layer item
     */
    function buildStyleLegendElement(style) {
        const paint = style.paint || {};
        // Infer type from paint keys if not explicitly set on the style object
        const type = style.type ||
            ('fill-color' in paint ? 'fill' :
             'line-color' in paint ? 'line' :
             'circle-color' in paint ? 'circle' : null);
        const colorKey = type === 'fill' ? 'fill-color' : type === 'line' ? 'line-color' : type === 'circle' ? 'circle-color' : null;
        const colorExpr = colorKey ? paint[colorKey] : null;
        if (!colorExpr) return null;

        let bodyHtml = '';
        let styleKind = 'single';

        if (typeof colorExpr === 'string') {
            styleKind = 'single';
            bodyHtml = `<div class="layer-legend-single">
                <div class="layer-legend-swatch" style="background:${escapeHtml(colorExpr)}"></div>
                <span>Single color</span>
            </div>`;
        } else if (Array.isArray(colorExpr) && String(colorExpr[0]).startsWith('interpolate')) {
            styleKind = 'graduated';
            // extract field
            let field = '';
            for (let i = 0; i < colorExpr.length - 1; i++) {
                if (Array.isArray(colorExpr[i]) && colorExpr[i][0] === 'get') { field = colorExpr[i][1]; break; }
                if (colorExpr[i] === 'get' && typeof colorExpr[i + 1] === 'string') { field = colorExpr[i + 1]; break; }
            }
            // extract stops: [value, color, value, color, ...]
            const stops = [];
            for (let i = 3; i < colorExpr.length - 1; i += 2) {
                if (typeof colorExpr[i] === 'number' && typeof colorExpr[i + 1] === 'string') {
                    stops.push({ value: colorExpr[i], color: colorExpr[i + 1] });
                }
            }
            const minVal = stops.length ? stops[0].value : '';
            const maxVal = stops.length ? stops[stops.length - 1].value : '';
            // build gradient
            let gradStops = '';
            if (stops.length) {
                const range = stops[stops.length - 1].value - stops[0].value || 1;
                gradStops = stops.map(s => `${escapeHtml(s.color)} ${(((s.value - stops[0].value) / range) * 100).toFixed(1)}%`).join(', ');
            }
            bodyHtml = `<div class="layer-legend-graduated">
                ${field ? `<div class="layer-legend-field">${escapeHtml(field)}</div>` : ''}
                <canvas class="layer-legend-ramp" data-stops='${JSON.stringify(stops.map(s => s.color))}' height="12"></canvas>
                <div class="layer-legend-ramp-labels">
                    <span>${minVal !== '' ? minVal : ''}</span>
                    <span>${maxVal !== '' ? maxVal : ''}</span>
                </div>
            </div>`;
        } else if (Array.isArray(colorExpr) && colorExpr[0] === 'match') {
            styleKind = 'categorized';
            // format: ['match', ['to-string', ['get', field]], val, color, val, color, ..., fallback]
            const pairs = [];
            let i = 2;
            while (i < colorExpr.length - 1) {
                if (typeof colorExpr[i] !== 'undefined' && typeof colorExpr[i + 1] === 'string' && /^#/.test(colorExpr[i + 1])) {
                    pairs.push({ label: String(colorExpr[i]), color: colorExpr[i + 1] });
                    i += 2;
                } else { break; }
            }
            const MAX_SHOWN = 8;
            const shown = pairs //pairs.slice(0, MAX_SHOWN);
            // const extra = pairs.length - shown.length;
            bodyHtml = `<div class="layer-legend-cat-grid">
                ${shown.map(p => `<div class="layer-legend-cat-row">
                    <div class="layer-legend-cat-swatch" style="background:${escapeHtml(p.color)}"></div>
                    <span>${escapeHtml(p.label)}</span>
                </div>`).join('')}
                ${/* extra > 0 ? `<div class="layer-legend-cat-more">+${extra} more</div>` : '' */ ''}
            </div>`;
        }

        if (!bodyHtml) return null;

        const wrap = document.createElement('div');
        wrap.className = 'layer-legend-wrap';
        wrap.innerHTML = `
            <div class="layer-legend-header text-secondary">
                <span class="layer-legend-toggle-icon">▶</span>
                <strong>style legend</strong>
            </div>
            <div class="layer-legend-body d-none">${bodyHtml}</div>
        `;

        const header = wrap.querySelector('.layer-legend-header');
        const body = wrap.querySelector('.layer-legend-body');
        header.addEventListener('click', () => {
            const collapsed = body.classList.toggle('d-none');
            header.querySelector('.layer-legend-toggle-icon').textContent = collapsed ? '▶' : '▼';
            if (!collapsed) {
                // draw gradient canvases
                wrap.querySelectorAll('canvas.layer-legend-ramp[data-stops]').forEach(canvas => {
                    try {
                        const stops = JSON.parse(canvas.dataset.stops);
                        const ctx = canvas.getContext('2d');
                        const grad = ctx.createLinearGradient(0, 0, canvas.offsetWidth || 280, 0);
                        stops.forEach((c, idx) => grad.addColorStop(idx / Math.max(1, stops.length - 1), c));
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.offsetWidth || 280, canvas.height);
                    } catch (_) {}
                });
            }
        });

        return wrap;
    }

    function buildRasterLegendElement(style) {
        if (!style || !style.colormap) return null;
        const colormapInfo = (typeof LayerRasterSymbology !== 'undefined')
            ? LayerRasterSymbology.getColorStops(style.colormap)
            : null;
        const stops = colormapInfo
            ? (style.reverse ? [...colormapInfo.stops].reverse() : colormapInfo.stops)
            : null;
        const label = colormapInfo ? colormapInfo.label : style.colormap;
        const minVal = style.min !== undefined ? style.min : '';
        const maxVal = style.max !== undefined ? style.max : '';
        const opacity = style.opacity !== undefined ? Math.round(style.opacity * 100) : '';

        const bodyHtml = `<div class="layer-legend-graduated">
            <canvas class="layer-legend-ramp" data-stops='${stops ? JSON.stringify(stops) : '[]'}' height="12"></canvas>
            <div class="layer-legend-ramp-labels">
                <span>${escapeHtml(String(minVal))}</span>
                <span>${escapeHtml(String(maxVal))}</span>
            </div>
            <div class="layer-legend-field">${escapeHtml(label)}${opacity !== '' ? ` · opacity ${opacity}%` : ''}</div>
        </div>`;

        const wrap = document.createElement('div');
        wrap.className = 'layer-legend-wrap';
        wrap.innerHTML = `
            <div class="layer-legend-header text-secondary">
                <span class="layer-legend-toggle-icon">▶</span>
                <strong>style legend</strong>
            </div>
            <div class="layer-legend-body d-none">${bodyHtml}</div>
        `;

        const header = wrap.querySelector('.layer-legend-header');
        const body = wrap.querySelector('.layer-legend-body');
        header.addEventListener('click', () => {
            const collapsed = body.classList.toggle('d-none');
            header.querySelector('.layer-legend-toggle-icon').textContent = collapsed ? '▶' : '▼';
            if (!collapsed) {
                wrap.querySelectorAll('canvas.layer-legend-ramp[data-stops]').forEach(canvas => {
                    try {
                        const cs = JSON.parse(canvas.dataset.stops);
                        if (!cs.length) return;
                        const ctx = canvas.getContext('2d');
                        const grad = ctx.createLinearGradient(0, 0, canvas.offsetWidth || 280, 0);
                        cs.forEach((c, idx) => grad.addColorStop(idx / Math.max(1, cs.length - 1), c));
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, canvas.offsetWidth || 280, canvas.height);
                    } catch (_) {}
                });
            }
        });

        return wrap;
    }

    function createLayerItemElement(layer) {
        const item = document.createElement('div');
        item.className = 'layer-item';
        item.setAttribute('draggable', 'true');
        item.dataset.layerKey = btoa(layer.src || '');
        item.dataset.layerData = JSON.stringify({ ...layer, id: item.dataset.layerKey });

        // ===== Header row =====
        const row = document.createElement('div');
        row.className = 'layer-row';

        // Drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'layer-drag-handle';
        dragHandle.innerHTML = '<span class="drag-handle-symbol material-symbols-outlined">drag_indicator</span>';

        // Layer info
        const layerInfo = document.createElement('div');
        layerInfo.innerHTML = `
            <div class="layer-title">${escapeHtml(layer.title || 'Untitled')}</div>
            <div class="small">
                <span class="layer-toggle">View details</span>
            </div>
        `;

        // Left section
        const left = document.createElement('div');
        left.className = 'd-flex flex-row gap-1';
        left.appendChild(dragHandle);
        left.appendChild(layerInfo);

        // Right section - actions
        const right = document.createElement('div');
        right.className = 'layer-actions d-flex align-items-center gap-1';
        right.innerHTML = `
            <button class="btn btn-sm btn-outline-light layer-eye" title="Show/Hide">
                <span class="material-symbols-outlined">visibility_off</span>
            </button>
            <div class="dropdown">
                <button class="btn btn-sm btn-outline-light" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
                <ul class="dropdown-menu dropdown-menu-dark">
                    ${layer.type === 'vector' ? '<li><a class="dropdown-item" data-action="symbology">Style</a></li>' : ''}
                    ${layer.type === 'raster' ? '<li><a class="dropdown-item" data-action="raster-symbology">Style</a></li>' : ''}
                    <li><a class="dropdown-item" data-action="config">Config</a></li>
                    <li><a class="dropdown-item" data-action="download">Download</a></li>
                </ul>
            </div>
        `;

        bindLayerItemEvents(item, left, right, layer);

        row.appendChild(left);
        row.appendChild(right);
        item.appendChild(row);

        // ===== Details section =====
        const details = document.createElement('div');
        details.className = `layer-details ${CSS_CLASSES.D_NONE}`;

        // Static info rows
        const staticInfo = document.createElement('div');
        staticInfo.innerHTML = `
            <div class="small text-secondary mb-1">${escapeHtml(layer.type || '')}</div>
            <div class="mb-1 layer-detail detail-description">${escapeHtml(layer.description || '—')}</div>
            <div class="mb-1 text-secondary"><strong>src:</strong> <code>${escapeHtml(layer.src || '')}</code></div>
        `;
        details.appendChild(staticInfo);

        // Metadata section
        const metadata = layer.metadata || {};
        const metaKeys = Object.keys(metadata);
        if (metaKeys.length > 0) {
            const metaWrap = document.createElement('div');
            metaWrap.className = 'layer-meta-wrap';

            // Metadata header (toggle all)
            const metaHeader = document.createElement('div');
            metaHeader.className = 'layer-meta-header text-secondary';
            metaHeader.innerHTML = '<span class="layer-meta-toggle-icon">▶</span><strong>metadata</strong>';

            const metaBody = document.createElement('div');
            metaBody.className = 'layer-meta-body d-none';

            metaHeader.addEventListener('click', () => {
                const collapsed = metaBody.classList.toggle('d-none');
                metaHeader.querySelector('.layer-meta-toggle-icon').textContent = collapsed ? '▶' : '▼';
            });

            // One row per metadata key
            metaKeys.forEach(key => {
                const val = metadata[key];
                const isComplex = val !== null && typeof val === 'object';
                const rawVal = isComplex ? JSON.stringify(val, null, 2) : String(val ?? '');

                const keyRow = document.createElement('div');
                keyRow.className = 'layer-meta-key-row';

                const keyLabel = document.createElement('div');
                keyLabel.className = 'layer-meta-key-label';
                keyLabel.innerHTML = isComplex
                    ? `<span class="layer-meta-key-icon">▶</span><code>${escapeHtml(key)}</code>`
                    : `<span class="layer-meta-key-icon layer-meta-key-icon--leaf"></span><code>${escapeHtml(key)}</code><span class="layer-meta-inline-val">${escapeHtml(rawVal)}</span>`;

                keyRow.appendChild(keyLabel);

                if (isComplex) {
                    const keyVal = document.createElement('div');
                    keyVal.className = 'layer-meta-key-val d-none';
                    keyVal.innerHTML = `<pre><code>${escapeHtml(rawVal)}</code></pre>`;
                    keyLabel.addEventListener('click', () => {
                        const collapsed = keyVal.classList.toggle('d-none');
                        keyLabel.querySelector('.layer-meta-key-icon').textContent = collapsed ? '▶' : '▼';
                    });
                    keyRow.appendChild(keyVal);
                }
                metaBody.appendChild(keyRow);
            });

            metaWrap.appendChild(metaHeader);
            metaWrap.appendChild(metaBody);
            details.appendChild(metaWrap);
        }

        // Style legend section — vector
        if (layer.style && layer.style.paint) {
            const legendEl = buildStyleLegendElement(layer.style);
            if (legendEl) details.appendChild(legendEl);
        }

        // Style legend section — raster
        if (layer.type === 'raster' && layer.style && layer.style.colormap) {
            const legendEl = buildRasterLegendElement(layer.style);
            if (legendEl) details.appendChild(legendEl);
        }

        item.appendChild(details);

        // Toggle details
        const toggleLink = left.querySelector('.layer-toggle');
        if (toggleLink) {
            toggleLink.addEventListener('click', () => {
                details.classList.toggle(CSS_CLASSES.D_NONE);
                toggleLink.textContent = details.classList.contains(CSS_CLASSES.D_NONE) ? 'View details' : 'Hide details';
            });
        }

        return item;
    }

    /**
     * Associa gli eventi a un layer item
     * @param {HTMLElement} item - Elemento layer item
     * @param {HTMLElement} left - Sezione left
     * @param {HTMLElement} right - Sezione right (actions)
     * @param {Object} layer - Oggetto layer
     */
    function bindLayerItemEvents(item, left, right, layer) {
        // Eye toggle (visibility)
        const eyeButton = right.querySelector('.layer-eye');
        if (eyeButton) {
            eyeButton.addEventListener('click', () => {
                const layerData = JSON.parse(item.dataset.layerData);
                dispatchEvent('map:toggle-layer-visibility', layerData);

                const eyeIcon = eyeButton.querySelector('span');
                const isVisible = eyeIcon.textContent === 'visibility';
                eyeIcon.textContent = isVisible ? 'visibility_off' : 'visibility';
            });
        }

        // Symbology action (vector layers only)
        const symbologyLink = right.querySelector('[data-action="symbology"]');
        if (symbologyLink) {
            symbologyLink.addEventListener('click', (e) => {
                e.preventDefault();
                const layerData = JSON.parse(item.dataset.layerData);
                LayerSymbology.open(layerData);
            });
        }

        // Raster symbology action (raster layers only)
        const rasterSymbologyLink = right.querySelector('[data-action="raster-symbology"]');
        if (rasterSymbologyLink) {
            rasterSymbologyLink.addEventListener('click', (e) => {
                e.preventDefault();
                const layerData = JSON.parse(item.dataset.layerData);
                LayerRasterSymbology.open(layerData);
            });
        }

        // Config action
        const configLink = right.querySelector('[data-action="config"]');
        if (configLink) {
            configLink.addEventListener('click', (e) => {
                e.preventDefault();
                const layerData = JSON.parse(item.dataset.layerData);
                openLayerConfigModal(layerData);
            });
        }

        // Download action
        const downloadLink = right.querySelector('[data-action="download"]');
        if (downloadLink) {
            downloadLink.addEventListener('click', (e) => {
                e.preventDefault();
                const layerData = JSON.parse(item.dataset.layerData);
                downloadLayer(layerData);
            });
        }

        // Drag handle tracking
        item.addEventListener('mousedown', (e) => {
            draggingFromHandle = e.target.classList.contains('drag-handle-symbol');
        });
    }

    // =========================================================================
    // DRAG AND DROP - REORDER
    // =========================================================================

    /**
     * Abilita il drag-and-drop per il reordering dei layers
     */
    function enableLayerDragSort() {
        const container = domElements.projectLayersList;
        if (!container) return;

        let draggingEl = null;

        container.querySelectorAll('.layer-item[draggable="true"] .layer-drag-handle').forEach(dragHandle => {
            const item = dragHandle.closest('.layer-item');

            item.addEventListener('dragstart', (e) => {
                if (!draggingFromHandle) {
                    e.preventDefault();
                    return;
                }
                draggingEl = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.layerKey || '');
            });

            item.addEventListener('dragend', () => {
                if (!draggingEl) return;
                draggingEl.classList.remove('dragging');
                container.querySelectorAll('.drop-above,.drop-below').forEach(el => {
                    el.classList.remove('drop-above', 'drop-below');
                });
                draggingEl = null;
                dispatchNewOrder(container);
            });

            item.addEventListener('dragover', (e) => {
                if (!draggingEl || draggingEl === item) return;
                e.preventDefault();

                const rect = item.getBoundingClientRect();
                const isAbove = (e.clientY - rect.top) < rect.height / 2;
                item.classList.toggle('drop-above', isAbove);
                item.classList.toggle('drop-below', !isAbove);
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drop-above', 'drop-below');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggingEl || draggingEl === item) return;

                const isAbove = item.classList.contains('drop-above');
                item.classList.remove('drop-above', 'drop-below');

                if (isAbove) {
                    container.insertBefore(draggingEl, item);
                } else {
                    container.insertBefore(draggingEl, item.nextSibling);
                }
            });
        });
    }

    /**
     * Dispatcha l'evento con il nuovo ordine dei layers
     * @param {HTMLElement} container - Container dei layers
     */
    function dispatchNewOrder(container) {
        const order = [...container.querySelectorAll('.layer-item')]
            .map(el => el.dataset.layerKey);
        dispatchEvent('layers:reordered', { order });
    }

    // =========================================================================
    // DOWNLOAD LAYER
    // =========================================================================

    /**
     * Gestisce il download di un layer
     * @param {Object} layerData - Dati del layer
     */
    function downloadLayer(layerData) {
        console.log('[LayerPanel] Download layer:', layerData);

        const downloadUrl = layerData.metadata?.download_url;

        if (downloadUrl) {
            // Download diretto
            performDownload(downloadUrl);
        } else {
            // Recupera URL dal backend
            fetch(Routes.Agent.LAYER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src: layerData.src })
            })
                .then(response => response.json())
                .then(data => {
                    if (data?.download_url) {
                        console.log('[LayerPanel] Download URL:', data.download_url);
                        performDownload(data.download_url);
                    } else {
                        console.error('[LayerPanel]', LAYER_CONSTANTS.NO_DOWNLOAD_URL);
                    }
                })
                .catch(err => {
                    console.error('[LayerPanel]', LAYER_CONSTANTS.ERR_FETCH_DOWNLOAD_URL, err);
                });
        }
    }

    /**
     * Esegue il download di un file da URL
     * @param {string} url - URL del file
     * @param {string} [filename] - Nome file opzionale
     */
    function performDownload(url, filename = null) {
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename || url.split('/').pop() || 'download';
                link.click();
                URL.revokeObjectURL(link.href);
            })
            .catch(err => {
                console.error('[LayerPanel] Download failed:', err);
            });
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        reloadProjectLayers,
        sidebarOpen,
        sidebarClose,
        expandLeftSidebar,
        collapseLeftSidebar,
        listWrap: domElements.projectLayersList
    };
})();
