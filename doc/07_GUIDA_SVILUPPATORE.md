# 07 - Guida per Sviluppatore

Istruzioni per estendere, modificare e debuggare l'applicazione.

---

## 🚀 Setup Locale

### Prerequisiti

- Browser moderno (Chrome 90+, Firefox 88+, Safari 14+)
- Node.js 16+ (opzionale, per build tools)
- Python 3.8+ (per backend)
- Git

### Clonare il Repo

```bash
git clone https://github.com/your-org/saferplaces-agent-frontend.git
cd saferplaces-agent-frontend
```

### Avviare il Frontend

**Opzione 1: Simple HTTP Server**

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000

# Poi visita: http://localhost:8000
```

**Opzione 2: Docker**

```bash
docker-compose up
# Accedi a http://localhost
```

**Opzione 3: Nginx (Production-like)**

```bash
# Modifica nginx.local.conf per dev setup
nginx -c nginx.local.conf
```

### Configurare Backend

Modifica `public/js/_consts.js`:

```javascript
const BASE = 'http://localhost:5000';  // Punta al tuo backend
```

Oppure usa proxy nginx (vedi `nginx.local.conf`).

---

## 🔄 Workflow di Sviluppo

### 1. Aggiungere Nuovo Componente

#### Step 1: Creare il modulo JS

File: `public/js/my-component.js`

```javascript
const MyComponent = (() => {
    let container;

    function init() {
        container = document.getElementById('myComponentContainer');
        if (!container) {
            console.error('MyComponent container not found');
            return;
        }

        // Setup UI listeners
        setupEventListeners();

        // Subscribe to custom events
        document.addEventListener('some:event', handleEvent);
    }

    function setupEventListeners() {
        // Esempio: click listener
        container.querySelector('button')?.addEventListener('click', () => {
            // Azione qui
            dispatch('custom:event', { data: 'value' });
        });
    }

    function handleEvent(e) {
        const { data } = e.detail;
        // Gestisci evento
    }

    function cleanup() {
        // Cleanup se necessario (remove event listener, etc.)
    }

    return {
        init,
        cleanup,
        // Esponi API pubblica
        publicMethod: () => { }
    };
})();
```

#### Step 2: Creare il partial HTML

File: `public/partials/my-component.html`

```html
<section id="myComponentContainer">
    <h3>My Component</h3>
    <button id="myBtn">Click me</button>
    <div id="myContent"></div>
</section>
```

#### Step 3: Creare il CSS

File: `public/css/my-component.css`

```css
#myComponentContainer {
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

#myComponentContainer button {
    /* Stili bottone */
}
```

#### Step 4: Aggiungere a index.html

```html
<!-- In <head>, link CSS -->
<link href=\"public/css/my-component.css\" rel=\"stylesheet\">

<!-- In <body>, include partial -->
<div data-include=\"public/partials/my-component.html\"></div>

<!-- In <body>, carica JS -->
<script src=\"public/js/my-component.js\"></script>
```

#### Step 5: Inizializzare in app.js

```javascript
// In include and init function
MyComponent.init();

// Wiring CustomEvent (opzionale)
document.addEventListener('some:event', e => {
    MyComponent.handleEvent(e);
});
```

#### Step 6: Test

1. Apri browser DevTools (F12)
2. Controlla console per errori
3. Test interazione
4. Test responsiveness

---

## 🐛 Debugging

### Logging Tecnica

```javascript
// Buono: console.log per debug
console.log('[MyComponent] Initializing...', { container });

// Buono: console.error per errori
console.error('[MyComponent] Failed to load:', err);

// Cattivo: console.log senza contexto
console.log(container);
console.log(data);
```

### DevTools Breakpoints

**Chrome/Firefox DevTools**:

1. Apri Sources tab
2. Naviga al file JS
3. Clicca numero linea per breakpoint
4. Ricarica pagina
5. Esecuzione pausa a breakpoint
6. Inspeziona variabili, step over/into

### Memory Leaks

Verifica in Chrome DevTools:

```javascript
// ✓ Corretto: Listener registrato in init, rimosso in destroy
function init() {
    button.addEventListener('click', handleClick);
}

function cleanup() {
    button.removeEventListener('click', handleClick);
}

// ✗ Leak: Listener registrato più volte
function handleClick() {
    button.addEventListener('click', handleClick);  // INFINITE LOOP!
}
```

### Monitorare Network Calls

1. DevTools → Network tab
2. Ricarica pagina
3. Osserva requests
4. Filtra per tipo (XHR, Fetch)
5. Ispeziona Request/Response headers e body

---

## 🧪 Testing (No Framework)

### Manual Testing Checklist

```
Auth Flow:
☐ Login con user_id valido
☐ Login con user_id non-valido (errore?)
☐ Switch tra progetti
☐ Logout pulisce localStorage

Layer Management:
☐ Aggiungi layer vector (GeoJSON)
☐ Aggiungi layer raster (COG)
☐ Layer appare su mappa
☐ Toggle visibilità layer
☐ Cancella layer

Drawing:
☐ Disegna punto
☐ Disegna bbox
☐ Disegna poligono
☐ Edit bbox (drag corner)
☐ Delete feature

Chat:
☐ Invia messaggio
☐ Ricevi risposta AI
☐ Comandi locali (/dark, /reset)
☐ Tool calls visualizzati

Time Slider:
☐ Play/Pausa
☐ Cambia velocità
☐ Drag handle
☐ Map update when timestamp cambia

Map:
☐ Zoom/Pan funziona
☐ Switch stile mappa
☐ Reset view torna a Roma
☐ Buildings 3D visibili
```

### Console Tests (Vanilla)

```javascript
// Test dispatch event
document.dispatchEvent(new CustomEvent('test:event', {
    detail: { msg: 'Hello' }
}));

// Monitora eventi
document.addEventListener('test:event', e => {
    console.log('Event fired:', e.detail);
});

// Test localStorage
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test'));  // 'value'
localStorage.removeItem('test');

// Test fetch
fetch('http://localhost:5000/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 'test' })
}).then(r => r.json()).then(d => console.log(d));

// Test DOM selection
console.log(document.getElementById('map'));
console.log(document.querySelectorAll('.btn'));
```

---

## ✍️ Code Style Guide

### Naming Convention

```javascript
// Variables: camelCase
const userIdInput = document.getElementById('...');
let isDrawing = false;

// Constants: UPPER_SNAKE_CASE
const MAX_ZOOM = 19;
const LS_USER = 'user_id';

// Functions: camelCase
function initializeComponent() { }

// Events: lowercase:kebab-case
dispatch('layer:add-geojson', { ... });

// Classes: PascalCase (rare in vanilla)
class GeoDataParser { }

// CSS classes: lowercase-kebab-case
className = 'my-component-active'
```

### Comments

```javascript
// ✓ Buono: Commento significativo
// Ritarda il caricamento della mappa fino a quando il DOM è pronto
map.on('load', () => {
    DrawTools.init(map);
});

// ✓ Buono: TODO per future improvements
// TODO: Aggiungere retry logic per fallimenti network

// ✗ Cattivo: Commento ovvio
// Set value to 1
let x = 1;

// ✗ Cattivo: Commento fuori sincro
// Add event listener to button  ← Ma il codice è su input
input.addEventListener('change', handleChange);
```

### Error Handling

```javascript
// ✓ Buono: Try-catch con logging
try {
    const data = JSON.parse(response);
    processData(data);
} catch (err) {
    console.error('[ComponentName] Failed to parse response:', err);
    Toasts.error(t, 'Failed to process data');
}

// ✓ Buono: Check validity
if (!layer_data || !layer_data.src) {
    console.error('Invalid layer_data structure');
    return;
}

// ✗ Cattivo: Swallow errors
try {
    doSomething();
} catch (err) {
    // Silent fail, no log
}
```

### Async/Await

```javascript
// ✓ Buono: Async-await leggibile
async function loadLayers() {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Failed to load layers:', err);
        Toasts.error(t, 'Loading failed');
    }
}

// ✓ Accettabile: Promise chain
fetch(url)
    .then(r => r.json())
    .then(data => processData(data))
    .catch(err => console.error(err));

// ✗ Cattivo: Callback hell
fetch(url, (err, res) => {
    if (err) {
        fetch(url2, (err2, res2) => {
            // Deeply nested
        });
    }
});
```

---

## 📦 Dependency Management

### Vendor Libraires (CDN)

Definiti in `index.html`:

```html
<!-- Bootstrap CSS -->
<link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css\">

<!-- MapLibre GL -->
<link href=\"https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css\">

<!-- JS -->
<script src=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js\"></script>
<script src=\"https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.js\"></script>
```

### Aggiungere Nuova Libreria

1. **Valuta alternativa vanilla**: Spesso non serve framework
2. **Se necessario**: Aggiungi via CDN in `index.html`
3. **Documenta**: Commenta il perché e che versione
4. **Test**: Verifica compatibilità browser

#### Esempio: Aggiungere Chart Library

```html
<!-- In <head> -->
<link href=\"https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.css\">

<!-- In <body>, prima di app.js -->
<script src=\"https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js\"></script>

<!-- Poi usa in JS -->
<script src=\"public/js/charts-component.js\"></script>
```

---

## 🔧 Common Tasks

### Aggiungere Nuovo Bottone di Azione

```javascript
// In component.js init()
const actionBtn = document.getElementById('actionBtn');
actionBtn?.addEventListener('click', () => {
    console.log('Action clicked');
    dispatch('custom:action-clicked', { data: 'value' });
    Toasts.show('Azione in corso...');
});
```

```html
<!-- In component.html -->
<button id=\"actionBtn\" class=\"btn btn-success\">Action</button>
```

### Aggiungere Input Form

```javascript
// In component.js init()
const input = document.getElementById('myInput');
input?.addEventListener('change', e => {
    const value = e.target.value;
    console.log('New value:', value);
    // Valida, processa, etc.
});
```

```html
<!-- In component.html -->
<div class=\"mb-2\">
    <label class=\"form-label small\">Label</label>
    <input id=\"myInput\" class=\"form-control\" placeholder=\"Placeholder\">
</div>
```

### Aggiungere Modal/Dialog

```javascript
// In component.js
let modal;

function init() {
    modal = document.getElementById('myModal');
    document.getElementById('openModalBtn').addEventListener('click', openModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
}

function openModal() {
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
}
```

```html
<!-- In component.html -->
<div id=\"myModal\" class=\"modal-overlay hidden\">
    <div class=\"modal-content\">
        <div class=\"modal-header\">
            <h5>Modal Title</h5>
        </div>
        <div class=\"modal-body\">
            Content here
        </div>
        <div class=\"modal-footer\">
            <button id=\"closeModalBtn\" class=\"btn btn-secondary\">Close</button>
        </div>
    </div>
</div>

<button id=\"openModalBtn\" class=\"btn btn-primary\">Open</button>
```

### Aggiungere Custom CSS

```css
/* public/css/my-component.css */

#myComponent {
    display: flex;
    background: rgba(255, 255, 255, 0.05);
    padding: 16px;
    border-radius: 8px;
}

#myComponent button {
    transition: all 0.12s ease;
}

#myComponent button:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.08);
}

/* Responsive */
@media (max-width: 768px) {
    #myComponent {
        flex-direction: column;
        padding: 12px;
    }
}
```

---

## 🚢 Deployment

### Build for Production

```bash
# 1. Minify CSS (opzionale)
npm install -g csso-cli terser terser-webpack-plugin

# 2. Minify JS (opzionale)
terser public/js/*.js -o public/js/bundle.min.js

# 3. Minify HTML (opzionale)
npm install -g html-minifier
html-minifier --minify-js --minify-css public/index.html > dist/index.html

# 4. Copia in cartella dist
mkdir dist
cp -r public/* dist/
```

### Docker

```bash
# Build immagine Docker
docker build -t saferplaces-frontend:latest .

# Run container
docker run -p 80:80 saferplaces-frontend:latest

# Oppure con docker-compose
docker-compose -f docker-compose.yml up -d
```

### Nginx Configuration

Modifica `nginx.conf` per production:

```nginx
server {
    listen 80;
    server_name example.com;

    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    root /var/www/saferplaces-frontend/public;
    index index.html;

    # Proxy API calls a backend
    location /api {
        proxy_pass http://backend:5000;
    }

    # Serve static files
    location ~ \\.(js|css|png|jpg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control \"public, immutable\";
    }

    # Single Page App: index.html per tutte le route sconosciute
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📖 Documentazione

### Aggiungere Documentazione

```markdown
# Nuovo Componente

## Descrizione
Spiega cosa fa il componente

## API Pubblica
```javascript
// Mostra funzioni pubbliche
MyComponent.init()
MyComponent.doSomething()
```

## Utilizzo
Fornisci esempi

## Configurazione
Mostra opzioni configurabili
```

### Tenere Sincronizzata la Documentazione

When you modify:
1. Update relevant `.md` file in `doc/`
2. Update inline comments in JS
3. Update/add type hints (JSDoc comments)

---

## 🤝 Contribuire

### Workflow di Contribution

1. **Fork** il repo
2. **Create branch** per feature: `git checkout -b feature/my-feature`
3. **Commit** changes: `git commit -am 'Aggiungi new feature'`
4. **Push** branch: `git push origin feature/my-feature`
5. **Submit** Pull Request
6. **Code review** e merge

### Pull Request Checklist

```markdown
## Descrizione
Breve descrizione della change

## Type di Change
- [ ] Bug fix
- [ ] Nuova feature
- [ ] Breaking change
- [ ] Documentazione aggiornata

## Testing
- [ ] Testato localmente
- [ ] Niente console errors
- [ ] Responsive tested

## Screenshot (se UI change)
[Screenshot del cambiamento]
```

---

## 🎓 Risorse

### Documentazione Esterna

- [MDN Web Docs](https://developer.mozilla.org/)
- [MapLibre GL Docs](https://maplibre.org/maplibre-gl-js/)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.0/)
- [Marked.js](https://marked.js.org/)
- [CustomEvent API](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)

### Browser Support

- Chrome 76+
- Firefox 79+
- Safari 12+
- Edge 79+

### Performance Tips

1. **Lazy load images**: Usa `loading=\"lazy\"`
2. **Minimize repaints**: Batch DOM updates
3. **Throttle/Debounce**: Per mouse/resize events
4. **Cache API responses**: Se possibile
5. **Service Worker**: Per PWA functionality (future)

---

## ❓ FAQ

### Q: Qual è il workflow ideale per aggiungere un componente?

**A**: Seguire i 6 step nella sezione "Aggiungere Nuovo Componente". Test locale, commit, push, pull request.

### Q: Come debuggare problemi CORS?

**A**: Usa CORS proxy (vedi `nginx.conf` per API proxy). O congigura backend per acettare CORS headers.

### Q: Come aggiungere nuove icone?

**A**: UtilizzaMaterial Symbols Outlined (già incluso). Oppure aggiungi SVG inline o come font.

### Q: Supporta mobile?

**A**: Parzialmente. App è desktop-first. Responsive breakpoints esistono ma test limitato.

### Q: Come testare con backend locale?

**A**: Modifica `_consts.js` per puntare a `localhost:5000`. Assicurati CORS configurato.

---

## 📝 Conclusione

Seguire questa guida per mantenere codebase:
- Pulito e ordinato
- Facile da estendere
- Testato
- Documentato
- Scalabile

Happy coding! 🎉

---

**Ultimo Step**: Vedi `08_GLOSSARIO.md` per termini tecnici.
