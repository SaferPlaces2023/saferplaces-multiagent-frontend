# 02 - Componenti Core

I componenti core sono i pilastri dell'applicazione: GeoMap, AIChat, LayerPanel, UserPanel e AuthGate.

---

## 🗺️ GeoMap - Gestione della Mappa

**File**: `public/js/geo-map.js`  
**Partial**: `public/partials/geo-map.html`  
**CSS**: `public/css/geo-map.css`

### Responsabilità

- Istanziare e gestire la mappa MapLibre GL
- Gestione layer (vector GeoJSON, raster COG)
- Controlli mappa (zoom, pan, reset view)
- Stili mappa (selezione stile da dropdown)
- Edifici 3D da OpenFreeMap
- Coordinate e viewport utilities

### Struttura HTML

```html
<!-- MapContainer principale -->
<div id=\"map\" aria-label=\"MapLibre map\"></div>

<!-- Topbar con controlli -->
<div class=\"topbar\">
    <!-- Style selector -->
    <div class=\"style-bar\">
        <select id=\"styleSelect\">
            <!-- Opzioni stile: CARTO, MapTiler, Stadia, etc. -->
        </select>
        <button id=\"resetView\">Reset view</button>
    </div>
    
    <!-- Draw toolbar (vedi DrawTools) -->
    <div class=\"draw-toolbar\">
        <!-- bottoni disegno -->
    </div>
</div>
```

### API Pubblica

```javascript
GeoMap.init()
// Inizializza la mappa e registra handler

GeoMap.addVectorLayer(layer_data)
// Aggiunge layer GeoJSON alla mappa
// layer_data: { src: string, title?: string, type: 'vector', ... }

GeoMap.addCOG(layer_data)
// Aggiunge layer COG raster
// layer_data: { src: string, type: 'raster', metadata: { colormap } }

GeoMap.toggleRemoteLayer(layer)
// Abilita/disabilita visibilità layer

GeoMap.toggleLayerMapVisibility(detail)
// Cambia visibilità layer specifico

GeoMap.setStyle(styleUrl)
// Cambia stile mappa

GeoMap.resetView()
// Ritorna a rome (center: [12.4964, 41.9028], zoom: 3)

GeoMap.renderTimestampRasters(iso)
// Renderizza raster temporali (vedi TimeSlider integration)

GeoMap.zoomToBounds(bbox, padding, duration)
// Zoom animato a bounding box
```

### Flusso Aggiunta Layer

```
User clicca \"Add vector/raster\" (LayerPanel)
            │
        dispatch('layer:add-geojson' | 'layer:add-cog')
            │
        GeoMap listener cattura evento
            │
        Fetch renderUrl da backend: POST /t/{id}/render
            │
        Backend processa layer, ritorna src renderizzato
            │
        Fetch GeoJSON/COG da src
            │
        map.addSource() + map.addLayer()
            │
        Toasts.show(\"Layer added\")
            │
        UI mostra layer in LayerPanel
```

### Registrazione Layer

GeoMap mantiene un registry interno:

```javascript
const reg = {};  // id -> { meta, src, type, ... }
const customLayerIds = new Set();

// Quando aggiungi layer:
const id = btoa(layer_data.layer_data.src);  // base64 encode src
reg[id] = { ...metadata };
map.addSource(id, { type: 'geojson', data });
map.addLayer({ id: id + '-fill', source: id, ... });
map.addLayer({ id: id + '-line', source: id, ... });
```

### 3D Buildings

MapLibre supporta visualizzazione 3D. Attualmente AbilitAto al load della mappa:

```javascript
map.on('style.load', () => {
    map.setProjection({ type: 'globe' });
    map.setSky({...});           // Sky rendering
    add_3d_buildings();          // Aggiungi edifici
});
```

Gli edifici vengono da OpenFreeMap (public datasource).

### Stili Disponibili

| Stile | Fornitore | Descrizione |
|-------|-----------|------------|
| MapLibre Basic | MapLibre | Stile base open-source |
| Carto Positron | CARTO | Light, minimal |
| Carto Dark Matter | CARTO | Dark, satellite-friendly |
| Carto Voyager | CARTO | Dettagliato, con contorni |
| MapTiler Satellite | MapTiler | Immagini satellitari |
| Stadia Alidade Smooth | Stadia Maps | Smooth, modern |
| Stadia Satellite | Stadia Maps | Satellite imagery |

---

## 💬 AIChat - Chat con AI Agent

**File**: `public/js/ai-chat.js`  
**Partial**: `public/partials/ai-chat.html`  
**CSS**: `public/css/ai-chat.css`

### Responsabilità

- Interfaccia chat UI
- Invio messaggi all'AI Agent (backend)
- Ricezione e rendering risposte
- Tool calls visualization
- Markdown rendering (Marked library)
- Comandi locali (con `/`)
- Gestione spinner \"in calcolo\"

### Struttura HTML

```html
<section class=\"chatbox\" id=\"chatBox\">
    <!-- Header con titolo e bottoni -->
    <div class=\"chat-header\">
        <span class=\"badge\">AI</span>
        <span>Saferplaces Agent</span>
        <button id=\"chatSettingsBtn\">Settings</button>
        <button id=\"clearChat\">Clean</button>
        <button id=\"minChat\">Minimize</button>
    </div>
    
    <!-- Body: messaggi -->
    <div class=\"chat-body\" id=\"chatBody\">
        <!-- Messaggi: <div class=\"bubble ai\"> o <div class=\"bubble user\"> -->
    </div>
    
    <!-- Input area -->
    <div class=\"chat-input\">
        <input id=\"chatInput\" placeholder=\"Write a message...\">
        <button id=\"sendMsg\">Send</button>
    </div>
</section>
```

### API Pubblica

```javascript
AIChat.init()
// Inizializza chat UI e wiring

AIChat.invokeSend(message)
// Programmaticamente invia messaggio (dalla chat settings)

AIChat.send()
// Interno: Invia messaggio da input

// Messaggi vengono renderizzati come \"bubble\" nel DOM
// Supporto per:
// - Testo plain
// - Markdown (h1-h6, bold, italic, codice, link)
// - Tool calls (visualizzati in <details>)
// - Tool responses (JSON visualizzato)
```

### Flusso Messaggio

```
User scrive messaggio + Enter
            │
        send()
            │
        appendBubble(msg, 'user')  ← Visualizza in chat
            │
        showTyping()                ← Spinner \"AI sta scrivendo...\"
            │
        if (msg.startsWith('/'))
            │ local command handler
            │
            ├─ /dark → dispatch('map:set-style', ...)
            ├─ /light → dispatch('map:set-style', ...)
            ├─ /reset → dispatch('map:reset', ...)
            ├─ /help → mostra lista comandi
            └─ resto → \"command not recognized\"
            │
        else
            │
            ├─ Fetch POST to Routes.Agent.THREAD(thread_id)
            │
            ├─ { prompt: msg }
            │
            ├─ Backend elabora (AI Agent, tool calls, etc.)
            │
            ├─ Response: array di messages/tool_calls
            │
            ├─ hideTyping()
            │
            ├─ Per ogni response:
            │  ├─ Se tool_call → appendToolCall()
            │  ├─ Se tool_response → appendToolResponse()
            │  └─ Altrimenti → appendBubble(content, role)
            │
            └─ dispatch('layer:reload-project-layers', {})
              ↑ Ricarica layer se backend li ha modificati
```

### Comandi Locali

Messaggi che iniziano con `/` sono elaborati localmente:

```
/help       → Lista comandi disponibili
/dark       → Attiva stile mappa Dark Matter
/light      → Attiva stile mappa Positron (light)
/reset      → Reset view a Roma
/clear      → Pulisci chat e crea nuovo thread
```

### Tool Calls Visualization

Il backend può ritornare \"tool calls\" (azioni che l'AI vuole eseguire):

```json
{
  \"role\": \"assistant\",
  \"tool_calls\": [
    {
      \"id\": \"call_123\",
      \"name\": \"add_layer\",
      \"args\": { \"url\": \"...\", \"type\": \"vector\" }
    }
  ]
}
```

Visualizzati come `<details>` expandibili:

```html
<div class=\"bubble ai\">
    <details class=\"tool-item\">
        <summary>
            <div class=\"tool-head\">
                <span>tool call:</span>
                <code>add_layer</code>
            </div>
            <div class=\"tool-id\">ID: call_123</div>
        </summary>
        <pre class=\"tool-args\">{JSON args...}</pre>
    </details>
</div>
```

### Integrazione Markdown

Marked library renderizza markdown nei messaggi:

```javascript
marked.setOptions({ breaks: true, mangle: false, headerIds: false });

// Nel response:
{
  \"role\": \"assistant\",
  \"content\": \"## Titolo\\n\\nTesto **bold** e `code`\"
}

// Viene renderizzato come HTML mediante:
bubble.innerHTML = marked.parse(content);
```

---

## 📋 LayerPanel - Gestione Layer

**File**: `public/js/layer-panel.js`  
**Partial**: `public/partials/layer-panel.html`  
**CSS**: `public/css/layer-panel.css`

### Responsabilità

- Sidebar sinistra con lista layer
- Carico manuale layer (vector GeoJSON, raster COG)
- Registrazione layer nel progetto
- Ricarica layer da backend
- Toggle visibilità layer
- Modalità edit/delete (vedi DrawTools per dettagli)
- Modal registrazione layer

### Struttura HTML

```html
<aside class=\"sidebar closed\" id=\"sidebar\">
    <!-- Bottone toggle -->
    <button id=\"toggleBtn\">☰</button>
    
    <!-- Sezione layer del progetto -->
    <div class=\"card\">
        <strong>Registered layers</strong>
        <button id=\"reloadLayers\">↻</button>
        <div id=\"projectLayersList\">
            <!-- Lista layer da backend -->
        </div>
    </div>
    
    <!-- Sezione aggiunta vector -->
    <div class=\"card\">
        <input id=\"geojsonUrl\" placeholder=\"https://.../data.geojson\">
        <button id=\"btnGeojson\">Add</button>
        <input type=\"checkbox\" id=\"regSwitchVector\">
        <label>Register in project</label>
    </div>
    
    <!-- Sezione aggiunta raster -->
    <div class=\"card\">
        <input id=\"cogUrl\" placeholder=\"https://.../raster.tif\">
        <select id=\"cmap\">
            <option>viridis</option>
            <option>inferno</option>
            <!-- colormaps -->
        </select>
        <button id=\"btnCog\">Add</button>
        <input type=\"checkbox\" id=\"regSwitchRaster\">
    </div>
</aside>

<!-- Modal registrazione layer -->
<div id=\"layerRegModal\" class=\"hidden\">
    <input id=\"lrSrc\" readonly>
    <input id=\"lrTitle\" placeholder=\"Layer title\">
    <textarea id=\"lrDesc\" placeholder=\"Description\"></textarea>
    <button id=\"lrCancel\">Cancel</button>
    <button id=\"lrConfirm\">Register</button>
</div>
```

### API Pubblica

```javascript
LayerPanel.init()
// Inizializza sidebar e wiring

LayerPanel.sidebarOpen()
// Apri sidebar

LayerPanel.sidebarClose()
// Chiudi sidebar

LayerPanel.reloadProjectLayers()
// Ricarica layer da backend

LayerPanel.openRegModal(payload)
// Apri modal registrazione (internamente usato)

LayerPanel.closeRegModal()
// Chiudi modal (internamente usato)
```

### Flusso Aggiunta Layer

```
┌─ MANUALE (Senza Registrazione) ─┐
│                                  │
│ User clicca \"Add Layer\"          │
│      │                           │
│      ├─ Inserisce URL            │
│      │                           │
│      ├─ Clicca \"Add\"             │
│      │                           │
│      ├─ dispatch('layer:add-geojson')
│      │                           │
│      └─ GeoMap lo processa       │
└─────────────────────────────────┘

┌─ CON REGISTRAZIONE (Backend) ──┐
│                                  │
│ User checkec \"Register in proj\" │
│      │                           │
│      ├─ Clicca \"Add\"             │
│      │                           │
│      ├─ openRegModal()           │
│      │                           │
│      ├─ User riempie Title/Desc │
│      │                           │
│      ├─ Clicca \"Register\"        │
│      │                           │
│      ├─ dispatch('layer:add-geojson/cog')
│      │                           │
│      ├─ GeoMap.addVectorLayer()  │
│      │       │                   │
│      │       ├─ POST /render     │
│      │       │       │           │
│      │       │   Backend saves   │
│      │       │       │           │
│      │       └─ Aggiunge layer   │
│      │                           │
│      └─ dispatch('layer:reload-project-layers')
│             │                    │
│             └─ Backend lista aggiornata
└──────────────────────────────────┘
```

### Registro Layer

LayerPanel mantiene badge con conteggio:

```javascript
let count = 0;  // Total layer count
const badge = document.getElementById('layerCount');

// Quando layer caricato:
badge.textContent = String(layers.length);
```

Ogni layer renderizzato come item con menu:

```html
<div class=\"layer-item\">
    <strong>Layer Title</strong>
    <button data-action=\"toggle\">👁️</button>
    <button data-action=\"download\">⬇️</button>
    <button data-action=\"delete\">🗑️</button>
</div>
```

---

## 👤 UserPanel - Gestione Utente

**File**: `public/js/user-panel.js`  
**Partial**: `public/partials/user-panel.html`  
**CSS**: `public/css/user-panel.css`

### Responsabilità

- Sidebar con info utente
- Logout
- Lista progetti (altri account)
- Creazione nuovo progetto
- Switch tra progetti

### Struttura HTML

```html
<button class=\"btn btn-primary\" id=\"toggleUserBtn\">👤</button>

<aside class=\"user-sidebar closed\" id=\"userSidebar\">
    <!-- Info utente -->
    <div class=\"card\">
        <div>user_id: <span id=\"infoUserId\">—</span></div>
        <div>project_id: <span id=\"infoProjectId\">—</span></div>
        <div>thread_id: <code id=\"infoThreadId\">—</code></div>
    </div>
    
    <!-- Logout -->
    <button id=\"logoutBtn\">Exit</button>
    
    <!-- Nuovo progetto -->
    <div class=\"card\">
        <strong>New project</strong>
        <button id=\"newProjBtn\">+ Create</button>
        <div id=\"newProjForm\" class=\"d-none\">
            <input id=\"newProjName\" placeholder=\"es. dev-023\">
            <button id=\"newProjCreateBtn\">Create</button>
        </div>
    </div>
    
    <!-- Lista progetti (altri account) -->
    <div id=\"userProjects\">
        <!-- Progetti da backend -->
    </div>
</aside>
```

### API Pubblica

```javascript
UserPanel.init()
// Inizializza sidebar

UserPanel.fillInfo()
// Aggiorna testo user/project/thread info

UserPanel.loadProjects()
// Ricarica lista progetti da backend

UserPanel.renderProjects(projects)
// Renderizza lista progetti UI
```

### Flusso Logout

```
User clicca \"Exit\"
      │
      ├─ localStorage.removeItem('user_id')
      ├─ localStorage.removeItem('project_id')
      ├─ localStorage.removeItem('thread_id')
      │
      └─ location.reload()
             │
             └─ AuthGate ritorno (gate visibile)
```

### Flusso Switch Progetto

```
User clicca su progetto da UserPanel.userProjects
      │
      ├─ AuthGate.loadUserProject(user, project)
      │
      ├─ POST /t (crea/resume thread)
      │
      ├─ localStorage update
      │
      ├─ UserPanel.fillInfo()
      │
      └─ dispatch('layer:reload-project-layers')
             │
             └─ LayerPanel ricarica layer del nuovo progetto
```

### Storage Locale

```javascript
const LS_THREAD = 'thread_id';
const LS_USER = 'user_id';
const LS_PROJ = 'project_id';

// Utilizzati in ogni componente per ricavare credenziali:
const user_id = localStorage.getItem(LS_USER);
const project_id = localStorage.getItem(LS_PROJ);
const thread_id = localStorage.getItem(LS_THREAD);
```

---

## 🔐 AuthGate - Autenticazione

**File**: `public/js/auth-gate.js`  
**Partial**: `public/partials/auth-gate.html`  
**CSS**: `public/css/auth-gate.css`

### Responsabilità

- Overlay autenticazione
- Verifica user_id con backend
- Selezione/creazione progetto
- Setup initial session (thread_id)
- Show/hide app overlay

### Struttura HTML

```html
<!-- Overlay e card autenticazione -->
<section id=\"authGate\" class=\"auth-gate hidden\">
    <div class=\"auth-card\">
        <!-- Step 1: User ID -->
        <div id=\"authStepUser\">
            <h6>Welcome 👋</h6>
            <input id=\"authUserId\" placeholder=\"es. tommaso.r\">
            <button id=\"authSubmit\">Continue</button>
        </div>
        
        <!-- Step 2: Progetto (stessa card, appare dopo step 1) -->
        <div id=\"authProjectArea\" class=\"d-none\">
            <div id=\"authUserBadge\">User: ...</div>
            
            <!-- Mode: Select vs Create -->
            <div id=\"authModeWrap\" class=\"form-check form-switch\">
                <input id=\"authModeSwitch\" type=\"checkbox\">
                <label>New Project</label>
            </div>
            
            <!-- Select existing project -->
            <fieldset id=\"authSectionSelect\">
                <label>Select project</label>
                <select id=\"authProjectSelect\"></select>
            </fieldset>
            
            <!-- Create new project -->
            <fieldset id=\"authSectionCreate\" disabled>
                <label>Create new project</label>
                <input id=\"authProjectName\" placeholder=\"es. dev-023\">
            </fieldset>
            
            <button id=\"authProceed\">Enter</button>
        </div>
    </div>
</section>

<!-- App overlay (blur durante auth) -->
<div id=\"appRoot\" class=\"blurred\">
    <!-- contenuto app normale -->
</div>
```

### API Pubblica

```javascript
AuthGate.init()
// Verifica localStorage, mostra gate se necessario

AuthGate.verifyUser()
// Verifica user_id con backend, mostra progetti

AuthGate.loadUserProject(user, project)
// Carica thread per progetto specifico

AuthGate.proceed()
// Finalizza login e nasconde gate
```

### Flusso Autenticazione Completo

```
┌─ PRIMA VOLTA (localStorage vuoto) ─┐
│                                     │
│ 1. AuthGate.init()                 │
│        │                            │
│        ├─ localStorage.getItem()    │
│        │        │                   │
│        │        └─ null (non trovato)
│        │                            │
│        ├─ showGate()                │
│        │                            │
│        └─ appRoot.blurred           │
│                                     │
│ 2. User inserisce user_id          │
│        │                            │
│        ├─ verifyUser()              │
│        │        │                   │
│        │        ├─ POST /user       │
│        │        │        │          │
│        │        │   [backend]       │
│        │        │        │          │
│        │        └─ { user_id, projects: [...] }
│        │                            │
│        ├─ localStorage.setItem('user_id')
│        │                            │
│        └─ buildProjectsUI(projects)│
│               │ (se projects vuoto)│
│               └─ setMode('create') │
│                                     │
│ 3. User seleziona/crea progetto   │
│        │                            │
│        ├─ proceed()                 │
│        │        │                   │
│        │        ├─ POST /t          │
│        │        │  body: {user_id, project_id}
│        │        │        │          │
│        │        │   [backend]       │
│        │        │        │          │
│        │        └─ { thread_id, ... }
│        │                            │
│        ├─ localStorage.setItem('thread_id', 'project_id')
│        │                            │
│        ├─ finalize()                │
│        │        │                   │
│        │        ├─ hideGate()       │
│        │        │                   │
│        │        └─ appRoot.unblurred│
│        │                            │
│        └─ dispatch('auth:ready')    │
│               │                     │
│               └─ LayerPanel, AIChat sanno autenticarsi
│                                     │
│ ✅ App è interattivo                │
└─────────────────────────────────────┘

┌─ RITORNO (localStorage pieno) ─────┐
│                                     │
│ 1. AuthGate.init()                 │
│        │                            │
│        ├─ localStorage.getItem()    │
│        │        │                   │
│        │        ├─ user_id         │
│        │        ├─ project_id      │
│        │        └─ thread_id       │
│        │                            │
│        ├─ POST /t (resume/verify)  │
│        │        │                   │
│        │   [backend validates]      │
│        │        │                   │
│        ├─ hideGate()                │
│        │                            │
│        └─ dispatch('auth:ready')    │
│                                     │
│ ✅ App subito interattivo           │
└─────────────────────────────────────┘
```

### Error Handling

Se backend ritorna errore:

```javascript
try {
    const res = await fetch(Routes.Agent.USER, {
        method: 'POST',
        body: JSON.stringify({ user_id })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // ...
} catch (e) {
    flash(errorUser, 'Check failed. Check user_id.');
}
```

The `flash()` funzione mostra errore temporaneo (2.5s):

```javascript
function flash(el, msg) {
    el.textContent = msg;
    el.classList.remove('d-none');
    setTimeout(() => el.classList.add('d-none'), 2500);
}
```

---

## 🔗 Inter-Component Communication

I 5 componenti core comunicano principalmente attraverso **CustomEvent**:

| Evento | Dispatcher | Listener | Payload |
|--------|-----------|----------|---------|
| `auth:ready` | AuthGate | LayerPanel, AIChat | - |
| `layer:add-geojson` | LayerPanel | GeoMap | `{ layer_data: {...} }` |
| `layer:add-cog` | LayerPanel | GeoMap | `{ layer_data: {...} }` |
| `layer:reload-project-layers` | AIChat, UserPanel | LayerPanel | - |
| `map:set-style` | AIChat | GeoMap | `{ styleUrl: string }` |
| `map:reset` | AIChat | GeoMap | - |

---

## 📊 Comparison Componenti Core

| Componente | Tipo | Posizione | Lifecycle |
|-----------|------|-----------|----------|
| **GeoMap** | Engine | Full screen behind | Inzializza mappa MapLibre |
| **AIChat** | UI Box | Bottom-right | Riceve messaggi sempre |
| **LayerPanel** | Sidebar | Left (toggleable) | Carica layer su auth:ready |
| **UserPanel** | Sidebar | Left (exclusive) | Mostra info, gestisce logout |
| **AuthGate** | Overlay | Center (modal) | Mostrato se non autenticato, nascondi a fine |

---

**Prossimo Step**: Vedi `03_COMPONENTI_SUPPORT.md` per DrawTools, TimeSlider, Toasts.
