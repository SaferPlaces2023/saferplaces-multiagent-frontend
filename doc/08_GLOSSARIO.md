# 08 - Glossario Tecnico

Glossario di termini, abbreviazioni e concetti utilizzati in SaferPlaces.

---

## A

### API
**Application Programming Interface**  
Insieme di regole e protocolli che permettono comunicazione tra componenti software.  
*Vedi anche*: REST API, Endpoint, HTTP

### Autenticazione (Authentication)
Processo di verifica che l'utente è chi dice di essere.  
In SaferPlaces: basata su `user_id` + `thread_id` salvati in `localStorage`.  
*Vedi anche*: AuthGate, Autorizzazione

### Autorizzazione (Authorization)
Processo di verifica che l'utente ha permesso di accedere una risorsa.  
In SaferPlaces: backend verifica che `user_id` proprietà del `project_id`.  
*Vedi anche*: Autenticazione

---

## B

### Backend
Apparato server-side dell'applicazione.  
SaferPlaces backend: Flask Python, espone REST API.  
*Opposto*: Frontend  
*Vedi anche*: API, REST

### BBox (Bounding Box)
Rettangolo che circonda una geometria geospaziale.  
Definito da: `[minLng, minLat, maxLng, maxLat]` oppure `[[min_corner], [max_corner]]`.  
In SaferPlaces: strumento di disegno produce BBox, usato per zoom e filtering.  
*Vedi anche*: GeoJSON, Viewport

### Bootstrap
Framework CSS e componenti UI.  
SaferPlaces usa Bootstrap 5.3.3 (CDN).  
*Utilizzo*: Form controls, buttons, grid layout, utilities.  
*Link*: https://getbootstrap.com

---

## C

### CDN (Content Delivery Network)
Rete di server che distribuisce contenuti (CSS, JS, immagini) da ubicazioni geografiche ottimali.  
SaferPlaces carica vendor libraries da CDN (Bootstrap, MapLibre, icone).  
*Vedi anche*: Vendor, Deploy

### Chat
Interfaccia conversazionale per comunicare con AI Agent.  
In SaferPlaces: component `AIChat` che invia promande e riceve messaggi.  
*Vedi anche*: AIChat, Prompt, Tool Calls

### COG (Cloud Optimized GeoTIFF)
Formato raster geospaziale ottimizzato per lettura remota.  
Permette di leggere parti di raster senza scaricare interamente.  
In SaferPlaces: supportato per layer raster (via MapLibre COG Protocol).  
*Vedi anche*: Raster, Geotiff, Vector

### Collection (Feature Collection, Draw Collection)
Insieme di feature geometriche.  
In SaferPlaces: `DrawTools` mantiene collezioni di feature disegnate.  
*Format JSON*: GeoJSON FeatureCollection  
*Vedi anche*: Feature, GeoJSON, DrawTools

### CustomEvent
API JavaScript che permette di creare e dispatchare eventi personalizzati.  
SaferPlaces usa CustomEvent per comunicazione inter-componente (zero-coupling).  
*Esempio*: `document.dispatchEvent(new CustomEvent('layer:add-geojson', {...}))`  
*Vedi anche*: Event-Driven, Comunicazione

---

## D

### Dispatch
Azione di inviare (emettere) un CustomEvent.  
*Sinonimo*: Emit  
*Utilizzato in*: Comunicazione tra componenti  
*Vedi anche*: CustomEvent, Listener

### DOM (Document Object Model)
Rappresentazione gerarchica degli elementi HTML nella pagina.  
JavaScript manipola il DOM per aggiornare UI.  
*Vedi anche*: Event, querySelector, innerHTML

### DrawTools
Componente che fornisce strumenti di disegno geometrico sulla mappa.  
Geometrie supportate: Punto, Linea, BBox, Poligono.  
*Vedi anche*: Feature, Editing, Map

---

## E

### EcmaScript (ES6+)
Standard JavaScript moderno (ES2015 e successivi).  
SaferPlaces usa: arrow functions, const/let, async/await, classes.  
*Vedi anche*: JavaScript, Vanilla JS

### Endpoint
URL di un API dove si accede una risorsa specifica.  
*Esempio*: `/t/{threadId}/layers` è endpoint per lista layer.  
*Vedi anche*: API, Route, REST

### Event (Evento)
Azione che occorre in risposta a interazione o stato (click, change, custom).  
SaferPlaces usa: DOM events (click, change) + CustomEvents (comunicazione componenti).  
*Vedi anche*: Listener, Event-Driven, CustomEvent

### Event-Driven Architecture
Pattern architetturale dove componenti comunicano via events invece di dipendenze dirette.  
SaferPlaces implementa questo via CustomEvent.  
*Vantaggi*: Decoupling, scalabilità, testabilità  
*Vedi anche*: CustomEvent, Dispatch, Listener

---

## F

### Feature
Entità geometrica singola in un dataset geospaziale.  
Composta da: geometria (punto, linea, poligono) + proprietà.  
*Format*: GeoJSON Feature object  
*Vedi anche*: GeoJSON, Geometry, Collection

### Feature Collection
Collezione di multiple Feature.  
In SaferPlaces: used from layer registrazione, draw collections.  
*Format JSON*:
```json
{
  "type": "FeatureCollection",
  "features": [{ "type": "Feature", ... }, ...]
}
```
*Vedi anche*: Feature, GeoJSON, Collection

### Frontend
Apparato client-side dell'applicazione.  
SaferPlaces frontend: HTML5, CSS3, Vanilla JavaScript (no framework).  
*Opposto*: Backend  
*Vedi anche*: SPA, Vanilla JS

---

## G

### GeoJSON
Standard di formato de dati geografici basato su JSON.  
SaferPlaces usa GeoJSON per vector layer.  
*Specif*: RFC 7946  
*Supported geometries*: Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon  
*Link*: https://geojson.org  
*Vedi anche*: Vector, Feature, Geometry

### Geometry
Componente spaziale di una feature (forma).  
*Tipi*: Point, LineString, Polygon, ecc.  
*Rappresentazione*: Array di coordinate `[lng, lat]`  
*Vedi anche*: Feature, Coordinate, GeoJSON

### Glassmorphism
Effetto visuale di \"vetro opaco\" ottenuto con transparency + blur.  
In SaferPlaces: applicato a sidebar, toolbar, modal, toast.  
*Implementazione CSS*: `backdrop-filter: blur(8px); background: rgba(..., 0.9);`  
*Vedi anche*: CSS, Design

### Globe Control
Controllo MapLibre che permette di visualizzare la Terra come globo 3D.  
In SaferPlaces: add button nel topbar per attivare vista globo.  
*Vedi anche*: MapLibre, Control, 3D

---

## H

### HTTP (HyperText Transfer Protocol)
Protocollo per trasferimento dati in rete.  
SaferPlaces usa HTTP/HTTPS per REST API calls.  
*Metodi comuni*: GET, POST, PUT, DELETE  
*Vedi anche*: REST, Endpoint

### Headers (HTTP Headers)
Metadati allegati a richieste/risposte HTTP.  
*Esempi*: `Content-Type`, `Authorization`, `Cache-Control`  
*Utilizzo in SaferPlaces*: `Content-Type: application/json`  
*Vedi anche*: HTTP, Request

---

## I

### IIFE (Immediately Invoked Function Expression)
Pattern JavaScript che crea uno scope isolato per moduli.  
Tutti i componenti SaferPlaces usano IIFE pattern.  
*Syntax*: `const MyModule = (() => { /* private */ return { /* public */ }; })();`  
*Vantaggi*: Encapsulation, namespace management  
*Vedi anche*: Module, JavaScript, Closure

### Icon (Icona)
Rappresentazione grafica piccola di un concetto.  
SaferPlaces usa Material Design Icons (Google) via CDN.  
*Tags*: `<span class=\"material-symbols-outlined\">icon_name</span>`  
*Link*: https://fonts.google.com/icons  
*Vedi anche*: UI, Design

---

## J

### JavaScript
Linguaggio di programmazione per browser/runtime.  
SaferPlaces**: Vanilla JS (no framework), ES6+.  
*Runtime*: Browser (Node.js per build tools)  
*Vedi anche*: EcmaScript, Frontend, Vanilla JS

### JSON (JavaScript Object Notation)
Format leggero per serializzazione dati.  
SaferPlaces trasmette dati tra frontend/backend in JSON.  
*Utilizzo*: Request body, response body, configurazione  
*Vedi anche*: API, Serializzazione, GeoJSON

### JWT (JSON Web Token)
Standard per rappresentare claims di autenticazione in JSON.  
SaferPlaces attualmente NON usa JWT (usa stateless thread_id).  
*Future*: Possibile migrazione a JWT  
*Vedi anche*: Autenticazione, Authorization

---

## L

### Layer (Layer Geografico)
Entità su mappa che rappresenta dataset geospaziale.  
*Tipi in SaferPlaces*: 
- Vector (GeoJSON): geometrie e attributi
- Raster (COG): immagini, dati gridati
- 3D Buildings (Extrusions): edifici 3D  
*Vedi anche*: GeoJSON, COG, Map

### LayerPanel
Componente sidebar che gestisce lista layer del progetto.  
*Funzioni*: Reload layer, aggiungi vector/raster, registra in progetto.  
*File*: `public/js/layer-panel.js`, `public/partials/layer-panel.html`  
*Vedi anche*: Panel, Component, Sidebar

### Listener
Funzione che \"ascolta\" e risponde a un evento.  
*Syntax*: `document.addEventListener('event:name', listener_function)`  
*Sinonimo*: Handler, Callback  
*Vedi anche*: Event, CustomEvent, Dispatch

### localStorage
API browser che permette salvare dati persistentemente (client-side).  
SaferPlaces salva in localStorage: `user_id`, `project_id`, `thread_id`.  
*Limitazioni*: 5-10MB, cancellato se logout/clear cache, XSS vulnerable  
*Vedi anche*: Storage, Persistenza, Security

---

## M

### Map (Mappa Geospaziale)
Visualizzazione interattiva di dati geografici.  
SaferPlaces usa MapLibre GL per rendering vettoriale.  
*Componente*: `GeoMap` JavaScript module  
*Vedi anche*: MapLibre, GeoMap, Layer

### MapLibre GL
Libreria open-source per rendering mappe vettoriali basate su WebGL.  
SaferPlaces usa MapLibre GL 5.9.0 (da CDN).  
*Estensioni utilizzate*: COG Protocol, Events, Controls  
*Link*: https://maplibre.org  
*Vedi anche*: Map, Vector, Rendering

### Marked
Libreria JavaScript che converte Markdown a HTML.  
SaferPlaces la usa per renderizzare markdown nei messaggi chat.  
*Utilizzo*: `marked.parse(markdown_string)` → HTML string  
*Link*: https://marked.js.org  
*Vedi anche*: Chat, HTML, Rendering

### Material Design Icons
Libreria di icone di Google.  
SaferPlaces le include via `<link href=\"...Material+Symbols+Outlined\">`  
*Utilizzo*: `<span class=\"material-symbols-outlined\">icon_name</span>`  
*Link*: https://fonts.google.com/icons  
*Vedi anche*: Icon, UI

### Modal
Dialog box sovrapposto al resto dell'interfaccia.  
In SaferPlaces: Layer Register Modal (registrazione layer in progetto).  
*CSS*: `.modal-overlay.hidden` per controllo visibilità  
*Vedi anche*: UI, Overlay, Dialog

### Module Pattern
Pattern JavaScript che encapsula private state e espone public API.  
Implementato con IIFE: `const MyModule = (() => { return{ init } })();`  
*Vantaggi*: Namespace management, data privacy, singleton pattern  
*Vedi anche*: IIFE, Encapsulation, Scope

---

## N

### Namespace
Logico raggruppamento di funzionalità sotto un nome univoco.  
SaferPlaces componenti sono namespaced: `GeoMap.init()`, `LayerPanel.init()`, etc.  
*Vedi anche*: Module, Scope

---

## P

### Partial (HTML Partial)
Frammento HTML che viene caricato dinamicamente in pagina.  
Tutti i componenti SaferPlaces hanno partial in `public/partials/`.  
*Caricamento*: `<div data-include=\"path/partial.html\"></div>` → ricorsivamente caricato da app.js  
*Vantaggi*: Separazione UI concerns, manutenibilità  
*Vedi anche*: SPA, Component, Lazy Loading

### Payload (Dati Payload)
Dati effettivi trasportati in una richiesta/risposta.  
*Esempio*: Il body JSON di una POST request è il payload  
*Utilizzo in SaferPlaces*: `dispatch('event', { detail: payload })`  
*Vedi anche*: API, CustomEvent, Request

### Project (Progetto)
Unità di lavoro per un utente in SaferPlaces.  
Contiene: layer registrati, thread chat, draw features.  
*Persistenza*: Salvato su backend  
*Storage locale*: `localStorage['project_id']`  
*Vedi anche*: User, Thread, Layer

### Prompt (AI Prompt)
Testo che l'utente invia all'AI Agent per richiedere azione.  
*Utilizzo*: Inviato in POST body a `/t/{threadId}`  
*Risposte possibili*: Messaggio di testo, tool_calls, stato updates  
*Vedi anche*: Chat, AIChat, Tool Calls

---

## R

### Raster
Tipo di dato geografico basato su grid di celle (pixel).  
Ogni cella contiene valore (es. elevazione, temperatura, pioggia).  
*Formati*: GeoTIFF, COG, NetCDF  
*OppostoVector  
*Vedi anche*: COG, Raster vs Vector, Layer

### REST (Representational State Transfer)
Stile architetturale per API web.  
Usa HTTP methods (GET, POST, PUT, DELETE) su URL resources.  
SaferPlaces backend espone REST API: `/user`, `/t/{id}`, `/t/{id}/layers`, etc.  
*Prin Principi*: Stateless, cacheable, client-server  
*Vedi anche*: API, HTTP, Endpoint

### Render (Renderizzazione)
Processo di elaborazione dati per produrre output visualizzabile.  
In SaferPlaces: 
- \"Render layer\": Backend processa GeoJSON/COG e ritorna URL finale
- \"Render map\": MapLibre visualizza layer su canvas WebGL
*Vedi anche*: Backend, Map, Visualization

### Route (Route, Rotta di API)
URL specifico di un endpoint API.  
In SaferPlaces: definite in `_consts.js` come `Routes.Agent.*`  
*Esempio*: `Routes.Agent.LAYERS(threadId)` → `/t/{threadId}/layers`  
*Vedi anche*: Endpoint, API, URL

---

## S

### SPA (Single Page Application)
Applicazione web che carica una sola pagina HTML, poi aggiorna dinamicamente via JavaScript.  
SaferPlaces è SPA: index.html caricato una volta, resto via JavaScript/CSS.  
*Vantaggi*: Smooth UX, no page reloads, veloce  
*Opposto*: MPA (Multi Page App)  
*Vedi anche*: Frontend, JavaScript, Partial

### Scope (Scope JavaScript)
Contesto visibilità variabili.  
*Tipi*: Global, function, block scope  
*SaferPlaces*: Usa IIFE per creare private scope per moduli  
*Vedi anche*: IIFE, Module, Closure

### State (Stato)
Insieme di dati che rappresenta condizione corrente della app/componente.  
SaferPlaces distribuisce stato in tre layer:
1. localStorage (persistent): user_id, project_id, thread_id
2. In-memory (moduli): map state, chat messages, draw features
3. Browser session: panel open/closed, UI selections  
*Vedi anche*: Data, Persistence, localStorage

### Sidebar
Pannello laterale di interfaccia.  
In SaferPlaces:
- Layer Panel (sx): lista layer progetto
- User Panel (sx): info utente, progetti, logout  
*CSS*: `.sidebar`, `.user-sidebar` (fixed, height: 100vh)  
*Vedi anche*: Panel, UI,Layout

### Stile Mappa (Map Style)
Definizione visuale di come renderizzare mappa (colori, font, layer).  
Formato JSON conforme MapBox GL spec.  
Esempi in SaferPlaces dropdown: Carto Positron, Dark Matter, MapTiler Satellite, etc.  
*Vedi anche*: MapLibre, Design, Customization

---

## T

### Thread (Thread di Conversazione)
Session conversazione con AI Agent backend.  
Identificato da: `thread_id`  
Contiene: cronologia messaggi, stato app, tool calls  
*Storage*: localStorage + Backend DB  
*Vedi anche*: AIChat, User, Project

### Toast (Notifica Toast)
Piccola notifica temporanea che appare nello schermo (solitamente bottom).  
In SaferPlaces:
- Operazione in corso (spinner)
- Successo (✓ icon, auto-close in 2s)
- Errore (messaggio, auto-close in 600ms)  
*Componente*: `Toasts` JavaScript module  
*Vedi anche*: Notification, UI, UX

### Tool Calls
Richieste che l'AI Agent vuole eseguire (strutturate come funzioni/metodi).  
*Esempio*: `{ name: \"add_layer\", args: { url: \"...\", type: \"vector\" } }`  
*Gestione*: Frontend riceve tool_calls e li visualizza/elabora  
*Vedi anche*: Chat, AI, Backend

### Topbar
Barra di controlli superiore della interfaccia.  
In SaferPlaces: contiene style selector + draw toolbar.  
*CSS*: `.topbar` (fixed, top: 16px, z-index: 5, 80% width, centered)  
*Vedi anche*: Toolbar, UI, Layout

---

## U

### UI (User Interface)
Interfaccia utente visuale.  
SaferPlaces UI: dark theme, glassmorphic panels, Bootstrap components  
*Componenti*: buttons, input, sidebar, chat, map, modals  
*Vedi anche*: UX, Design, Frontend

### UX (User Experience)
Esperienza complessiva dell'utente interagendo con l'app.  
Includes: usability, responsiveness, feedback, accessibility  
*Vedi anche*: UI, Design, Accessibility

### User
Persona che utilizza l'applicazione.  
Identificata da: `user_id` (string, es. \"tommaso.r\")  
Autorizzazioni: accesso ai propri project/thread  
*Storage*: localStorage + Backend DB  
*Vedi anche*: Authentication, Project, Thread

### URL
Indirizzo risorsa web.  
*Componenti*: protocol (http://), domain, path, query params  
*Vedi anche*: HTTP, Endpoint, REST

---

## V

### Vanilla JS
JavaScript puro senza framework (React, Vue, Angular, etc.).  
SaferPlaces è completamente Vanilla JS + standard APIs.  
*Vantaggi*: No overhead, full control, small bundle size  
*Challengevalles*: No hot-reload, manual state management, more boilerplate  
*Vedi anche*: JavaScript, Frontend, EcmaScript

### Vector
Tipo di dato geografico basato su geometrie (punti, linee, poligoni).  
Ogni geometria ha attributi associati (properties).  
*Format*: GeoJSON è standard vector format  
*Opposto*: Raster  
*Vedi anche*: GeoJSON, Feature, Layer

### Viewport
Area visibile della mappa.  
Definito da: center point, zoom level, rotation, pitch  
*Manipolazione*: map.flyTo(), map.fitBounds(), map.zoomToBounds()  
*Vedi anche*: Map, BBox, Zoom

---

## W

### WebGL
API JavaScript per 3D/2D graphics rendering via GPU.  
MapLibre GL lo usa per rendering veloce di mappe vettoriali.  
*Browser support*: Tutti i moderni browser  
*Vedi anche*: MapLibre, Rendering, Graphics

### Web Workers (Discussione per Future)
JavaScript thread separato per operazioni pesanti.  
SaferPlaces non li utiliza attualmente.  
*Possibile use case*: Big GeoJSON parsing  
*Vedi anche*: Performance, JavaScript

---

## X

### XSS (Cross-Site Scripting)
Vulnerabilità di sicurezza dove malicious script viene eseguito nel browser utente.  
SaferPlaces mitiga:
- Usando `innerHTML` con parsed/validated content
- Escaping HTML in Toast (`Toasts.escapeHtml()`)
- Avoiding `eval()` e similar unsafe functions  
*Vedi anche*: Security, Sanitization

---

## Z

### Zip (Compressione)
Algoritmo di compressione file.  
SaferPlaces assets compressi minuti su CDN (gzip compression).  
*Vedi anche*: Performance, Deployment

### Zoom (Zoom della Mappa)
Livello di zoom della visualizzazione mappa.  
*Range*: Normalmente 0-28 (0 = mondo intero, 28 = street level)  
*Utilizzo*: `map.setZoom(10)`, `map.zoomTo(point)`, `map.fitBounds()`  
*Vedi anche*: Map, Viewport, Navigation

---

## Acronimi Frequenti

| Acronimo | Significato |
|----------|------------|
| API | Application Programming Interface |
| AI | Artificial Intelligence |
| BBox | Bounding Box |
| CDN | Content Delivery Network |
| COG | Cloud Optimized GeoTIFF |
| CSS | Cascading Style Sheets |
| DOM | Document Object Model |
| ES | EcmaScript (JavaScript standard) |
| HTML | HyperText Markup Language |
| HTTP | HyperText Transfer Protocol |
| IIFE | Immediately Invoked Function Expression |
| JSON | JavaScript Object Notation |
| SPA | Single Page Application |
| UI | User Interface |
| UX | User Experience |
| XSS | Cross-Site Scripting |

---

## Risorse Esterne

- **MDN Web Docs**: https://developer.mozilla.org
- **MapLibre Docs**: https://maplibre.org
- **Bootstrap Docs**: https://getbootstrap.com
- **GeoJSON Spec**: https://geojson.org
- **Web APIs**: https://web.dev

---

**Fine Documentazione Completa**

Per domande o chiarimenti su termini specifici, consulta il documento relativo della documentazione principale.

