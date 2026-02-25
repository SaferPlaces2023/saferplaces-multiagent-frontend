# SaferPlaces Agent Frontend - Documentazione Completa

## 📋 Indice della Documentazione

Questa è la documentazione completa del frontend della WebApp **SaferPlaces Agent**. La webapp è una moderna Single Page Application (SPA) costruita con vanilla JavaScript, HTML5 e CSS3, integrata con librerie esterne specializzate per cartografia e geomatics.

### Indice dei Documenti

| Documento | Descrizione |
|-----------|-------------|
| **01_ARCHITETTURA_GENERALE.md** | Panoramica dell'architettura, struttura progettuale, flussi di inizializzazione |
| **02_COMPONENTI_CORE.md** | Analisi dettagliata dei componenti principali (GeoMap, AIChat, LayerPanel, UserPanel, AuthGate) |
| **03_COMPONENTI_SUPPORT.md** | DrawTools, TimeSlider, Toasts e altri componenti di supporto |
| **04_COMUNICAZIONE_EVENTI.md** | Sistema di CustomEvents, flussi di comunicazione tra componenti |
| **05_API_BACKEND.md** | Endpoint REST, integrazione con backend Flask, contratti dati |
| **06_STYLING_UI.md** | Design system, CSS, tema, componenti Bootstrap integrati |
| **07_GUIDA_SVILUPPATORE.md** | Istruzioni per estendere, aggiungere componenti, best practices |
| **08_GLOSSARIO.md** | Glossario tecnico, terminologia, abbreviazioni |

---

## 🎯 Breve Introduzione

**SaferPlaces Agent** è una webapp geospaziale che consente a utenti di:

1. **Autenticarsi** con un user_id
2. **Selezionare/creare progetti** di analisi
3. **Visualizzare mappe interattive** basate su MapLibre
4. **Caricare layer di dati** (GeoJSON vettoriali, COG raster)
5. **Disegnare forme geometriche** sulla mappa (punti, linee, poligoni, bbox)
6. **Interagire con un AI Agent** attraverso chat testuale
7. **Visualizzare serie temporali** tramite time slider
8. **Gestire progetti** (creare, aprire, esportare)

---

## 🏗️ Stack Tecnologico

### Frontend Stack

```
┌─────────────────────────────────────────┐
│           HTML5 + CSS3 + JS (Vanilla)    │
├─────────────────────────────────────────┤
│  Bootstrap 5.3.3 (UI components)        │
│  MapLibre GL 5.9.0 (cartografia)        │
│  Material Symbols (icone)               │
│  Marked 12.0.2 (markdown parsing)       │
└─────────────────────────────────────────┘
```

### Librerie Esterne

- **Bootstrap 5.3.3**: Framework CSS e componenti UI
- **MapLibre GL**: Rendering vettoriale di mappe (alternativa a Mapbox GL)
- **MapLibre COG Protocol**: Supporto per Cloud Optimized GeoTIFF
- **Shpjs**: Parser per file di dati geografici (*.shp)
- **Marked**: Renderer markdown per contenuti chat
- **Material Symbols**: Icone Google Material Design

### Backend Integration

- **Framework**: Flask (Python)
- **Versione API**: v0.2.6
- **Comunicazione**: REST over HTTP/HTTPS
- **Autenticazione**: user_id based (localStorage)

---

## 📁 Struttura del Progetto

```
saferplaces-agent-frontend/
├── public/
│   ├── index.html                 # Entry point HTML
│   ├── imgs/                      # Asset (logo, icone)
│   ├── css/                       # Stylesheet (uno per componente)
│   │   ├── base.css              # Stili globali e tema
│   │   ├── index.css             # Layout principale
│   │   ├── auth-gate.css         # AuthGate overlay
│   │   ├── geo-map.css           # Mappa e toolbar
│   │   ├── layer-panel.css       # Sidebar layer
│   │   ├── user-panel.css        # Sidebar utente
│   │   ├── ai-chat.css           # Chat box
│   │   ├── ai-chat-settings.css  # Impostazioni chat
│   │   ├── draw-tools.css        # Drawing toolbar
│   │   ├── layer-register.css    # Modal registrazione layer
│   │   ├── time-slider.css       # Time slider
│   │   └── toasts.css            # Notifiche toast
│   ├── js/                        # Moduli JavaScript
│   │   ├── _consts.js            # Costanti e rotte API
│   │   ├── app.js                # Inizializzazione globale
│   │   ├── auth-gate.js          # Autenticazione UI
│   │   ├── geo-map.js            # Gestione mappa (MapLibre)
│   │   ├── user-panel.js         # Panel utente e progetti
│   │   ├── layer-panel.js        # Panel layer (sinistra)
│   │   ├── layer-register.js     # Modal registrazione layer
│   │   ├── ai-chat.js            # Chat AI e comandi
│   │   ├── ai-chat-settings.js   # Impostazioni chat
│   │   ├── draw-tools.js         # Strumenti di disegno
│   │   ├── time-slider.js        # Slider temporale
│   │   └── toasts.js             # Sistema notifiche
│   └── partials/                  # HTML inclusi dinamicamente
│       ├── geo-map.html          # Elemento mappa + toolbar
│       ├── user-panel.html       # Panel utente
│       ├── layer-panel.html      # Panel layer
│       ├── ai-chat.html          # Chat box
│       ├── auth-gate.html        # Login overlay
│       ├── time-slider.html      # Time slider
│       └── layer-register.html   # Modal registrazione
├── tests/                         # Test HTML
├── docker-compose.yml            # Docker compose (deployment)
├── Dockerfile                     # Immagine Docker
├── nginx.conf                     # Config nginx (produzione)
└── README.md                      # Readme del progetto
```

---

## 🔄 Flusso di Inizializzazione

### 1. Caricamento della Pagina

```
┌─────────────────────────────────────────────┐
│ 1. Browser carica index.html                │
├─────────────────────────────────────────────┤
│ 2. CSS bundle caricato                      │
│    (base.css + componenti specifici)        │
├─────────────────────────────────────────────┤
│ 3. Vendor JS caricati in parallelo          │
│    (Bootstrap, MapLibre, Marked, etc.)      │
├─────────────────────────────────────────────┤
│ 4. App JS caricato in sequenza              │
│    (_consts.js → ... → app.js)              │
└─────────────────────────────────────────────┘
```

### 2. Esecuzione app.js (Mini Loader)

```javascript
// app.js main flow:
1. loadIncludes()  // Carica i partial HTML ricorsivamente
2. GeoMap.init()   // Inizializza mappa MapLibre
3. UserPanel.init()
4. LayerPanel.init()
5. AuthGate.init() // Mostra overlay autenticazione se necessario
6. AIChat.init()
7. TimeSlider.init()
8. Wiring di CustomEvent tra componenti
```

### 3. Flusso Autenticazione

```
┌──────────────────────────────┐
│ User inserisce user_id       │ → AuthGate.verifyUser()
├──────────────────────────────┤
│ POST /user (backend)         │ → Verifica e lista progetti
├──────────────────────────────┤
│ User seleziona/crea progetto │ → buildProjectsUI()
├──────────────────────────────┤
│ POST /t (crea thread)        │ → Ottiene thread_id
├──────────────────────────────┤
│ localStorage.setItem()       │ → Salva credenziali
├──────────────────────────────┤
│ AuthGate.hideGate()          │ → App diventa visibile
└──────────────────────────────┘
```

---

## 🎨 Tema e Design

### Tema Colori

| Elemento | Colore | Uso |
|----------|--------|-----|
| Background | `#0f1115` | Sfondo principale, pagina scura |
| Text Primary | `#e8eaed` | Testo predefinito, leggibile |
| Foreground | `#0c0f14` | Input, form, componenti |
| Accent Green | `#6ee7b7` | Layer visualizzati, bottoni success |
| Accent Blue | `#60a5fa` | Highlight, info |
| Accent Red | `#f87171` | Danger, delete, errori |
| Accent Yellow | `#facc15` | Warning, attenzione |
| Glass | `rgba(18,18,20,0.9)` | Sidebar, toolbar, effetto vetro |

### Effetti Visuali

- **Glassmorphism**: Effetto vetro opaco con `backdrop-filter: blur(8px)`
- **Elevazione**: Box shadow per profondità
- **Transizioni**: `.12s ease` su hover/focus
- **Scrollbar Custom**: Sottile, semi-trasparente

---

## 🔌 Paradigma di Comunicazione

I componenti non hanno dipendenze dirette tra loro. Comunicano attraverso **CustomEvent** nel DOM:

```javascript
// Componente A → Dispatch evento
dispatch('layer:add-geojson', { layer_data: {...} });

// Componente B → Ascolta evento
document.addEventListener('layer:add-geojson', e => {
    GeoMap.addVectorLayer(e.detail);
});
```

Questo garantisce **basso accoppiamento** e **riutilizzabilità**.

---

## 📊 Stato dell'Applicazione

Lo stato è gestito in tre modi:

1. **localStorage** (persistente)
   - `user_id`: Identificativo utente
   - `project_id`: Progetto selezionato
   - `thread_id`: Session AI Agent

2. **In-memory** (moduli)
   - Stato mappa (layer, view, bounds)
   - Stato chat (messaggi, stato invio)
   - Stato disegno (feature collection, mode)

3. **Non persistito** (sessione)
   - Messaggi chat (resettabili col pulsante "Clean")
   - Selezioni UI (panel open/closed)
   - Filtri temporali

---

## ✨ Caratteristiche Principali

### 1. Autenticazione Stateless
- Basata su localStorage (user_id + thread_id)
- Niente session server-side
- Logout = pulizia localStorage

### 2. Mappa Cartografica Interattiva
- MapLibre GL per rendering vettoriale
- Supporto layer dinamici (GeoJSON, COG)
- Zoom 3D con proiezione globo
- Edifici 3D (da OpenFreeMap)

### 3. Disegno Geometrico
- Strumenti per: Punto, Linea, BBox, Poligono
- Modalità Edit/Delete
- Feature collection con persistenza

### 4. Chat AI Integrata
- Comandi locali (e.g., `/dark`, `/help`)
- Integrazione agent remoto
- Tool calls visualization
- Supporto markdown rendering

### 5. Gestione Layer
- Aggiunta manuale (vector/raster)
- Registrazione in progetto
- Ricarica da backend
- Organizzazione con collapse

### 6. Timeline Temporale
- Slider interattivo con play/pausa
- Velocità regolabile
- Highlight intervalli
- Integrazione con rendering temporale raster

---

## 🚀 Next Steps per la Lettura

1. Inizia da **01_ARCHITETTURA_GENERALE.md** per una visione ad alto livello
2. Approfondisci i componenti in **02_COMPONENTI_CORE.md** e **03_COMPONENTI_SUPPORT.md**
3. Comprendi la comunicazione in **04_COMUNICAZIONE_EVENTI.md**
4. Explora gli endpoint in **05_API_BACKEND.md**
5. Studia gli stili in **06_STYLING_UI.md**
6. Usa **07_GUIDA_SVILUPPATORE.md** per modificare/estendere
7. Consulta **08_GLOSSARIO.md** per termini tecnici

---

## 📝 Note Finali

- **Vanilla JS**: Nessun framework (React, Vue), puro ES6+
- **Modular Design**: Ogni componente è un IIFE (Immediately Invoked Function Expression)
- **Progressive Enhancement**: Fallback graceful se API non disponibili
- **Responsive**: Adatto desktop e mobile (da testare)
- **Dark Theme**: Tema scuro predefinito, ottimizzato per visibilità notturna

---

**Versione Documentazione**: 1.0  
**Data**: Febbraio 2026  
**Backend Version**: 0.2.6
