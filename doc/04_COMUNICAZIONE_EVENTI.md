# 04 - Comunicazione tra Componenti via CustomEvent

## 🔗 Paradigma Event-Driven

SaferPlaces utilizza **CustomEvent** per comunicazione inter-componente. Questo garantisce:

- **Zero-coupling**: Componenti non importano l'uno l'altro
- **Decoupling**: Singoli listener possono essere aggiunti/rimossi facilmente
- **Scalabilità**: Nuovi listener si registrano senza modificare dispatcher

---

## 📡 Dispatch Function

Utilità globale per dispatching:

```javascript
// Disponibile implicitamente ovunque (definito in app.js o moduli)
function dispatch(eventName, detail = {}) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
}
```

### Utilizzo

```javascript
// Dispatcher (es. LayerPanel)
dispatch('layer:add-geojson', {
    layer_data: {
        src: 'https://example.com/data.geojson',
        title: 'My Layer',
        type: 'vector'
    }
});

// Listener (es. GeoMap)
document.addEventListener('layer:add-geojson', e => {
    const { layer_data } = e.detail;
    GeoMap.addVectorLayer(layer_data);
});
```

---

## 📋 Event Registry

Elenco completo di tutti i CustomEvent utilizzati nell'app:

### 1. Layer Events

#### `layer:add-geojson`
- **Dispatcher**: LayerPanel
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    layer_data: {
      src: string,              // URL GeoJSON
      title?: string,           // Nome layer
      description?: string,     // Descrizione
      type: 'vector',
      register: boolean         // Se registrare a backend
    }
  }
  ```
- **Flusso**: Utente clicca \"Add vector layer\" in LayerPanel

#### `layer:add-cog`
- **Dispatcher**: LayerPanel
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    layer_data: {
      src: string,              // URL COG (Cloud Optimized GeoTIFF)
      type: 'raster',
      metadata: {
        colormap: string        // 'viridis', 'inferno', etc.
      },
      register: boolean
    }
  }
  ```

#### `layer:toggle-remote`
- **Dispatcher**: LayerPanel (da azione menu layer)
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    layer: {
      id: string,               // ID layer
      src: string,
      // ...
    }
  }
  ```
- **Azione**: Abilita/disabilita visibilità layer

#### `layer:download`
- **Dispatcher**: LayerPanel (da azione menu)
- **Listener**: Non implementato (da completare)
- **Payload**:
  ```javascript
  {
    layer: {
      src: string               // URL download
    }
  }
  ```

#### `layer:reload-project-layers`
- **Dispatcher**: AIChat (dopo tool response), UserPanel (switch progetto)
- **Listener**: LayerPanel
- **Payload**: Nessuno
- **Azione**: Ricarica layer list da backend

### 2. Map Events

#### `map:toggle-layer-visibility`
- **Dispatcher**: LayerPanel (click eye icon)
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    // Dettagli specifici sui layer da toggleare
  }
  ```

#### `map:set-style`
- **Dispatcher**: AIChat (comando `/dark`, `/light`), UI selector
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    styleUrl: string            // URL stile MapLibre
  }
  ```
- **Azione**: Cambia stile/tema mappa

#### `map:reset`
- **Dispatcher**: AIChat (comando `/reset`)
- **Listener**: GeoMap
- **Payload**: Nessuno
- **Azione**: Reset view a Roma (center: [12.4964, 41.9028], zoom: 3)

### 3. Time Slider Events

#### `timeslider:change`
- **Dispatcher**: TimeSlider (user drag handle, play button)
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    iso: string,                // ISO 8601 timestamp (es. '2024-02-01T14:30:00Z')
    date: Date                  // JavaScript Date object
  }
  ```
- **Azione**: GeoMap ricarica raster temporali per `iso`

### 4. Authentication Events

#### `auth:ready`
- **Dispatcher**: AuthGate (dopo login completato)
- **Listener**: LayerPanel
- **Payload**: Nessuno
- **Azione**: LayerPanel sa che user è autenticato, carica layer

### 5. Chat Events

#### `chat:command`
- **Dispatcher**: Non usato (legacy, obsoleto)
- **Listener**: GeoMap
- **Payload**:
  ```javascript
  {
    cmd: string                 // Comando (es. 'style:dark')
  }
  ```

### 6. Draw Tools Events

#### `draw-tool:start`
- **Dispatcher**: DrawTools
- **Listener**: Nessuno (per ora)
- **Payload**:
  ```javascript
  {
    mode: 'point' | 'linestring' | 'bbox' | 'polygon'
  }
  ```

#### `draw-tool:update-user-drawn-shapes`
- **Dispatcher**: AIChat (tool response con state_updates)
- **Listener**: DrawTools
- **Payload**:
  ```javascript
  {
    user_drawn_shapes: array    // Feature collection aggiornata
  }
  ```
- **Azione**: DrawTools visualizza forme da backend

---

## 🔄 Sequenze di Comunicazione

### Sequenza 1: Aggiunta Layer Manuale (Senza Registrazione)

```
LayerPanel                    GeoMap
     │                           │
     ├── dispatch('layer:add-geojson', {...})
     │                           │
     │           ┌───────────────┤
     │           │               │
     │           │           addVectorLayer()
     │           │               │
     │           │           POST /render
     │           │               │
     │           │           [backend processa]
     │           │               │
     │           │           map.addSource()
     │           │           map.addLayer()
     │           │               │
     │ ◄─ (non receive evento specifico)
     │
     └─ Toasts.ok('Layer added')
```

### Sequenza 2: Aggiunta Layer CON Registrazione

```
LayerPanel                LayerPanel Modal      GeoMap
     │                           │                 │
     ├─ openRegModal()
     │
     ├─ User riempie form
     │
     ├─ lrConfirm click
     │
     ├─ dispatch('layer:add-cog', {...})
     │                           │
     │           ┌───────────────┤
     │           │               │
     │           │           addCOG()
     │           │               │
     │           │           POST /render
     │           │               │[backend: salva in DB]
     │           │
     │     closeRegModal()
     │
     ├─ dispatch('layer:reload-project-layers')
     │                           │
     │    ┌──────────────────────┤
     │    │
     │ reloadProjectLayers()
     │    │
     │    POST /layers
     │    │[backend: ritorna lista aggiornata]
     │    │
     │ renderLayerList()
     │
     └─ Toasts.ok('Layer registered')
```

### Sequenza 3: Chat Comandi Locali

```
AIChat                           GeoMap
   │                              │
   ├─ User scrive '/dark'
   │
   ├─ send()
   │
   ├─ handle_command('dark')
   │
   ├─ dispatch('map:set-style', { styleUrl: '...' })
   │                              │
   │          ┌────────────────────┤
   │          │                    │
   │          │              setStyle()
   │          │              map.setStyle(styleUrl)
   │          │
   ├─ appendBubble('🌓 Dark Matter style activated', 'ai')
   │
   └─ Toasts.ok(t, 'Style changed')
```

### Sequenza 4: Time Slider Play

```
TimeSlider                            GeoMap
    │                                  │
    ├─ User clicca Play
    │
    ├─ togglePlay()
    │
    ├─ Start timer interval
    │
    ├─ setValue(next_iso)
    │
    ├─ dispatch('timeslider:change', { iso: '...', date: ... })
    │                                  │
    │          ┌──────────────────────┤
    │          │                      │
    │          │              renderTimestampRasters(iso)
    │          │              │
    │          │              fetch /render?iso=...
    │          │              │[backend: ritorna URL raster per timestamp]
    │          │              │
    │          │              map.addSource(timestamp_src)
    │          │              map.addLayer(timestamp_layer)
    │
    ├─ [Timer continua] ────repeat ogni stepMinutes
    │
    └─ User clicca Pause ──→ clearInterval()
```

### Sequenza 5: Logout User

```
UserPanel                          localStorage
   │                                    │
   ├─ User clicca 'Exit'
   │
   ├─ logoutBtn.onclick()
   │
   ├─ removeItem('user_id')
   │ , removeItem('project_id')
   │ , removeItem('thread_id')
   │                                Cleared ✓
   │
   ├─ location.reload()
   │                    [Full page reload]
   │
   ├─ index.html, CSS, JS ricaricati
   │
   ├─ app.js: AuthGate.init()
   │                    │
   │                    └─ localStorage.getItem() → null
   │                           │
   │                           └─ showGate()  [Auth overlay appare]
```

### Sequenza 6: Switch Progetto

```
UserPanel                          AuthGate            LayerPanel
    │                                 │                     │
    ├─ User clicca progetto da lista
    │
    ├─ AuthGate.loadUserProject(user, project)
    │                                 │
    │                ┌────────────────┤
    │                │                │
    │                │           POST /t
    │                │           body: {user_id, project_id}
    │                │
    │                │           [backend: crea/resume thread]
    │                │
    │                │           ritorna {thread_id, ...}
    │                │
    │         localStorage.setItem()   [Credenziali aggiornate]
    │
    ├─ fillInfo()  [Update badge user/project/thread]
    │
    ├─ dispatch('layer:reload-project-layers')
    │                                          │
    │                ┌─────────────────────────┤
    │                │                          │
    │                │                    reloadProjectLayers()
    │                │                          │
    │                │                    POST /layers
    │                │                    [backend: lista layer del nuovo progetto]
    │                │
    │                │                    renderLayerList()
    │
    └─ [UI aggiornata con nuovo progetto]
```

---

## 🎯 Best Practices Gli Event

### 1. Naming Convention

Format: `[namespace]:[action]` (sempre lowercase)

```javascript
// ✓ Buon nome
dispatch('layer:add-geojson');
dispatch('map:set-style');
dispatch('auth:ready');

// ✗ Cattivo nome
dispatch('addLayer');           // no namespace
dispatch('Layer_Added');        // mixed case
dispatch('map_style_change');   // underscore instead of dash
```

### 2. Payload Structure

Sempre usa un oggetto `detail` con proprietà significative:

```javascript
// ✓ Corretto
dispatch('layer:add-geojson', {
    layer_data: { src: '...', title: '...' }
});

// ✗ Incorretto
dispatch('layer:add-geojson', { src: '...' });      // proprietà confuse
dispatch('layer:add-geojson', '...');               // string bare, no detail
```

### 3. Listener Registration

Registra listener una sola volta in `init()`:

```javascript
// ✗ Cattivo (listener registrato ogni volta)
function handleButtonClick() {
    document.addEventListener('layer:reload', () => { /* ... */ });
}

// ✓ Buono (listener registrato in init)
function init() {
    document.addEventListener('layer:reload', onLayerReload);
}

function onLayerReload(e) { /* ... */ }
```

### 4. Error Handling

Nel listener, evita throw non gestiti:

```javascript
// ✗ Cattivo
document.addEventListener('layer:add-geojson', e => {
    const layer = e.detail.layer_data;
    JSON.parse(layer.metadata);  // Potrebbe fallire
});

// ✓ Buono
document.addEventListener('layer:add-geojson', e => {
    try {
        const layer = e.detail.layer_data;
        JSON.parse(layer.metadata);
    } catch (err) {
        console.error('Invalid layer metadata:', err);
        Toasts.error(t, 'Layer format error');
    }
});
```

### 5. Evita Catene di Event

Non fare event che triggera altro event in cascata infinita:

```javascript
// ✗ Cattivo
document.addEventListener('map:style-changed', () => {
    dispatch('map:style-changed');  // Cascata infinita!
});

// ✓ Buono (usa timer o flag)
let isUpdating = false;
document.addEventListener('map:style-changed', () => {
    if (isUpdating) return;
    isUpdating = true;
    try {
        // Logica
    } finally {
        isUpdating = false;
    }
});
```

---

## 📊 Event Dependency Graph

```
User Action (click)
        │
        ├─→ dispatch('layer:add-geojson')
        │       └─→ GeoMap.addVectorLayer()
        │           ├─→ POST /render [backend]
        │           └─→ map.addSource/Layer()
        │
        ├─→ dispatch('map:set-style')
        │       └─→ GeoMap.setStyle()
        │           └─→ map.setStyle(styleUrl)
        │
        ├─→ dispatch('timeslider:change')
        │       └─→ GeoMap.renderTimestampRasters()
        │           ├─→ fetch /render?iso=...
        │           └─→ map.addLayer()
        │
        ├─→ dispatch('auth:ready')
        │       └─→ LayerPanel.reloadProjectLayers()
        │           ├─→ POST /layers [backend]
        │           └─→ renderLayerList()
        │
        └─→ dispatch('layer:reload-project-layers')
                └─→ LayerPanel.reloadProjectLayers()
                    └─→ renderLayerList()

No circular dependencies ✓
```

---

## 🔧 Debugging Event

### Monitorare Tutti gli Event

Aggiungi in console:

```javascript
const originalDispatchEvent = document.dispatchEvent;
document.dispatchEvent = function(event) {
    if (event.type.includes(':')) {  // CustomEvent solo
        console.log('[EVENT]', event.type, event.detail);
    }
    return originalDispatchEvent.call(this, event);
};
```

### Event Listener Monitor

```javascript
// Vedi tutti i listener registrati su document
getEventListeners(document);  // Chrome DevTools console
```

### Break on Event

In Chrome DevTools:

1. Apri Sources tab
2. Tasto dx su un elemento DOM
3. \"Break on\" → \"DOM Exception\"

---

## 🚀 Aggiungere Nuovo Event

Procedura:

1. **Definire il nome**: `namespace:action`
2. **Aggiungere dispatcher** nel componente appropriato:
   ```javascript
   dispatch('new:event', { detail: data });
   ```
3. **Aggiungere listener** nei componenti interessati:
   ```javascript
   document.addEventListener('new:event', e => {
       const { detail } = e;
       // Gestisci
   });
   ```
4. **Documentare** in questo file
5. **Testare** che non ci siano cascate infinite

---

## 📝 Conclusione

CustomEvent è il \"glue\" che tiene insieme i componenti loosely-coupled. Mantenere il registry pulito e ordinato facilita:

- Manutenzione
- Debugging
- Aggiunta nuove feature
- Testing

---

**Prossimo Step**: Vedi `05_API_BACKEND.md` per endpoint REST e integrazione backend.
