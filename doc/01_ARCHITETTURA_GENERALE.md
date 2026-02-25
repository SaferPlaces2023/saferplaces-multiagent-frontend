# 01 - Architettura Generale

## 📐 Architettura di Alto Livello

La webapp SaferPlaces segue un'architettura **modular event-driven** basata su:

1. **Moduli isolati** (IIFE pattern)
2. **Comunicazione tramite CustomEvent**
3. **Stato distribuito** (localStorage + in-memory)
4. **REST API integration** con backend Flask

```
┌─────────────────────────────────────────────────────────┐
│                    INDEX.HTML (entry point)             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           LAYER DI COMPONENTI UI                 │  │
│  │                                                  │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │  AuthGate (Overlay di autenticazione)   │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  │                                                  │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │  GeoMap (Mappa MapLibre + toolbar)      │  │  │
│  │  │  ├─ Map container                       │  │  │
│  │  │  ├─ Draw tools toolbar                  │  │  │
│  │  │  ├─ Style selector (topbar)            │  │  │
│  │  │  └─ Reset view button                   │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │  LayerPanel      │  │  UserPanel       │   │  │
│  │  │  (Sidebar SX)    │  │  (Sidebar SX)    │   │  │
│  │  │  ├─ Project      │  │  ├─ User info    │   │  │
│  │  │  │  layers       │  │  │               │   │  │
│  │  │  ├─ Add vector   │  │  ├─ Projects     │   │  │
│  │  │  ├─ Add raster   │  │  └─ New project  │   │  │
│  │  │  └─ Register     │  └──────────────────┘   │  │
│  │  │    modal         │                          │  │
│  │  └──────────────────┘                          │  │
│  │                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │  AIChat          │  │  TimeSlider      │   │  │
│  │  │  (Box DX BASSO)  │  │  (Bottom float)  │   │  │
│  │  │  ├─ Chat body    │  │  ├─ Track       │   │  │
│  │  │  ├─ Input        │  │  ├─ Play/Pause  │   │  │
│  │  │  ├─ Send button  │  │  ├─ Speed       │   │  │
│  │  │  └─ Settings     │  │  └─ Highlights  │   │  │
│  │  └──────────────────┘  └──────────────────┘   │  │
│  │                                                  │  │
│  │  ┌──────────────────┐                          │  │
│  │  │  Toasts          │ (notifiche bottom)       │  │
│  │  └──────────────────┘                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │        LAYER DI COMUNICAZIONE (CustomEvent)     │  │
│  │                                                  │  │
│  │  layer:add-geojson                             │  │
│  │  layer:add-cog                                 │  │
│  │  layer:toggle-remote                           │  │
│  │  map:toggle-layer-visibility                   │  │
│  │  map:set-style                                 │  │
│  │  map:reset                                     │  │
│  │  timeslider:change                             │  │
│  │  auth:ready                                    │  │
│  │  chat:command                                  │  │
│  │  draw-tool:* (draw tools events)               │  │
│  │  ... (vedi 04_COMUNICAZIONE_EVENTI.md)        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │    LAYER DI PERSISTENZA E STATO                 │  │
│  │                                                  │  │
│  │  localStorage:                                 │  │
│  │  ├─ user_id                                   │  │
│  │  ├─ project_id                                │  │
│  │  └─ thread_id                                 │  │
│  │                                                  │  │
│  │  In-memory (moduli):                          │  │
│  │  ├─ GeoMap.reg (layer registry)              │  │
│  │  ├─ AIChat (message buffer)                  │  │
│  │  ├─ DrawTools.DrawFeatureCollections         │  │
│  │  └─ TimeSlider (intervals, state)            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │       LAYER DI INTEGRAZIONE BACKEND             │  │
│  │                                                  │  │
│  │  REST API (Routes.Agent.*):                    │  │
│  │  ├─ POST /user (verifica utente)             │  │
│  │  ├─ POST /t (crea/recupera thread)           │  │
│  │  ├─ POST /t/{id}/state (stato thread)        │  │
│  │  ├─ POST /t/{id}/layers (lista layer)        │  │
│  │  ├─ POST /t/{id}/render (renderizza layer)   │  │
│  │  └─ GET /get-layer-url (URL firmato)         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           VENDOR LIBRARIES (CDN/Local)          │  │
│  │                                                  │  │
│  │  CSS:                                          │  │
│  │  ├─ Bootstrap 5.3.3                           │  │
│  │  ├─ MapLibre GL                               │  │
│  │  ├─ Material Symbols (Google)                 │  │
│  │                                                  │  │
│  │  JS:                                           │  │
│  │  ├─ Bootstrap 5.3.3 (JS bundle)               │  │
│  │  ├─ MapLibre GL                               │  │
│  │  ├─ MapLibre COG Protocol                     │  │
│  │  ├─ Shpjs (shapefile parser)                 │  │
│  │  └─ Marked (markdown renderer)                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Flusso Generale dell'Applicazione

### Fase 1: Caricamento e Inizializzazione

```javascript
// public/js/app.js - main entry point
(async function includeAndInit() {
    // Step 1: Carica tutti i partial HTML ricorsivamente
    await loadIncludes();
    
    // Step 2: Inizializza componenti core
    GeoMap.init();         // Crea mappa e registra handler
    UserPanel.init();      // Wiring UI pannello utente
    LayerPanel.init();     // Wiring UI pannello layer
    
    // Step 3: Avvia gate autenticazione
    AuthGate.init();       // Controlla se user già autenticato
    AIChat.init();         // Wiring chat UI
    TimeSlider.init();     // Inizializza slider temporale
    
    // Step 4: Wiring di comunicazione tra componenti
    document.addEventListener('layer:add-geojson', e => 
        GeoMap.addVectorLayer(e.detail)
    );
    // ... altri event listener
})();
```

### Fase 2: Autenticazione

```
User Input (user_id) → AuthGate.verifyUser()
            ↓
    Backend: POST /user
            ↓
    List projects from user account
            ↓
    User selects/creates project
            ↓
    Backend: POST /t (create/resume thread)
            ↓
    Store in localStorage (user_id, project_id, thread_id)
            ↓
    AuthGate.hideGate()
            ↓
    App fully visible
            ↓
    LayerPanel.reloadProjectLayers()
            ↓
    dispatch('auth:ready')
```

### Fase 3: Operazioni Utente

```
User Action → Component event handler → 
    ↓
Dispatch CustomEvent (se comunica con altro) →
    ↓
Listener Component (riceve evento) →
    ↓
Elaborazione (possibile REST call) →
    ↓
Update UI/State →
    ↓
Toast notification (feedback utente)
```

---

## 🎯 Pattern Architetturale

### 1. Module Pattern (IIFE)

Ogni componente è un modulo isolato:

```javascript
const ComponentName = (() => {
    // Private state
    let privateVar = 'only inside';
    
    // Private methods
    function privateMethod() { }
    
    // Public API (returned object)
    function init() { }
    function publicMethod() { }
    
    return {
        init,
        publicMethod,
        // only public methods are exposed
    };
})();

// Usage:
ComponentName.init(); // ✓ accessible
ComponentName.publicMethod(); // ✓ accessible
ComponentName.privateMethod(); // ✗ reference error
```

### 2. Event-Driven Communication

Componenti comunicano solo via DOM events:

```javascript
// Publisher
dispatch('event:name', { data: 'payload' });

// Subscriber
document.addEventListener('event:name', e => {
    const { data } = e.detail;
    // React to event
});
```

**Vantaggi:**
- Zero-coupling tra componenti
- Facile da testare
- Facile da aggiungere nuovi listener
- Decoupling naturale

### 3. Lazy Loading di Partials

HTML strutturato viene caricato dinamicamente:

```html
<!-- In index.html -->
<div data-include="public/partials/geo-map.html"></div>

<!-- In app.js -->
async function loadIncludes(root = document) {
    const hosts = root.querySelectorAll('[data-include]');
    await Promise.all(Array.from(hosts).map(async host => {
        const url = host.getAttribute('data-include');
        const html = await fetch(url).then(r => r.text());
        host.innerHTML = html;
        // Recursive: check for nested includes
        await loadIncludes(host);
    }));
}
```

**Vantaggi:**
- Separazione UI in file logici
- Facile manutenzione
- Supporta include nidificati

### 4. State Management

**Distribuito** per semplicità:

```
┌─────────────────────────────┐
│  localStorage (persistent)  │
│  ├─ user_id                │
│  ├─ project_id             │
│  └─ thread_id              │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  Component Local State      │
│  ├─ GeoMap.map (MapLibre)  │
│  ├─ GeoMap.reg (layers)    │
│  ├─ AIChat.chatBody (msgs) │
│  └─ DrawTools.* (geoms)    │
└─────────────────────────────┘
```

Non esiste uno store centralizzato (come Redux/Pinia). Ogni componente gestisce il suo stato. localStorage persiste user/project/thread.

---

## 🏷️ Terminologia Architetturale

| Termine | Significato |
|---------|------------|
| **Modulo** | IIFE che espone API pubblica, nasconde private state |
| **Component** | Modulo con logica UI e state |
| **Partial** | Frammento HTML caricato dinamicamente |
| **Event** | CustomEvent dispatched per comunicazione inter-componente |
| **Listener** | Handler registrato su document per ascoltare eventi |
| **Layer** | Entità su mappa (vector GeoJSON o raster COG) |
| **Feature** | Geometria disegnata (punto, linea, poligono) |
| **Collection** | Gruppo di feature disegnate dall'utente |
| **Thread** | Session conversazione con AI Agent (backend) |
| **Toast** | Notifica temporanea (bottom-center) |

---

## 🎬 Lifecycle di un Componente

### Esempio: LayerPanel

```
┌──────────────────────────────────────────┐
│  1. LOAD                                 │
│  ├─ script tag in index.html caricato   │
│  └─ LayerPanel IIFE eseguito            │
├──────────────────────────────────────────┤
│  2. DOM READY                            │
│  ├─ index.html parsing completato       │
│  ├─ Partial HTML caricati e inseriti    │
│  └─ DOM elementi disponibili            │
├──────────────────────────────────────────┤
│  3. INIT                                 │
│  ├─ LayerPanel.init() chiamato da app.js│
│  ├─ DOM elementi selezionati (querySelector)  │
│  ├─ Event listener registrati (onClick, etc.) │
│  ├─ Stato iniziale settato              │
│  └─ ListenListener su 'auth:ready'      │
├──────────────────────────────────────────┤
│  4. READY                                │
│  ├─ AuthGate rilascia utente            │
│  ├─ Listener 'auth:ready' triggerato    │
│  ├─ LayerPanel.reloadProjectLayers()    │
│  └─ Lista layer da backend caricata     │
├──────────────────────────────────────────┤
│  5. INTERACTIVE                          │
│  ├─ Utente interagisce (click button)   │
│  ├─ Event handler risponde              │
│  ├─ Stato aggiornato                    │
│  ├─ Possibile CustomEvent dispatched    │
│  └─ Toast mostrato per feedback         │
├──────────────────────────────────────────┤
│  6. DESTROY (opzionale)                  │
│  ├─ Logout → localStorage.clear()       │
│  ├─ location.reload() → restart         │
│  └─ Tutta l'app reinizializzata        │
└──────────────────────────────────────────┘
```

---

## 🔌 Dependency Graph

```
┌─────────────────────┐
│   HTML (index)      │
└─────────────────────┘
          │
    Carica CSS
    Carica JS
          │
   ┌──────▼────────┐
   │   app.js      │ (orchestrator)
   └──────┬────────┘
          │
    Chiama init()
          │
    ┌─────┼─────┬────────┬──────────┬──────────┐
    │     │     │        │          │          │
┌───▼──┐ │ ┌──▼───┐ ┌──▼──┐ ┌──▼────┐ ┌───▼──┐
│GeoMap│ │ │Layer │ │User │ │AIChat │ │Time  │
│      │ │ │Panel │ │Panel│ │       │ │Slider│
└──────┘ │ └──────┘ └─────┘ └───────┘ └──────┘
         │
    ┌────▼──────────┐
    │  AuthGate     │
    │(Prerequisite) │
    └───────────────┘

Legend: → = dipende da
        │ = chiama
```

---

## 🚀 Performance Optimization

### Lazy Loading
- **Partial HTML**: Caricati on-demand, non inline
- **Map**: Inizializzato solo quando DOM pronto

### Debounce/Throttle
- **Drag events**: DrawTools throttle movimento mouse
- **Window resize**: Potenziale throttle (non visibile)

### Asset Optimization
- **CSS Modularizzato**: Un file per componente
- **JS Modularizzato**: Un file per componente
- **Vendor CDN**: Bootstrap, MapLibre, Material Icons da CDN

### Memory Management
- **Event listeners**: Registrati su `document` (delegato)
- **No memory leaks**: Assenza di `.addEventListener()` ricorsivi senza cleanup

---

## ✅ Principi Architetturali

1. **Single Responsibility**: Ogni modulo fa una cosa
2. **Loose Coupling**: CustomEvent per comunicazione
3. **High Cohesion**: Logica UI e state vicini
4. **No Global State**: Solo localStorage persistente
5. **Explicit Dependencies**: Import impliciti via script order
6. **Predictable Initialization**: app.js coordina l'ordine

---

## 🔧 Estendibilità

Aggiungere nuovo componente è semplice:

```javascript
// 1. Creare modulo in public/js/new-component.js
const NewComponent = (() => {
    function init() {
        // Logica inizializzazione
    }
    return { init };
})();

// 2. Creare partial HTML in public/partials/new-component.html
<div id="newComponentContainer">...</div>

// 3. Aggiungere a index.html
<div data-include="public/partials/new-component.html"></div>

// 4. Caricare JS in index.html
<script src="public/js/new-component.js"></script>

// 5. Inizializzare in app.js
NewComponent.init();

// 6. Opzionalmente: registrare listener su CustomEvent
document.addEventListener('some:event', e => NewComponent.handleEvent(e));
```

---

## 📊 Diagramma di Sequenza: Login Flow

```
User           Browser         AuthGate        Backend
 │                │              │              │
 ├──input user_id─│──────────────│──────────────│
 │                │              │              │
 │                │        verifyUser()        │
 │                │              │              │
 │                │              ├──POST /user─│
 │                │              │              │
 │                │              │         [verify]
 │                │              │              │
 │                │              │<──projects──┤
 │                │              │              │
 │                │        buildProjectsUI()   │
 │                │              │              │
 ├─select project─│──────────────│──────────────│
 │                │              │              │
 │                │            proceed()       │
 │                │              │              │
 │                │              ├─POST /t─────│
 │                │              │[new thread] │
 │                │              │              │
 │                │              │<─thread_id──┤
 │                │              │              │
 │                │        finalize()          │
 │                │        hideGate()          │
 │                │        dispatch auth:ready│
 │                │              │              │
 │<──────────────[App visible]────────────────│
 │                │              │              │
```

---

## 📈 Scalabilità

**Strengths:**
- Modular = facile aggiungere componenti
- Event-driven = sotto-accoppiato
- localStorage = no server session

**Limitazioni:**
- In-memory state = perso su reload
- No centralized store = possibili inconsistenze se non gestite bene
- Vanilla JS = niente hot-reload (per development)

**Soluzioni Future:**
- Migrare a framework (Vue/React) se complessità cresce
- Implementare Service Worker per PWA
- Aggiungere testing framework (Vitest/Jest)

---

## 🎓 Conclusione

L'architettura SaferPlaces è **pragmatica e semplice**, basata su:

- **Vanilla JS** (niente overhead framework)
- **Modular components** (IIFE pattern)
- **Event-driven communication** (CustomEvent)
- **Distributed state** (localStorage + in-memory)
- **REST API backend** (Flask Python)

È **ideale per SPA medio-complesse** senza bisogno di full framework overhead.

---

**Prossimo Step**: Vedi `02_COMPONENTI_CORE.md` per dettagli su GeoMap, AIChat, LayerPanel, UserPanel, AuthGate.
