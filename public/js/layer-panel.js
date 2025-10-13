// Gestisce la sidebar: lista layers progetto + aggiunte manuali + azioni
const LayerPanel = (() => {
    let sidebar, badge;
    let count = 0;

    // UI sezioni nuove
    let listWrap, reloadBtn;

    let regModal;
    let lrSrc;
    let lrTitle;
    let lrDesc;
    let lrCancel;
    let lrConfirm;
    let lrError;

    // endpoint demo: adattalo al tuo backend
    // const ENDPOINT_LAYERS = 'http://localhost:5000/layers'; // GET/POST ?project_id=...

    function init() {
        sidebar = document.getElementById('sidebar');
        badge = document.getElementById('layerCount');

        listWrap = document.getElementById('projectLayersList');
        reloadBtn = document.getElementById('reloadLayers');

        document.getElementById('toggleBtn').onclick = () => sidebar.classList.toggle('closed');

        // Bottoni add layer (vector/raster)
        // document.getElementById('btnGeojson').onclick = () => {
        //     const url = document.getElementById('geojsonUrl').value.trim();
        //     if (!url) return;
        //     dispatch('layer:add-geojson', { url });
        // };
        // Vector: GeoJSON
        document.getElementById('btnGeojson').onclick = () => {
            const url = document.getElementById('geojsonUrl').value.trim();
            if (!url) return;
            const wantRegister = document.getElementById('regSwitchVector')?.checked;
            if (wantRegister) openRegModal({ src: url, kind: 'vector' });
            else dispatch('layer:add-geojson', { url });
        };

        // TODO: Shapefiles will be handled like geojson (vector)
        // document.getElementById('btnShp').onclick = () => {
        //     const url = document.getElementById('shpUrl').value.trim();
        //     if (!url) return;
        //     dispatch('layer:add-shp', { url });
        // };

        // document.getElementById('btnCog').onclick = () => {
        //     const url = document.getElementById('cogUrl').value.trim();
        //     if (!url) return;
        //     const colormap = document.getElementById('cmap').value;
        //     const opacity = document.getElementById('rasterOpacity').value;
        //     dispatch('layer:add-cog', { url, colormap, opacity });
        // };
        document.getElementById('btnCog').onclick = () => {
            const url = document.getElementById('cogUrl').value.trim();
            if (!url) return;
            const colormap = document.getElementById('cmap').value;
            const opacity = document.getElementById('rasterOpacity').value;
            const wantRegister = document.getElementById('regSwitchRaster')?.checked;
            if (wantRegister) openRegModal({ src: url, kind: 'raster', colormap, opacity });
            else dispatch('layer:add-cog', { url, colormap, opacity });
        };

        // Opacità live per tutti i raster aggiunti manualmente (lasciamo al modulo mappa la gestione concreta)
        document.getElementById('rasterOpacity').addEventListener('input', e => {
            document.dispatchEvent(new CustomEvent('layer:raster-opacity-global', { detail: { opacity: +e.target.value } }));
        });

        // Carica/ricarica layers progetto
        reloadBtn.onclick = reloadProjectLayers;

        // Ricarica al login e quando cambia progetto
        document.addEventListener('auth:ready', reloadProjectLayers);

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
            if (!title) { lrError.textContent = 'Compila almeno il titolo.'; lrError.classList.remove('d-none'); return; }
            lrError.classList.add('d-none');

            // emetti evento “registrazione + add”
            // puoi usare due step backend: 1) registra metadati 2) render-layer -> qui emettiamo un unico evento “intent”
            const detail = {
                url: pendingReg.src,
                title,
                description: lrDesc.value.trim(),
                kind: pendingReg.kind,
                colormap: pendingReg.colormap,
                opacity: pendingReg.opacity
            };
            document.dispatchEvent('layer:add-geojson', { detail });

            closeRegModal();
        };
    }

    let pendingReg = null;

    function openRegModal(payload) {
        pendingReg = payload; // {src, kind, ...}
        lrSrc.value = payload.src || '';
        lrTitle.value = '';
        lrDesc.value = '';
        lrError.classList.add('d-none');
        regModal.classList.remove('hidden');
        setTimeout(() => lrTitle.focus(), 30);
    }

    function closeRegModal() {
        regModal.classList.add('hidden');
        pendingReg = null;
    }


    function reloadProjectLayers() {
        const project_id = localStorage.getItem('project_id');
        if (!project_id) { listWrap.innerHTML = '<div class="text-secondary">Nessun progetto selezionato.</div>'; return; }

        listWrap.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span style="color: whitesmoke;">Caricamento layers ...</span>';
        let thread_id = localStorage.getItem('thread_id');
        // POST
        fetch(`http://localhost:5000/t/${thread_id}/layers`, {
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
                listWrap.innerHTML = '<div class="text-danger">Impossibile caricare i layers.</div>';
            });
    }

    function renderLayerList(layers) {
        if (!layers.length) {
            listWrap.innerHTML = '<div class="text-secondary">Questo progetto non ha ancora layers.</div>';
            return;
        }
        listWrap.innerHTML = '';

        for (const layer of layers) {
            const item = document.createElement('div');
            item.className = 'layer-item';

            // header riga
            const row = document.createElement('div');
            row.className = 'layer-row';

            const left = document.createElement('div');
            left.innerHTML = `<div class="layer-title">${escapeHtml(layer.title || 'Untitled')}</div>
                        <div class="small"><span class="layer-toggle">visualizza dettagli</span></div>`;

            const right = document.createElement('div');
            right.className = 'layer-actions';
            right.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-light" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
          <ul class="dropdown-menu dropdown-menu-dark">
            <li><a class="dropdown-item" href="#" data-action="toggle"  data-title="${escapeAttr(layer.title)}">Mostra/Nascondi</a></li>
            <li><a class="dropdown-item" href="#" data-action="download" data-title="${escapeAttr(layer.title)}">Download</a></li>
          </ul>
        </div>
      `;

            row.appendChild(left); row.appendChild(right);
            item.appendChild(row);

            // dettaglio collassabile
            const details = document.createElement('div');
            details.className = 'layer-details d-none';
            details.innerHTML = `
        <div class="small text-secondary mb-1">${escapeHtml(layer.type || '')}</div>
        <div class="mb-1">${escapeHtml(layer.description || '—')}</div>
        <div class="mb-1"><strong>src:</strong> <code>${escapeHtml(layer.src || '')}</code></div>
        <div><strong>metadata:</strong> <code>${escapeHtml(JSON.stringify(layer.metadata || {}))}</code></div>
      `;
            item.appendChild(details);

            // wiring toggle dettagli
            const toggleLink = left.querySelector('.layer-toggle');
            toggleLink.addEventListener('click', () => {
                details.classList.toggle('d-none');
                toggleLink.textContent = details.classList.contains('d-none') ? 'visualizza dettagli' : 'nascondi dettagli';
            });

            // wiring azioni menu
            right.addEventListener('click', (e) => {
                const a = e.target.closest('[data-action]'); if (!a) return;
                e.preventDefault();
                const action = a.dataset.action;
                const title = a.dataset.title;

                if (action === 'toggle') {
                    // demandiamo a GeoMap la logica di show/hide per titolo
                    document.dispatchEvent(new CustomEvent('layer:toggle-remote', { detail: { layer } }));
                } else if (action === 'download') {
                    document.dispatchEvent(new CustomEvent('layer:download', { detail: { layer } }));
                }
            });

            listWrap.appendChild(item);
        }
    }

    function incrementCount() { count++; badge.textContent = String(count); }
    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    // helpers XSS-safe
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    return { init, incrementCount, reloadProjectLayers };
})();
