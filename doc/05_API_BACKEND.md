# 05 - API Backend e Integrazione

Documentazione degli endpoint REST del backend Flask che il frontend utilizza.

---

## 🌍 Base URL

Definito in `public/js/_consts.js`:

```javascript
const Routes = (() => {
    const Agent = (() => {
        let flask_base = '';                                    // Production
        let localhost_base = 'http://localhost:5000';          // Development
        let agent_base = 'agent';                              // API prefix
        let ngrock_base = 'https://bdc1201eff1b.ngrok-free.app'; // Remote tunnel

        const BASE = flask_base;  // Usa production per default
        
        return {
            BASE,
            NEWTHREAD: `${BASE}/t`,
            THREAD: (threadId) => `${BASE}/t/${threadId}`,
            USER: `${BASE}/user`,
            STATE: (threadId) => `${BASE}/t/${threadId}/state`,
            LAYERS: (threadId) => `${BASE}/t/${threadId}/layers`,
            RENDER: (threadId) => `${BASE}/t/${threadId}/render`,
            LAYER_URL: `${BASE}/get-layer-url`
        };
    })();

    return { Agent };
})();
```

### URLs Enumerate

| Endpoint | URL | Uso |
|----------|-----|-----|
| User verify | `/user` | Verificare user_id, lista progetti |
| New/Resume thread | `/t` | Creare o riprendere thread |
| Get thread | `/t/{id}` | Info thread |
| Get state | `/t/{id}/state` | Stato thread |
| Get layers | `/t/{id}/layers` | Lista layer progetto |
| Render layer | `/t/{id}/render` | Processare e renderizzare layer |
| Get layer URL | `/get-layer-url` | URL firmato per download |

---

## 📍 POST /user

Verifica utente e lista progetti.

### Request

```javascript
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: 'tommaso.r'
    })
}
```

### Response (200 OK)

```json
{
    \"user_id\": \"tommaso.r\",
    \"projects\": [
        \"project-001\",
        \"project-002\",
        \"dev-test\"
    ]
}
```

### Response (400 Bad Request)

```json
{
    \"error\": \"user_id is required\"
}
```

### Utilizzo Frontend

```javascript
// In AuthGate.verifyUser()
const res = await fetch(Routes.Agent.USER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
});
const data = await res.json();
// data.user_id, data.projects[]
```

---

## 🧵 POST /t

Creare nuovo thread o riprendere thread esistente.

### Request - Nuovo Thread

```javascript
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: 'tommaso.r',
        project_id: 'project-001'
    })
}
```

### Request - Resume Thread

```javascript
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        thread_id: 'thread_abc123',
        user_id: 'tommaso.r',
        project_id: 'project-001'
    })
}
```

### Response (200 OK)

```json
{
    \"thread_id\": \"thread_abc123\",
    \"user_id\": \"tommaso.r\",
    \"project_id\": \"project-001\",
    \"created_at\": \"2024-02-01T10:30:00Z\",
    \"status\": \"active\"
}
```

### Utilizzoinizio Frontend

```javascript
// In AuthGate.proceed()
const res = await fetch(Routes.Agent.NEWTHREAD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: currentUser,
        project_id: selectedProject
    })
});
const data = await res.json();
localStorage.setItem('thread_id', data.thread_id);
```

---

## 💬 POST /t/{threadId}

Invia messaggio all'AI Agent e ricevi risposta(s).

### Request

```javascript
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        prompt: 'Show me flood data for Rome',
        settings?: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2000
        }
    })
}
```

### Response (200 OK)

Array di messaggi/tool_calls (possibile streaming):

```json
[
    {
        \"role\": \"user\",
        \"content\": \"Show me flood data for Rome\"
    },
    {
        \"role\": \"assistant\",
        \"content\": \"I'll retrieve flood data for Rome...\"
    },
    {
        \"role\": \"assistant\",
        \"tool_calls\": [
            {
                \"id\": \"call_xyz\",
                \"name\": \"add_layer\",
                \"args\": {
                    \"url\": \"https://..../floods_rome.geojson\",
                    \"type\": \"vector\"
                }
            }
        ]
    },
    {
        \"role\": \"tool\",
        \"tool_use_id\": \"call_xyz\",
        \"content\": \"Layer added successfully\"
    },
    {
        \"role\": \"assistant\",
        \"content\": \"Flood data loaded. Red areas show high risk zones.\"
    }
]
```

### Utilizzo Frontend

```javascript
// In AIChat.send()
const thread_id = localStorage.getItem('thread_id');
const res = await fetch(Routes.Agent.THREAD(thread_id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: message })
});
const data = await res.json();

// data è array di messages/tool_calls
data.flat()
    .filter(d => d.role != 'user')
    .forEach(element => {
        if (element.tool_calls) {
            // Visualizza tool calls
            element.tool_calls.forEach(call => appendToolCall(call));
        } else {
            // Visualizza messaggio
            appendBubble(element.content, element.role);
        }
    });
```

---

## 📋 POST /t/{threadId}/layers

Ottieni lista dei layer registrati nel progetto.

### Request

```javascript
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
    // body: vuoto (opzionale)
}
```

### Response (200 OK)

```json
[
    {
        \"id\": \"layer_001\",
        \"title\": \"Flood Risk Areas\",
        \"description\": \"DPC flood simulation 2024-02-01\",
        \"type\": \"vector\",
        \"src\": \"https://.../floods.geojson\",
        \"created_at\": \"2024-02-01T08:00:00Z\",
        \"visibility\": true
    },
    {
        \"id\": \"layer_002\",
        \"title\": \"Rainfall Radar\",
        \"description\": \"\",
        \"type\": \"raster\",
        \"src\": \"https://.../rain.tif\",
        \"metadata\": {
            \"colormap\": \"viridis\",
            \"min\": 0,
            \"max\": 200
        },
        \"created_at\": \"2024-02-01T09:15:00Z\",
        \"visibility\": false
    }
]
```

O:

```json
{
    \"layers\": [/* array */]
}
```

### Errori Comuni

```json
{
    \"error\": \"thread_id not found\"
}
```

### Utilizzo Frontend

```javascript
// In LayerPanel.reloadProjectLayers()
const thread_id = localStorage.getItem('thread_id');
const res = await fetch(Routes.Agent.LAYERS(thread_id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});
const data = await res.json();
const layers = Array.isArray(data) ? data : data.layers || [];
renderLayerList(layers);
```

---

## 🎨 POST /t/{threadId}/render

Processa un layer e ritorna URL renderizzato.

### Request

```javascript
{
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        layer_data: {
            src: \"https://example.com/data.geojson\",
            title: \"My Layer\",
            type: \"vector\",
            register: true,  // Salva in progetto se true
            description?: \"Optional description\"
        }
    })
}
```

### Response (200 OK)

```json
{
    \"src\": \"https://.../rendered/floods_234.geojson\",
    \"format\": \"geojson\",
    \"bbox\": [12.1, 41.7, 12.9, 41.95],
    \"feature_count\": 245,
    \"status\": \"ready\"
}
```

Oppure per COG raster:

```json
{
    \"src\": \"https://.../rendered/rainfall_001.tif\",
    \"format\": \"tiff\",
    \"bbox\": [12.1, 41.7, 12.9, 41.95],
    \"metadata\": {
        \"colormap\": \"viridis\",
        \"min\": 0,
        \"max\": 120,
        \"epsg\": 4326
    },
    \"status\": \"ready\"
}
```

### Possibili Risposte di Errore

```json
{
    \"error\": \"Invalid source URL\",
    \"code\": 400
}
```

```json
{
    \"error\": \"Unsupported format\",
    \"code\": 422
}
```

### Utilizzo Frontend

```javascript
// In GeoMap.addVectorLayer()
const res = await fetch(Routes.Agent.RENDER(thread_id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layer_data })
});
if (!res.ok) throw new Error('render-layer HTTP ' + res.status);

const info = await res.json();
const renderUrl = info.src;

// Scarica il GeoJSON rendererizzato
const geojsonData = await fetch(renderUrl).then(r => r.json());

// Aggiungi a mappa
map.addSource(id, { type: 'geojson', data: geojsonData });
map.addLayer({ /* ... */ });
```

---

## 📍 GET /get-layer-url

Ottieni URL firmato per download da backend (se protetto).

### Request

```javascript
{
    method: 'GET',
    headers: { 
        'Authorization': 'Bearer ' + localStorage.getItem('thread_id')
    }
}
```

### Query Parameters (opzionali)

- `layer_id`: ID del layer specifico
- `format`: `geojson`, `shapefile`, `geotiff`, etc.

### Response (200 OK)

```json
{
    \"url\": \"https://.../signed-download?token=abc123&expires=1234567890\",
    \"expires_at\": \"2024-02-02T10:30:00Z\"
}
```

### Utilizzo Frontend

```javascript
// In LayerPanel (azione download)
const url = await fetch(Routes.Agent.LAYER_URL, {
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('thread_id')
    }
}).then(r => r.json()).then(d => d.url);

window.open(url, '_blank');
```

---

## 🔄 Flussi API Completi

### Flusso 1: Login e Load Progetto

```
1. User inserisce user_id
   └─ POST /user
      └─ { user_id, projects[] }
   
2. User seleziona progetto
   └─ POST /t
      └─ { thread_id, user_id, project_id }
   
3. localStorage savato
   └─ user_id, project_id, thread_id
   
4. LayerPanel chiede layer
   └─ POST /t/{threadId}/layers
      └─ [ { id, title, src, type }, ... ]
```

### Flusso 2: Aggiunta Layer Automatica

```
1. User aggiunge layer via AIChat o LayerPanel
   └─ dispatch('layer:add-geojson', { layer_data })
   
2. GeoMap.addVectorLayer()
   └─ POST /t/{threadId}/render
      └─ { src: \"processed_url\" }
   
3. Scarica GeoJSON processato
   └─ fetch(processedUrl)
      └─ GeoJSON feature collection
   
4. map.addSource() + map.addLayer()
   └─ Layer visualizzato
   
5. (opzionale) Se register=true:
   └─ POST /t/{threadId}/render + register flag
      └─ Backend salva in DB progetto per persistenza
```

### Flusso 3: Chat AI Completo

```
1. User invia messaggio
   └─ POST /t/{threadId}
      └─ body: { prompt: \"message\" }
   
2. Backend (AI Agent) elabora
   └─ Potrebbe generate tool_calls
      └─ (e.g., \"add_layer\" con parametri)
   
3. Response: array di messages + tool_calls
   └─ Frontend visualizza messaggi
   └─ Per ogni tool_call:
      └─ Se \"add_layer\":
         └─ GeoMap.addVectorLayer()/addCOG()
         └─ Che a sua volta POST /render
      └─ Se \"query_database\":
         └─ Backend risponde con data
         └─ Frontend mostra in messaggio
   
4. AI nota layer aggiunto:
   └─ dispatch('layer:reload-project-layers')
   └─ POST /t/{threadId}/layers
   └─ LayerPanel mostra layer aggiornato
```

---

## 🔐 Autenticazione e Autorizzazione

### Metodo Corrente

**Stateless token-based**:

- `thread_id` agisce come token
- Salvato in `localStorage`
- Inviato nelle richieste POST/GET

```javascript
// Header opzionale (se backend lo verifica)
headers: {
    'X-Thread-ID': localStorage.getItem('thread_id'),
    'X-User-ID': localStorage.getItem('user_id')
}
```

### Limitazioni Attuali

- No JWT
- No session expire
- No CSRF protection
- localStorage vulnerability (XSS)

### Miglioramenti Futuri

- [ ] JWT con refresh token
- [ ] HttpOnly cookies
- [ ] CSRF tokens
- [ ] Rate limiting
- [ ] API key per accesso esterno

---

## 📊 Contratti Dati

### Layer Object

```typescript
interface Layer {
    id: string;                    // Identificativo univoco
    title: string;                 // Nome visualizzabile
    description?: string;          // Descrizione opzionale
    type: 'vector' | 'raster';    // Tipo geometria
    src: string;                   // URL risorsa
    format?: 'geojson' | 'tiff';  // Format esplicito
    register: boolean;             // Se salvato in DB progetto
    created_at?: string;           // ISO 8601 timestamp
    visibility?: boolean;          // Se visibile su mappa
    metadata?: {                   // Metadata extra
        colormap?: string;         // Per raster: opzioni colore
        min?: number;              // Min value per raster
        max?: number;              // Max value per raster
        epsg?: number;             // EPSG code (default 4326)
    };
}
```

### Message Object (Chat)

```typescript
interface Message {
    id?: string;
    role: 'user' | 'assistant' | 'tool' | 'interrupt';
    content?: string;
    tool_calls?: ToolCall[];
    tool_use_id?: string;
    state_updates?: {
        user_drawn_shapes?: Feature[];
        [key: string]: any;
    };
}

interface ToolCall {
    id: string;
    name: string;
    args: Record<string, any>;
}
```

### Error Response

```json
{
    \"error\": \"string descrizione errore\",
    \"code\": \"error_code\",
    \"status\": 400,
    \"details\": {
        \"field\": \"error message\"
    }
}
```

---

## 🔄 HTTP Status Codes

| Code | Significato | Azione Frontend |
|------|-------------|-----------------|
| 200 | OK | Prosegui |
| 201 | Created | Refresh data |
| 400 | Bad Request | Valida input, mostra errore |
| 401 | Unauthorized | Redirect auth gate |
| 403 | Forbidden | Nega accesso |
| 404 | Not Found | Mostra \"not found\" |
| 422 | Unprocessable Entity | Valida dati |
| 500 | Server Error | Retry o mostra errore |
| 503 | Service Unavailable | Retry con backoff |

---

## 🧪 Testing Endpoint

### Curl Examples

```bash
# Verifica utente
curl -X POST http://localhost:5000/user \\
  -H 'Content-Type: application/json' \\
  -d '{\"user_id\": \"tommaso.r\"}'

# Crea thread
curl -X POST http://localhost:5000/t \\
  -H 'Content-Type: application/json' \\
  -d '{\"user_id\": \"tommaso.r\", \"project_id\": \"project-001\"}'

# Invia messaggio
curl -X POST http://localhost:5000/t/thread_xyz \\
  -H 'Content-Type: application/json' \\
  -d '{\"prompt\": \"Show flood data\"}'

# Lista layer
curl -X POST http://localhost:5000/t/thread_xyz/layers \\
  -H 'Content-Type: application/json'
```

---

## 📝 Versionamento API

Versione backend corrente: **0.2.6**

Break changes non gestite nel frontend per ora:
- [ ] Versioning header richiesto
- [ ] Deprecation warnings
- [ ] Migration guide

---

**Prossimo Step**: Vedi `06_STYLING_UI.md` per design, CSS e componenti Bootstrap.
