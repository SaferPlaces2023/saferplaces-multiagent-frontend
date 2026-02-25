# 03 - Componenti di Supporto

Componenti di supporto che facilitano funzionalità della mappa e notifiche.

---

## 🎨 DrawTools - Strumenti di Disegno Geometrico

**File**: `public/js/draw-tools.js` (~1026 righe)  
**Partial**: Integrato in `geo-map.html` (toolbar disegno)  
**CSS**: `public/css/geo-map.css` (contiene `dt-*` classes)

### Responsabilità

- Strumenti per disegnare geometrie sulla mappa
- Modalità disegno: Punto, Linea, BBox, Poligono
- Modalità Edit: modifica BBox tramite drag
- Modalità Delete: elimina feature
- Gestione feature collection
- Display lista collezioni disegnate

### Geometrie Supportate

| Tipo | Icona | Descrizione |
|------|-------|------------|
| **Point** | 📍 | Click singolo su mappa |
| **LineString** | 📍➡️📍 | Click multipli (disable per ora) |
| **BBox** | ◻️ | Drag da angolo |
| **Polygon** | 🔷 | Click multipli, doppio-click chiude |

### Struttura HTML Toolbar

```html
<div class=\"draw-toolbar\" role=\"toolbar\">
    <!-- Collections panel -->
    <button id=\"dtCollections\">
        <span class=\"material-symbols-outlined\">inventory_2</span>
    </button>
    <div id=\"dtCollectionsPanel\" class=\"dt-panel hidden\">
        <div class=\"dt-panel-head\">
            <strong>Drawn Collections</strong>
            <span id=\"dtCollectionsCount\">0</span>
        </div>
        <div id=\"dtCollectionsList\"></div>
    </div>
    
    <!-- Draw buttons -->
    <button id=\"dtPoint\">📍</button>
    <button id=\"dtLine\">📍➡️</button>
    <button id=\"dtBbox\">◻️</button>
    <button id=\"dtPoly\">🔷</button>
    
    <!-- Edit/Delete -->
    <button id=\"dtEdit\">✏️</button>
    <button id=\"dtDel\">🗑️</button>
    
    <!-- Confirm (appear durante draw) -->
    <div id=\"draw-confirm\" class=\"gap-1 closed\">
        <button id=\"dtSave\" class=\"dt-success\">✓</button>
        <button id=\"dtCancel\" class=\"dt-danger\">✗</button>
    </div>
</div>
```

### API Pubblica

```javascript
DrawTools.init(mapInstance)
// Inizializza toolbar e legga alla mappa

DrawTools.start(mode)
// Inizia disegno: mode = 'point' | 'linestring' | 'bbox' | 'polygon'

DrawTools.stop(save)
// Termina disegno: save = true per salvare, false per scartare

DrawTools.startEditBboxMode()
// Abilita edit di BBox (drag corners)

DrawTools.stopEditMode()
// Termina edit
```

### Flusso Disegno Punto

```
User clicca dtPoint button
      │
      ├─ setActive(dtPoint)  ← highlight button
      ├─ start('point')
      ├─ isDrawing = true
      │
      └─ Map \"click\" listener abilitato
             │ (intercetta click sulla mappa)
             │
             ├─ get clicked position (lngLat)
             ├─ create GeoJSON point feature
             ├─ map.addSource() + map.addLayer()
             │
             └─ draw-confirm buttons appaiono
                    │
                    User clicca ✓ (Save)
                    │
                    ├─ stop(true)
                    ├─ SaveFeatureCollection()
                    ├─ Crea source MapLibre
                    ├─ Draw-confirm scompare
                    │
                    └─ Feature salvata in DrawFeatureCollections[id]
```

### Flusso Disegno BBox

```
User clicca dtBbox
      │
      ├─ start('bbox')
      │
      └─ Map \"pointerdown\" listener
             │
             ├─ bboxStartLngLat = clicked position
             ├─ isBboxDragging = true
             ├─ Draw preview rectangle (non persistente)
             │
             └─ Map \"pointermove\" listener
                    │
                    ├─ Calcola bounding box corrente
                    ├─ Aggiorna preview rect
                    │
                    └─ Map \"pointerup\" listener
                           │
                           ├─ isBboxDragging = false
                           ├─ Crea GeoJSON polygon dalla bbox
                           ├─ map.addSource() + map.addLayer()
                           │
                           └─ draw-confirm appare
                                  │
                                  Save: salva in collezione
                                  Cancel: scarta
```

### Flusso Disegno Poligono

```
User clicca dtPoly
      │
      ├─ start('polygon')
      ├─ isPolyDrawing = false
      │
      └─ First click on map
             │
             ├─ polyCoords = [firstPoint]
             ├─ isPolyDrawing = true
             ├─ map.addSource() + first layer
             │
             └─ Subsequent clicks
                    │
                    ├─ polyCoords.push(newPoint)
                    ├─ Update layer (line between points)
                    ├─ lastMouseLngLat = mouse position (live preview)
                    │
                    └─ Double-click to close
                           │
                           ├─ polyCoords.push(polyCoords[0])  ← close ring
                           ├─ Create full polygon
                           ├─ isPolyDrawing = false
                           │
                           └─ draw-confirm appare
```

### Modalità Edit BBox

Quando BBox salvato o selezionato in edit mode:

```
User clicca dtEdit
      │
      ├─ startEditBboxMode()
      ├─ 8 corner handles visualizzati
      │
      └─ User trascina corner handle
             │
             ├─ dragState = { kind: 'resize', cornerKey, startBbox }
             ├─ Mentre drag: ricalcola bbox live
             │
             └─ Release mouse
                    │
                    ├─ dragState = null
                    ├─ Bbox finale salvata in layer
                    │
                    └─ Handles rimangono visibili finché edit mode attivo
```

### Feature Collection Registry

DrawTools mantiene collezioni disegnate:

```javascript
DrawFeatureCollections = {
    'draw-point-src-abc123': {
        type: 'FeatureCollection',
        features: [ { geometry: {...}, properties: {...} } ]
    },
    'draw-polygon-src-def456': {
        // ...
    }
}

// Ogni collezione ha:
// - source ID univoco su mappa
// - layer ID per renderizzazione
// - layer ID per handles (se in edit)
```

### Integrazione Mappa

DrawTools aggiunge feature come MapLibre GeoJSON sources/layers:

```javascript
map.addSource(sourceId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [...] }
});

map.addLayer({
    id: layerId + '-fill',
    source: sourceId,
    type: 'fill',
    paint: { 'fill-color': '#6ee7b7', 'fill-opacity': 0.25 }
});

map.addLayer({
    id: layerId + '-line',
    source: sourceId,
    type: 'line',
    paint: { 'line-color': '#6ee7b7', 'line-width': 2 }
});
```

### Integrazione Tool Calls

Quando backend (via AI Chat) ritorna tool_calls con user_drawn_shapes:

```javascript
document.addEventListener('draw-tool:update-user-drawn-shapes', e => {
    const { user_drawn_shapes } = e.detail;
    // DrawTools interperterà e visualizza forme
});
```

---

## ⏰ TimeSlider - Slider Temporale

**File**: `public/js/time-slider.js` (~271 righe)  
**Partial**: `public/partials/time-slider.html`  
**CSS**: `public/css/time-slider.css`

### Responsabilità

- Slider interattivo per selezione time range
- Play/Pausa animazione temporale
- Regolazione velocità riproduzione
- Highlight intervalli temporali
- Emissione evento `timeslider:change` quando tempo cambia

### Struttura HTML

```html
<button class=\"btn\" id=\"tsToggleBtn\">⏱️</button>

<section id=\"timeSlider\" class=\"ts-container closed\">
    <div class=\"ts-card\">
        <!-- Controlli -->
        <div class=\"ts-header\">
            <div class=\"ts-controls\">
                <button id=\"tsPlay\" title=\"Play/Pause\">▶️</button>
                <select id=\"tsSpeed\">
                    <option value=\"800\">0.5× (slow)</option>
                    <option value=\"500\" selected>1×</option>
                    <option value=\"250\">2×</option>
                    <option value=\"100\">5×</option>
                    <option value=\"50\">10×</option>
                    <option value=\"25\">20× (very fast)</option>
                </select>
                <div id=\"tsNow\">—</div>
            </div>
        </div>
        
        <!-- Track -->
        <div class=\"ts-track-wrap\" id=\"tsTrackWrap\">
            <!-- Highlight intervalli -->
            <div id=\"tsHighlights\"></div>
            
            <!-- Track + handle -->
            <div class=\"ts-track\" id=\"tsTrack\">
                <div id=\"tsTicks\"></div>
                <div class=\"ts-handle\" id=\"tsHandle\">
                    <div class=\"ts-handle-dot\"></div>
                </div>
            </div>
            
            <!-- Tooltip -->
            <div id=\"tsTooltip\" class=\"hidden\"></div>
        </div>
        
        <!-- Range labels -->
        <div class=\"ts-range\">
            <span id=\"tsStartLabel\">—</span>
            <span id=\"tsEndLabel\">—</span>
        </div>
    </div>
</section>
```

### API Pubblica

```javascript
TimeSlider.init({
    startISO: '2024-02-01T00:00:00Z',
    endISO: '2024-02-02T00:00:00Z',
    valueISO?: '2024-02-01T12:00:00Z',
    stepMinutes?: 60,
    intervals?: [
        { start: '...', end: '...', label: 'Pioggia', color: '#60a5fa' },
        // ...
    ]
})
// Inizializza slider con range e intervalli

TimeSlider.setRange(startISO, endISO)
// Cambia range temporale

TimeSlider.setValue(iso)
// Cambia valore corrente

TimeSlider.setIntervals(list)
// Aggiorna intervalli highlight

TimeSlider.play()
// Inizia riproduzione automatica

TimeSlider.pause()
// Pausa riproduzione

TimeSlider.isPlaying()
// Ritorna bool
```

### Flusso Play

```
User clicca play button
      │
      ├─ togglePlay()
      ├─ playBtn.classList.add('playing')
      │
      └─ Timer intervallo creato
             │ (stepMinutes convertito da select tsSpeed)
             │
             ├─ Ogni intervallo: setValue(next_time)
             │     │
             │     └─ dispatch('timeslider:change', { iso, date })
             │
             └─ GeoMap listener riceve
                    │
                    └─ GeoMap.renderTimestampRasters(iso)
                           │
                           ├─ Fetches raster per timestamp
                           └─ Renders on map
```

### Intervalli Highlight

Intervalli rappresentano time windows con colore specifico (es. \"pioggia dalle 14:00 a 16:00\"):

```javascript
setIntervals([
    {
        start: '2024-02-01T14:00:00Z',
        end: '2024-02-01T16:00:00Z',
        label: 'Pioggia intensa',
        color: '#60a5fa'
    }
]);

// Rendering:
// - Calcola % posizione sinistra e destra
// - Crea div con background color
// - Appende a tsHighlights
// - Hover mostra tooltip con label
```

### Colormap Intervalli

```javascript
const intervalColors = [
    '#6ee7b7',   // teal
    '#60a5fa',   // blue
    '#f472b6',   // pink
    '#facc15',   // yellow
    '#fb923c',   // orange
    '#f87171',   // red
    '#a78bfa',   // purple
    '#34d399',   // emerald
    '#38bdf8',   // sky
    '#c084fc',   // fuchsia
];
// Se più intervalli che colori, cicla
```

### Tick Orari

TimeSlider genera tick orari automatici:

```javascript
layoutTicks() {
    // Calcola step orario basato su range
    // Genera tick per ogni ora
    // Posiziona tick percentualmente su track
}
```

Es. range 24 ore: tick ogni ora (24 tick)  
Range 1 ora: tick ogni 10 minuti (6 tick)

### Integrazione GeoMap

Quando è abilitato TimeSlider (ha intervalli):

```javascript
document.addEventListener('timeslider:change', e => {
    const { iso, date } = e.detail;  // ISO string + Date object
    GeoMap.renderTimestampRasters(iso);
});
```

GeoMap.renderTimestampRasters() consulta backend per raster temporale e lo renderizza.

---

## 🔔 Toasts - Sistema Notifiche

**File**: `public/js/toasts.js`  
**Partial**: Non ha (generato programmaticamente)  
**CSS**: `public/css/toasts.css`

### Responsabilità

- Notifiche temporanee bottom-center
- Spinner per operazioni in corso
- Icona ✓ per successo
- Chiusura automatica

### Struttura HTML

```html
<!-- Toast stack container (bottom-center) -->
<div id=\"toastStack\" aria-live=\"polite\" aria-atomic=\"true\"></div>

<!-- Un toast item -->
<div class=\"toast-item show\">
    <div class=\"toast-icon\">
        <span class=\"spinner-border\"></span>
        <span class=\"ok material-symbols-outlined\">check_circle</span>
    </div>
    <div class=\"toast-msg\">Operazione in corso…</div>
</div>
```

### API Pubblica

```javascript
Toasts.show(message)
// Mostra toast con spinner
// Ritorna handle (elemento DOM)

Toasts.ok(handle, finalMessage, holdMs)
// Mostra successo, auto-close dopo holdMs (default 2000)

Toasts.error(handle, finalMessage)
// Mostra errore, auto-close dopo 600ms

Toasts.close(handle, afterMs)
// Chiudi toast manualmente dopo afterMs milliseconds

Toasts.escapeHtml(string)
// XSS-safe HTML escaping
```

### Pattern di Utilizzo

```javascript
// Utente clicca bottone
const t = Toasts.show('Uploading file...');

fetch('/upload', { /* ... */ })
    .then(r => r.json())
    .then(data => {
        Toasts.ok(t, 'File uploaded successfully!');
        // Chiuso automaticamente dopo 2s
    })
    .catch(err => {
        Toasts.error(t, 'Upload failed: ' + err.message);
        // Chiuso automaticamente dopo 600ms
    });
```

### CSS Classes

```css
.toast-item {
    /* Toast singolo */
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(18,18,20,0.95);
    border: 1px solid rgba(110,231,183,0.3);
    border-radius: 8px;
    backdrop-filter: blur(8px);
}

.toast-item.show {
    /* Animazione entrata */
    animation: slideUp 0.3s ease;
}

.toast-item.hide {
    /* Animazione uscita */
    animation: slideDown 0.3s ease;
}

.toast-item.ok .spinner-border {
    display: none;  /* Nascondi spinner */
}

.toast-item.ok .ok {
    display: inline;  /* Mostra check icon */
    color: #6ee7b7;
}
```

### Lifecycle Toast

```
Toasts.show(msg)
      │
      ├─ Crea div.toast-item
      ├─ Appende a #toastStack
      ├─ requestAnimationFrame → addClass('show')
      │  (trigger CSS animation entrada)
      │
      └─ Return handle
             │
             ├─ Se Toasts.ok(handle, msg) chiamato:
             │  ├─ addClass('ok')
             │  ├─ Update innerHTML
             │  ├─ setTimeout(2000) → close
             │
             └─ Else se Toasts.error(handle, msg):
                  ├─ Update innerHTML
                  ├─ setTimeout(600) → close
                  │
                  Toasts.close(handle)
                  ├─ addClass('hide')
                  ├─ onTransitionEnd → handle.remove()
```

### Stack Position

Toasts appaiono in stack bottom-center:

```css
#toastStack {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;  /* Non interfersice click */
}

.toast-item {
    pointer-events: auto;  /* Ma toast stesso è clickable */
}
```

---

## 📥 LayerRegisterModal - Registrazione Layer

**File**: `public/js/layer-panel.js` (inline)  
**Partial**: `public/partials/layer-register.html` (embed in layer-panel.html)  
**CSS**: `public/css/layer-register.css`

### Responsabilità

- Modal per registrare layer nel progetto
- Form: Source (read-only), Titolo, Descrizione
- Validazione input
- Toggle visibilità modal

### Struttura HTML

```html
<div id=\"layerRegModal\" class=\"modal-overlay hidden\">
    <div class=\"modal-content\">
        <div class=\"modal-header\">
            <h5>Register Layer</h5>
        </div>
        
        <div class=\"modal-body\">
            <div class=\"mb-2\">
                <label>Source URL (read-only)</label>
                <input id=\"lrSrc\" readonly class=\"form-control\">
            </div>
            
            <div class=\"mb-2\">
                <label>Title *</label>
                <input id=\"lrTitle\" placeholder=\"My Layer\" class=\"form-control\">
                <small class=\"text-secondary\">Required</small>
            </div>
            
            <div class=\"mb-2\">
                <label>Description</label>
                <textarea id=\"lrDesc\" placeholder=\"Optional description...\" 
                    class=\"form-control\" rows=\"4\"></textarea>
            </div>
            
            <div id=\"lrError\" class=\"text-danger small d-none\"></div>
        </div>
        
        <div class=\"modal-footer\">
            <button id=\"lrCancel\" class=\"btn btn-secondary\">Cancel</button>
            <button id=\"lrConfirm\" class=\"btn btn-success\">Register</button>
        </div>
    </div>
</div>
```

### API Pubblica

```javascript
LayerPanel.openRegModal(payload)
// Apri modal con dati layer
// payload: { src, type: 'vector'|'raster', ... }

LayerPanel.closeRegModal()
// Chiudi modal e scarta
```

### Flusso Registrazione

```
User seleziona \"Register in project\" checkbox
      │
      ├─ Clicca \"Add Layer\" button
      │
      ├─ LayerPanel.openRegModal(base_layer_data)
      │
      ├─ Modal appare con form
      │
      ├─ User riempie campi
      │
      │ (opzionale: textarea auto-expand su input)
      │
      ├─ Clicca \"Register\" button
      │
      ├─ Validazione: Title deve essere non-vuoto
      │
      ├─ Se valido:
      │  ├─ dispatch('layer:add-geojson' | 'layer:add-cog')
      │  │     con { title, description, src, type, register: true }
      │  │
      │  ├─ GeoMap.addVectorLayer/addCOG() processa
      │  │     e chiama POST /t/{id}/render → backend lo registra
      │  │
      │  ├─ LayerPanel.closeRegModal()
      │  │
      │  └─ dispatch('layer:reload-project-layers')
      │
      └─ Se invalido:
           ├─ Mostra messaggio errore
           └─ Modal rimane aperto
```

---

## 🎙️ ChatSettings - Impostazioni Chat

**File**: `public/js/ai-chat-settings.js`  
**Partial**: `public/partials/ai-chat-settings.html`  
**CSS**: `public/css/ai-chat-settings.css`

### Responsabilità

- Panel impostazioni per chat AI
- Opzioni: temperatura, top-p, max-tokens, system prompt
- Toggle panel visibilità

### Struttura HTML

```html
<div id=\"aiChatSettingsPanel\" class=\"chat-settings-panel closed\">
    <div class=\"settings-header\">
        <h6>AI Settings</h6>
        <button id=\"aiChatSettingsCloseBtn\">✕</button>
    </div>
    
    <div class=\"settings-body\">
        <div class=\"setting-group\">
            <label>Temperature (creativity)</label>
            <input id=\"tempInput\" type=\"range\" min=\"0\" max=\"2\" step=\"0.1\" value=\"0.7\">
            <span id=\"tempValue\">0.7</span>
        </div>
        
        <div class=\"setting-group\">
            <label>Top-P (diversity)</label>
            <input id=\"topPInput\" type=\"range\" min=\"0\" max=\"1\" step=\"0.05\" value=\"0.9\">
            <span id=\"topPValue\">0.9</span>
        </div>
        
        <div class=\"setting-group\">
            <label>Max Tokens</label>
            <input id=\"maxTokensInput\" type=\"number\" value=\"2000\" min=\"100\" max=\"10000\">
        </div>
        
        <div class=\"setting-group\">
            <label>System Prompt</label>
            <textarea id=\"systemPromptInput\" rows=\"4\" placeholder=\"Custom system instructions...\"></textarea>
        </div>
        
        <button id=\"aiChatSettingsSubmit\" class=\"btn btn-success w-100\">Save</button>
    </div>
</div>
```

### API Pubblica

```javascript
ChatSettings.init()
// Inizializza panel

ChatSettings.togglePanel()
// Apri/chiudi settings panel

ChatSettings.getSettings()
// Ritorna oggetto: { temperature, topP, maxTokens, systemPrompt }
```

### Integrazione

Settings vengono inviate al backend nell'header o body di richieste verso AI Agent:

```javascript
fetch(Routes.Agent.THREAD(thread_id), {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // opzionali:
        'X-Temperature': String(ChatSettings.getSettings().temperature),
        // ...
    },
    body: JSON.stringify({
        prompt: message,
        settings: ChatSettings.getSettings()
    })
});
```

---

## 🔗 Dipendenze tra Componenti Support

```
GeoMap (base)
   │
   ├─ DrawTools (dipende da GeoMap.map)
   │
   └─ TimeSlider (indipendente, comunica via event a GeoMap)

AIChat
   │
   └─ ChatSettings (sub-panel)

LayerPanel
   │
   └─ LayerRegisterModal (sub-modal)

Toasts (globale, usato da ovunque)
```

---

**Prossimo Step**: Vedi `04_COMUNICAZIONE_EVENTI.md` per dettagli sulla comunicazione via CustomEvent.
