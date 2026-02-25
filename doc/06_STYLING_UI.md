# 06 - Styling, CSS e Design di Interfaccia

Documentazione del sistema di stile, tema colori, e design dell'interfaccia utente.

---

## 🎨 Design System

### Filosofia di Design

- **Dark Theme First**: Tema scuro predefinito, ottimizzato per lettura notturna e mappe
- **Glassmorphism**: Effetto vetro opaco su pannelli e toolbar (blur + transparency)
- **Accessibility**: Testo chiaro, contrasto sufficiente, icone Material Design
- **Responsive**: Adattamento a mobile/tablet (limitato, test necessario)
- **Performance**: CSS minimal, niente animazioni pesanti

---

## 🎭 Tema Colori

### Palette Principale

```
Background:      #0f1115    (Very dark blue-gray)
├─ Used in:      html, body, .bg-dark
└─ Contrast:     16:1 con testo light

Text Primary:    #e8eaed    (Light gray-white)
├─ Used in:      body, .text-light
└─ Contrast:     15:1 con background

Foreground:      #0c0f14    (Slightly lighter than bg)
├─ Used in:      .form-control, .form-select, input
└─ Contrast:     Subtile per input focus

Border Base:     rgba(255,255,255,0.08-0.16)
├─ Used in:      input borders, card borders
└─ Effect:       Sottile, non invasivo
```

### Colori Accent (Semantic)

```
Accent Green:    #6ee7b7    (Emerald/Teal)
├─ Used in:      Success, primary button, layer fill
├─ Hover:        Lighter shade
└─ RGB:          110, 231, 183

Accent Blue:     #60a5fa    (Sky Blue)
├─ Used in:      Info, link, time highlights
└─ RGB:          96, 165, 250

Accent Red:      #f87171    (Light Red)
├─ Used in:      Danger, delete button, errors
└─ RGB:          248, 113, 113

Accent Yellow:   #facc15    (Amber)
├─ Used in:      Warning, attention
└─ RGB:          250, 204, 21

Accent Orange:   #fb923c    (Orange)
├─ Used in:      Secondary action, warning
└─ RGB:          251, 146, 60

Accent Purple:   #a78bfa    (Violet)
├─ Used in:      Tertiary accent
└─ RGB:          167, 139, 250
```

### Colori Layer su Mappa

Quando visualizzi geometrie sulla mappa:

```css
/* Polygon fill */ fill-color: #6ee7b7  (emerald, semi-transparent)
/* Line color */   line-color: #6ee7b7  (emerald)
/* Point color */  circle-color: #6ee7b7 (emerald)
/* Opacity */      0.25 per fill, 1.0 per stroke
```

---

## 📐 Tipografia

### Font Stack

```css
font-family: system-ui, 'Segoe UI', Roboto, 'Inter', Arial, sans-serif;
```

**Motivo**:
- `system-ui`: Font OS nativa (migliore rendering)
- Fallback: Web font comuni (Roboto su Android, SF Pro su iOS)
- Arial: Fallback universale

### Font Sizes

| Elemento | Size | Weight | Utilizzo |
|----------|------|--------|----------|
| Body | 14px | 400 | Testo standard |
| Small | 12px | 400 | Badge, label, helper text |
| H6 | 18px | 600 | Titoli card, heading |
| H5 | 20px | 600 | Titoli sezioni |
| H4 | 24px | 700 | Titoli principali |
| Code | 12px | 500 | `<code>`, `<pre>` |
| Input | 14px | 400 | Placeholder, value |

### Line Height

```css
line-height: 1.5; /* Body standard */
line-height: 1.2; /* Heading, compact */
line-height: 1.6; /* Large text, comfortable */
```

---

## 🎯 Componenti UI Principali

### Bottoni

```css
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    border: 1px solid;
    cursor: pointer;
    transition: transform 0.12s, background 0.12s, border-color 0.12s;
}

.btn:hover {
    transform: translateY(-1px);  /* Effetto lift */
    background: rgba(255, 255, 255, 0.07);
}

.btn:active {
    transform: translateY(0);     /* Reset lift */
}

.btn:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(110, 231, 183, 0.18);
}
```

#### Varianti Bottone

| Classe | Background | Border | Uso |
|--------|------------|--------|-----|
| `.btn-primary` | Accent Green | Green | Azione primaria |
| `.btn-success` | Accent Green | Green | Confirm, save |
| `.btn-secondary` | Semi-transparent white | White | Azione secondaria |
| `.btn-danger` | Accent Red | Red | Delete, destroy |
| `.btn-outline-light` | Transparent | Light gray | Tertiary, toggle |
| `.btn.dt-btn` | Custom (dt- prefix) | Custom | Draw toolbar |

### Card

```css
.card {
    background: rgba(255, 255, 255, 0.05);  /* Semi-transparent */
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 16px;
    backdrop-filter: none;  /* o blur(8px) per glass effect */
}
```

**Utilizzo**:
- Contenere sezioni logiche
- Info utente, progetti, settings
- Layer list items

### Input e Form

```css
.form-control,
.form-select {
    background-color: #0c0f14;    /* Foreground color */
    color: #e8eaed;               /* Text light */
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 14px;
}

.form-control:focus,
.form-select:focus {
    background-color: #0c0f14;
    border-color: rgba(110, 231, 183, 0.6);
    box-shadow: 0 0 0 3px rgba(110, 231, 183, 0.14);
    outline: none;
}
```

### Scrollbar Custom

```css
::-webkit-scrollbar {
    width: 6px;                                /* Larghezza vertical */
    height: 6px;                               /* Altezza horizontal */
}

::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);    /* Background track */
}

::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
}
```

---

## 🌐 Glassmorphism Effect

Effetto chiave del design: trasparenza + blur per pannelli flottanti.

```css
.glass {
    backdrop-filter: blur(8px);                /* Browser support: Modern browsers */
    background: rgba(18, 18, 20, 0.9);         /* 90% opaco, 10% trasparente */
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}
```

**Applicato a**:
- `.style-bar` (topbar stilista)
- `.draw-toolbar` (draw tools)
- Sidebar pannelli
- Toast notifiche
- Modal overlay

**Browser Support**:
- Chrome/Edge 76+
- Firefox 103+
- Safari 9+

---

## 📐 Layout Principale

### Fixed Positioning Strategy

```
┌─────────────────────────────────────┐
│  #map (fixed, inset: 0, z-index: 1) │  ← Full screen
├─────────────────────────────────────┤
│  .topbar (fixed, top: 16px,          │  ← Style selector + draw toolbar
│           left: 50%, z-index: 5)     │
│                                      │
│  .sidebar (fixed, left: 0,            │  ← Layer panel (left)
│            z-index: 4, closed/open)   │
│                                      │
│  .user-sidebar (fixed, left: 0,       │  ← User panel (left, exclusive)
│                 z-index: 4, closed)   │
│                                      │
│  #chatBox (fixed, bottom: 24px,       │  ← Chat AI (right)
│            right: 24px, z-index: 3)   │
│                                      │
│  #timeSlider (fixed, bottom: 24px,    │  ← Time slider (bottom)
│              left: 50%, z-index: 2)   │
│                                      │
│  #toastStack (fixed, bottom: 24px,    │  ← Notifiche (bottom-center)
│              left: 50%, z-index: 1000)│
└─────────────────────────────────────┘
```

### Z-Index Layers

```
1000      Toast stack
          ─────────────────
5         Topbar (style bar + draw)
4         Sidebars (layer/user)
3         Chat box
2         Time slider
1         Map
0         (background)
```

---

## 🎬 Animazioni

### Slide Up/Down (Toast)

```css
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideDown {
    from {
        opacity: 1;
        transform: translateY(0);
    }
    to {
        opacity: 0;
        transform: translateY(16px);
    }
}

.toast-item.show {
    animation: slideUp 0.3s ease-out;
}

.toast-item.hide {
    animation: slideDown 0.3s ease-in;
}
```

### Hover Effects

```css
.btn:hover {
    transform: translateY(-1px);
    /* 0.12s ease transition definita */
}

.dt-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.16);
    transform: translateY(-1px);
}

.layer-item:hover {
    background: rgba(255, 255, 255, 0.03);
}
```

### Transizioni

```css
/* Transition standard */
transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease;

/* Fade */
transition: opacity 0.3s ease;

/* Smooth */
transition: all 0.2s ease;
```

---

## 📱 Responsive Breakpoints

**Nota**: App attualmente è desktop-first, mobile testing limitato.

```css
/* Extra small devices */
@media (max-width: 576px) {
    /* Stack vertically */
    /* Reduce padding */
}

/* Small devices */
@media (max-width: 768px) {
    /* Adjust sidebar */
    /* Reduce font */
}

/* Medium devices */
@media (min-width: 768px) {
    /* Desktop layout */
}

/* Large devices */
@media (min-width: 1200px) {
    /* Increased spacing, larger text */
}
```

**Ideale per il futuro**: Testare e ottimizzare responsive.

---

## 📊 File CSS Breakdown

| File | Scopo | Linee |
|------|--------|-------|
| `base.css` | Stili globali, tema, font | ~80 |
| `index.css` | Layout principale, container | ~100 |
| `auth-gate.css` | Auth overlay, card | ~150 |
| `geo-map.css` | Mappa, topbar, draw toolbar | ~217 |
| `layer-panel.css` | Sidebar layer, collapse, item | ~200 |
| `user-panel.css` | User sidebar, info, progetto | ~150 |
| `ai-chat.css` | Chat box, bubble, input | ~200 |
| `ai-chat-settings.css` | Settings panel | ~100 |
| `draw-tools.css` | Draw buttons, panel | ~150 |
| `layer-register.css` | Modal registrazione | ~120 |
| `time-slider.css` | Time slider, track, highlights | ~180 |
| `toasts.css` | Toast notifiche | ~100 |
| **Total** | **~1700 linee** | |

---

## 🎯 Colori Specifici per Componente

### Sidebar (Layer Panel & User Panel)

```css
.sidebar, .user-sidebar {
    background: rgba(18, 18, 20, 0.9);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    width: 320px;
    height: 100vh;
}
```

### Badge (Layer count, status)

```css
.badge {
    display: inline-block;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    background: #6ee7b7;        /* Accent green */
    color: #0f1115;             /* Dark text su background chiaro */
}

.badge.bg-success {
    background: #6ee7b7;
}

.badge.bg-danger {
    background: #f87171;
}
```

### Draw Toolbar Buttons

```css
.dt-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: rgba(255, 255, 255, 0.04);
    color: #e8eaed;
    border-radius: 10px;
    transition: transform 0.12s ease, background 0.12s ease;
}

.dt-btn.active {
    box-shadow: 0 0 0 3px rgba(110, 231, 183, 0.14);
    border-color: rgba(110, 231, 183, 0.65);
}

.dt-btn.dt-danger {
    border-color: rgba(248, 113, 113, 0.25);
}

.dt-btn.dt-danger:hover {
    border-color: rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.10);
}

.dt-btn.dt-success {
    border-color: rgba(110, 231, 183, 0.45);
}

.dt-btn.dt-success:hover {
    background: rgba(110, 231, 183, 0.15);
}
```

### Chat Bubble

```css
.bubble {
    display: inline-block;
    max-width: 70%;
    padding: 12px 16px;
    border-radius: 12px;
    margin: 8px 0;
    word-wrap: break-word;
    font-size: 14px;
    line-height: 1.5;
}

.bubble.ai {
    background: rgba(110, 231, 183, 0.12);    /* Teal tint */
    color: #e8eaed;
    border: 1px solid rgba(110, 231, 183, 0.3);
    border-radius: 14px 14px 14px 0;         /* Curve right */
    align-self: flex-start;
}

.bubble.user {
    background: rgba(96, 165, 250, 0.15);     /* Blue tint */
    color: #e8eaed;
    border: 1px solid rgba(96, 165, 250, 0.3);
    border-radius: 14px 14px 0 14px;         /* Curve left */
    align-self: flex-end;
    margin-left: auto;
}

.bubble code {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 12px;
}

.bubble a {
    color: #60a5fa;
    text-decoration: underline;
}

.bubble a:hover {
    color: #93c5fd;
}
```

### Tool Call Details

```css
.tool-item {
    margin-top: 8px;
}

.tool-head {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 500;
}

.tool-head code {
    background: rgba(0, 0, 0, 0.2);
    padding: 2px 4px;
    border-radius: 3px;
    color: #facc15;             /* Highlight code */
}

.tool-id {
    font-size: 11px;
    color: rgba(232, 234, 237, 0.6);
    margin-top: 4px;
}

.tool-args {
    background: rgba(0, 0, 0, 0.2);
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 8px;
}
```

### Time Slider Track

```css
#tsTrack {
    position: relative;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    cursor: pointer;
}

#tsHandle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%) translateX(-50%);
    width: 16px;
    height: 16px;
    background: #6ee7b7;
    border-radius: 50%;
    cursor: grab;
    box-shadow: 0 2px 8px rgba(110, 231, 183, 0.3);
}

#tsHandle:active {
    cursor: grabbing;
}

.ts-highlights {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.ts-highlight-area {
    position: absolute;
    height: 100%;
    opacity: 0.5;
    border-radius: 3px;
}
```

---

## 🔧 CSS Utilities Importanti

### Visibilità

```css
.hidden {
    display: none !important;
}

.d-none {
    display: none;
}

.d-flex {
    display: flex;
}

.closed {
    display: none;              /* Sidebar/panel chiuso */
    height: 0 !important;
    overflow: hidden;
    .          transition: all 0.3s ease;
}

.closed:not(.opened) {
    opacity: 0;
    transform: translateX(-100%);
}
```

### Flexbox Layout

```css
.d-flex {
    display: flex;
}

.align-items-center {
    align-items: center;
}

.justify-content-center {
    justify-content: center;
}

.justify-content-between {
    justify-content: space-between;
}

.gap-2 {
    gap: 8px;
}

.gap-3 {
    gap: 12px;
}
```

### Spacing

```css
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.px-3 { padding-left: 12px; padding-right: 12px; }
.py-2 { padding-top: 8px; padding-bottom: 8px; }
```

---

## 🎨 Palette Colori Aria/SVG

Colores per layer visualizzati su mappa:

```javascript
// Nella toolbar disegno
const colorPalette = [
    '#6ee7b7',   // Teal (default)
    '#60a5fa',   // Blue
    '#f472b6',   // Pink
    '#facc15',   // Yellow
    '#fb923c',   // Orange
    '#f87171',   // Red
    '#a78bfa',   // Purple
    '#34d399',   // Emerald
    '#38bdf8',   // Sky
    '#c084fc',   // Fuchsia
];
```

---

## 📝 Conclusione

Il design di SaferPlaces è:

- **Dark-first**: Ottimizzato per lettura notturna
- **Glassmorphic**: Effetto vetro su pannelli
- **Accessible**: Contrasto sufficiente, testo leggibile
- **Performance**: Minimal CSS, niente animazioni pesanti
- **Modular**: Ogni componente ha suo CSS file

Per estendere:
1. Mantieni la palette colori esistente
2. Usa transition `.12s ease` per hover
3. Applica glassmorphism per floating panel
4. Testa responsive su mobile

---

**Prossimo Step**: Vedi `07_GUIDA_SVILUPPATORE.md` per estendere e modificare l'app.
