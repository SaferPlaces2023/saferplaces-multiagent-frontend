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
    // =========================================================================
    // COSTANTI LOCALI
    // =========================================================================
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
        lrError: 'lrError'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};
    let pendingReg = null;
    let draggingFromHandle = false;

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo LayerPanel
     */
    function init() {
        domElements = cacheElements(DOM_IDS);
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
                domElements.sidebar.classList.toggle(CSS_CLASSES.CLOSED);
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
    }

    /**
     * Associa gli eventi di caricamento layers
     */
    function bindLayerLoadEvents() {
        document.addEventListener('auth:ready', reloadProjectLayers);
        document.addEventListener('layer:reload-project-layers', reloadProjectLayers);
    }

    // =========================================================================
    // UI - SIDEBAR HELPERS
    // =========================================================================

    /**
     * Apre la sidebar
     */
    function sidebarOpen() {
        if (domElements.sidebar && domElements.sidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            domElements.sidebar.classList.remove(CSS_CLASSES.CLOSED);
        }
    }

    /**
     * Chiude la sidebar
     */
    function sidebarClose() {
        if (domElements.sidebar && !domElements.sidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            domElements.sidebar.classList.add(CSS_CLASSES.CLOSED);
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
    // CARICAMENTO LAYERS DAL BACKEND
    // =========================================================================

    /**
     * Ricarica la lista di layers dal backend
     */
    function reloadProjectLayers() {
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
                renderLayerList(layers);
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
    function renderLayerList(layers) {
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
            if (layer.type === 'vector') {
                dispatchEvent('layer:add-geojson', { layer_data: layer });
            } else if (layer.type === 'raster') {
                dispatchEvent('layer:add-cog', { layer_data: layer });
            }
        });

        enableLayerDragSort();
    }

    /**
     * Crea un elemento layer item per la lista
     * @param {Object} layer - Oggetto layer
     * @returns {HTMLElement} L'elemento layer item
     */
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
        details.innerHTML = `
            <div class="small text-secondary mb-1">${escapeHtml(layer.type || '')}</div>
            <div class="mb-1 layer-detail detail-description">${escapeHtml(layer.description || '—')}</div>
            <div class="mb-1 text-secondary"><strong>src:</strong> <code>${escapeHtml(layer.src || '')}</code></div>
            <div class="text-secondary"><strong>metadata:</strong> <code>${escapeHtml(JSON.stringify(layer.metadata || {}))}</code></div>
        `;
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
        listWrap: domElements.projectLayersList
    };
})();
