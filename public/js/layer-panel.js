// Gestisce la sidebar: lista layers progetto + aggiunte manuali + azioni
const LayerPanel = (() => {
    let sidebar, badge;
    let count = 0;

    let dragging_from_handle = false;

    // UI sezioni nuove
    let listWrap, reloadBtn;

    let regModal;
    let lrSrc;
    let lrTitle;
    let lrDesc;
    let lrType;
    let lrCancel;
    let lrConfirm;
    let lrError;

    function init() {
        sidebar = document.getElementById('sidebar');
        badge = document.getElementById('layerCount');

        listWrap = document.getElementById('projectLayersList');
        reloadBtn = document.getElementById('reloadLayers');

        document.getElementById('toggleBtn').onclick = () => sidebar.classList.toggle('closed');

        // Vector: GeoJSON
        document.getElementById('btnGeojson').onclick = () => {
            const url = document.getElementById('geojsonUrl').value.trim();
            if (!url) return;
            const wantRegister = document.getElementById('regSwitchVector')?.checked;
            let base_layer_data = { src: url, type: 'vector' };
            if (wantRegister) openRegModal(base_layer_data);
            else dispatch('layer:add-geojson', { layer_data: { ...base_layer_data, register: false } });
        };

        // Raster: COG
        document.getElementById('btnCog').onclick = () => {
            const url = document.getElementById('cogUrl').value.trim();
            if (!url) return;
            const colormap = document.getElementById('cmap').value;
            const wantRegister = document.getElementById('regSwitchRaster')?.checked;
            let base_layer_data = { src: url, type: 'raster', metadata: { colormap: colormap } };
            if (wantRegister) openRegModal(base_layer_data);
            else dispatch('layer:add-cog', { layer_data: { ...base_layer_data, register: false } });
        };

        // Carica/ricarica layers progetto
        reloadBtn.onclick = reloadProjectLayers;

        // Ricarica al login e quando cambia progetto
        document.addEventListener('auth:ready', reloadProjectLayers);
        document.addEventListener('layer:reload-project-layers', reloadProjectLayers);

        // Modal registrazione layer
        regModal = document.getElementById('layerRegModal');
        lrSrc = document.getElementById('lrSrc');
        lrTitle = document.getElementById('lrTitle');
        lrDesc = document.getElementById('lrDesc');
        lrCancel = document.getElementById('lrCancel');
        lrConfirm = document.getElementById('lrConfirm');
        lrError = document.getElementById('lrError');

        // wiring pulsanti modal
        lrCancel.onclick = closeRegModal;
        lrConfirm.onclick = () => {
            const title = lrTitle.value.trim();
            if (!title) { lrError.textContent = 'AssignInsert at least the title.'; lrError.classList.remove('d-none'); return; }
            lrError.classList.add('d-none');

            const layer_data = {
                src: pendingReg.src,
                title: title,
                description: lrDesc.value.trim(),
                type: pendingReg.type,
                register: true
                // kind: pendingReg.kind,
                // colormap: pendingReg.colormap,
                // opacity: pendingReg.opacity
            };
            if (pendingReg.type == 'vector') {
                dispatch('layer:add-geojson', { layer_data: layer_data });
            } else if (pendingReg.type == 'raster') {
                dispatch('layer:add-cog', { layer_data: layer_data });
            } else {
                console.error('Tipo layer non supportato:', pendingReg.type);
                lrError.textContent = 'Layer type is not supported.';
                lrError.classList.remove('d-none');
                return;
            }

            closeRegModal();
        };
    }


    function sidebarOpen() {
        if (sidebar.classList.contains('closed')) {
            sidebar.classList.remove('closed');
        }
    }
    function sidebarClose() {
        if (!sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
        }
    }


    let pendingReg = null;

    function openRegModal(payload) {
        pendingReg = payload; // {src, kind, ...}
        lrSrc.value = payload.src || '';
        lrTitle.value = '';
        lrDesc.value = '';
        lrType = payload.type || '';
        lrError.classList.add('d-none');
        regModal.classList.remove('hidden');
        setTimeout(() => lrTitle.focus(), 30);

        document.getElementById("lrDesc").addEventListener("input", function () {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";
        });
    }

    function closeRegModal() {
        regModal.classList.add('hidden');
        pendingReg = null;
    }


    function reloadProjectLayers() {
        const project_id = localStorage.getItem('project_id');
        if (!project_id) { listWrap.innerHTML = '<div class="text-secondary">No selected project.</div>'; return; }

        listWrap.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span style="color: whitesmoke;">Loading layers ...</span>';
        let thread_id = localStorage.getItem('thread_id');
        // POST
        fetch(Routes.Agent.LAYERS(thread_id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
            .then(data => {
                const layers = Array.isArray(data) ? data : (Array.isArray(data?.layers) ? data.layers : []);
                badge.textContent = String(layers.length);
                renderLayerList(layers);
            })
            .catch(err => {
                console.error(err);
                listWrap.innerHTML = '<div class="text-danger">Loading layers failed.</div>';
            });
    }

    function renderLayerList(layers) {
        if (!layers.length) {
            listWrap.innerHTML = '<div class="text-secondary">This project has no layers (yet).</div>';
            return;
        }
        listWrap.innerHTML = '';

        for (const layer of layers) {
            const item = document.createElement('div');
            item.className = 'layer-item';
            item.setAttribute('draggable', 'true');
            item.dataset.layerKey = btoa(layer.src)
            item.dataset.layerData = JSON.stringify({ ...layer, ...{ id: item.dataset.layerKey } }); // per passare dati al backend se serve

            // header riga
            const row = document.createElement('div');
            row.className = 'layer-row';

            const dragHandle = document.createElement('div');
            dragHandle.className = 'layer-drag-handle';
            dragHandle.innerHTML = '<span class="drag-handle-symbol material-symbols-outlined">drag_indicator</span>';

            const layerInfo = document.createElement('div');
            layerInfo.innerHTML = `
            <div class="layer-title">${escapeHtml(layer.title || 'Untitled')}</div>
            <div class="small">
                <span class="layer-toggle">View details</span>
            </div>`;

            const left = document.createElement('div');
            left.className = 'd-flex flex-row gap-1';
            left.appendChild(dragHandle);
            left.appendChild(layerInfo);

            const right = document.createElement('div');
            right.className = 'layer-actions d-flex align-items-center gap-1';
            right.innerHTML = `
            <button class="btn btn-sm btn-outline-light layer-eye" title="Show/Hide">
                <span class="material-symbols-outlined">visibility_off</span>
            </button>
            <div class="dropdown">
                <button class="btn btn-sm btn-outline-light" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
                <ul class="dropdown-menu dropdown-menu-dark">
                    <!-- <li><a class="dropdown-item" href="#" data-action="toggle"  data-title="${escapeAttr(layer.title)}">Show/Hide</a></li> -->
                    <li><a class="dropdown-item" data-action="download">Download</a></li>
                </ul>
            </div>
            `;

            right.querySelector('.layer-eye').addEventListener('click', () => {
                // toggle visibilità layer nella mappa
                dispatch('map:toggle-layer-visibility', JSON.parse(item.dataset.layerData))

                right.querySelector('.layer-eye span').textContent = right.querySelector('.layer-eye span').textContent === 'visibility' ? 'visibility_off' : 'visibility';
            });
            right.querySelector('[data-action="download"]').addEventListener('click', () => {
                downloadLayer(JSON.parse(item.dataset.layerData));
            })


            // row.appendChild(dragHandle);
            row.appendChild(left);
            row.appendChild(right);
            item.appendChild(row);

            // dettaglio collassabile
            const details = document.createElement('div');
            details.className = 'layer-details d-none';
            details.innerHTML = `
        <div class="small text-secondary mb-1">${escapeHtml(layer.type || '')}</div>
        <div class="mb-1 layer-detail detail-description">${escapeHtml(layer.description || '—')}</div>
        <div class="mb-1 text-secondary"><strong>src:</strong> <code>${escapeHtml(layer.src || '')}</code></div>
        <div class="text-secondary"><strong>metadata:</strong> <code>${escapeHtml(JSON.stringify(layer.metadata || {}))}</code></div>
      `;
            item.appendChild(details);

            // wiring toggle dettagli
            const toggleLink = left.querySelector('.layer-toggle');
            toggleLink.addEventListener('click', () => {
                details.classList.toggle('d-none');
                toggleLink.textContent = details.classList.contains('d-none') ? 'show details' : 'hide details';
            });

            // wiring azioni menu
            right.addEventListener('click', (e) => {
                const a = e.target.closest('[data-action]'); if (!a) return;
                e.preventDefault();
                const action = a.dataset.action;
                const title = a.dataset.title;

                if (action === 'toggle') {
                    document.dispatchEvent(new CustomEvent('layer:toggle-remote', { detail: { layer } }));
                } else if (action === 'download') {
                    document.dispatchEvent(new CustomEvent('layer:download', { detail: { layer } }));
                }
            });

            item.addEventListener('mousedown', (e) => {
                dragging_from_handle = e.target.classList.contains('drag-handle-symbol');
            });

            listWrap.appendChild(item);

            if (layer.type === 'vector') {
                dispatch('layer:add-geojson', { layer_data: layer })
            } else if (layer.type === 'raster') {
                dispatch('layer:add-cog', { layer_data: layer });
            }
        }

        enableLayerDragSort();
    }

    function enableLayerDragSort() {
        const container = document.getElementById('projectLayersList');
        if (!container) return;

        let draggingEl = null;

        container.querySelectorAll('.layer-item[draggable="true"] .layer-drag-handle').forEach(item_drag_handle => {
            let item = item_drag_handle.closest('.layer-item');

            item.addEventListener('dragstart', (e) => {
                if (!dragging_from_handle) {
                    e.preventDefault(); // non iniziare il drag se non dal handle
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
                container.querySelectorAll('.drop-above,.drop-below').forEach(el => el.classList.remove('drop-above', 'drop-below'));
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
                if (isAbove) container.insertBefore(draggingEl, item);
                else container.insertBefore(draggingEl, item.nextSibling);
            });
        });
    }

    function dispatchNewOrder(container) {
        const order = [...container.querySelectorAll('.layer-item')]
            .map(el => el.dataset.layerKey);
        document.dispatchEvent(new CustomEvent('layers:reordered', { detail: { order } }));
    }

    function downloadLayer(layer_data) {

        console.log('downloadLayer', layer_data);

        function download(url, filename = null) {
            fetch(url)
            .then(res => res.blob())
            .then(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename || url.split('/').pop();
                a.click();
                URL.revokeObjectURL(a.href);
            });
        }

        const url = layer_data.metadata?.download_url
        if (!url) {
            // post with src as payload
            fetch(Routes.Agent.LAYER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ src: layer_data.src })
            })
            .then(res => res.json())
            .then(data => {
                if (data?.download_url) {
                    console.log('Download URL:', data.download_url);
                    download(data.download_url);
                } else {
                    console.error('No download URL provided by backend');
                }
            })
            .catch(err => {
                console.error('Error fetching download URL:', err);
            });
        } else {
            download(url);
        }
        
    }

    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    // helpers XSS-safe
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    return { init, reloadProjectLayers, listWrap, sidebarOpen, sidebarClose };
})();
