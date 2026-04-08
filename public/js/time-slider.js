/**
 * TimeSlider - Componente slider temporale per layers multibanda
 * 
 * Responsabilità:
 * - Slider temporale con drag, play, velocità
 * - Visualizzazione di tick orari e intervalli evidenziati
 * - Tracking timestamp di items associati
 * 
 * Dipendenze: _utils.js, _consts.js
 */
const TimeSlider = (() => {
    
    const MODULE_SUMMARY = {
        // COSTANTI E CONFIGURAZIONE
        TIME_SLIDER_CONSTANTS: 'Costanti: colori, icone, timing, step, delays',
        DOM_IDS: 'Mapping ID elementi DOM: slider, track, handle, ticks, highlights',

        // STATO INTERNO
        domElements: 'Cache riferimenti DOM elements dalla mappa DOM_IDS',
        startDate: 'Data di inizio intervallo slider',
        endDate: 'Data di fine intervallo slider',
        currentValue: 'Valore corrente (data) dello slider',
        stepMinutes: 'Granularità step in minuti (default 60)',
        playTimer: 'ID timer per riproduzione automatica',
        timestampRegister: 'Map: ISO date → array items registrati',
        colorIndex: 'Contatore colori per assegnazione intervalli',

        // INIZIALIZZAZIONE
        init: 'Entry point: cachea DOM, imposta range/value/intervals, bind events',
        bindEvents: 'Bind: toggle, play, speed change, track click, handle drag',

        // RANGE E VALORE
        setRange: 'Imposta intervallo start-end, valida, calcola ticks, aggiusta value',
        setValue: 'Imposta valore corrente, calcola posizione %, dispatcha change event',

        // INTERVALLI E HIGHLIGHTS
        clearIntervals: 'Pulisce HTML highlights e reset colorIndex',
        setIntervals: 'Popola highlights con intervalli, assegna colori, bind tooltips',

        // DRAG AND DROP
        enableHandleDrag: 'Setup pointerdown/up/move listeners per drag handle',
        handleTrackPointerDown: 'Gestisce click su track: sposta handle a posizione',
        moveHandleToClientX: 'Converte clientX a data, snappa a minutes, setValue',

        // LAYOUT TICKS
        layoutTicks: 'Calcola scaling, rimuove/crea label ticks ogni 2 ore con etichette',

        // PLAY / PAUSE
        play: 'Avvia timer: stepForward ogni interval ms (da speed select)',
        pause: 'Ferma timer riproduzione automatica',
        togglePlay: 'Toggle tra play e pause',
        isPlaying: 'Restituisce true se timer attivo',
        stepForward: 'Incrementa valore di stepMinutes, para se >= endDate',

        // TOOLTIP
        showTooltip: 'Mostra tooltip con testo, posiziona su evento',
        moveTooltip: 'Sposta tooltip seguendo clientX',
        hideTooltip: 'Nascondi tooltip aggiungendo classe hidden',

        // TIMESTAMP REGISTRY
        registerTimestampItem: 'Registra item in Map[ISO date] → array di items',
        getTimestampItems: 'Recupera items da Map per ISO date, filtrabile per type',

        // UTILITY - CALCOLATORI
        calculatePercentBetween: 'Percentuale 0-100 tra startDate e endDate per una data',
        calculatePositionPercent: 'Calcolo % pinzato 0-100',
        snapToMinutes: 'Snappa data al multiplo più vicino di minuti',
        isValidDate: 'Valida se Date è valida (not NaN)',
        hexToRgba: 'Converte hex #rrggbb a rgba(r,g,b,alpha)',

        // UTILITY - FORMATTATORI
        formatDate: 'Formatta Date come YYYY-MM-DD',
        formatHour: 'Formatta ora come HH:00',
        formatDateTime: 'Formatta come YYYY-MM-DD HH:MM',
        padZero: 'Padda numero con zero',

        // EVENTS
        dispatchChange: 'Dispatcha evento "timeslider:change" con {iso, date}',

        // PUBLIC UTILITIES
        dateRange: 'Genera array di N date distribute tra start e end',

        // EXPORTED API
        'return.init': 'Inizializzazione componente',
        'return.setRange': 'Imposta intervallo temporale',
        'return.setValue': 'Imposta valore corrente',
        'return.setIntervals': 'Imposta intervalli highlighting',
        'return.clearIntervals': 'Pulisce intervalli',
        'return.play': 'Avvia riproduzione automatica',
        'return.pause': 'Pausa riproduzione',
        'return.togglePlay': 'Toggle play/pause',
        'return.isPlaying': 'Verifica se in riproduzione',
        'return.dateRange': 'Genera range di date',
        'return.registerTimestampItem': 'Registra item per timestamp',
        'return.getTimestampItems': 'Recupera items per timestamp',
        'return.timestampRegister': 'Accesso diretto alla Map di registry'
    }

    // =========================================================================
    // COSTANTI LOCALI
    // =========================================================================
    const TIME_SLIDER_CONSTANTS = {
        DEFAULT_STEP_MINUTES: 60,
        DESIRED_PX_PER_HOUR: 60,
        SCALE_MIN: 0.4,
        SCALE_MAX: 3,
        DEFAULT_TRACK_WIDTH: 600,
        TICK_INTERVAL_HOURS: 2,
        TOOLTIP_DELAY_MS: 100,
        INTERVAL_COLORS: [
            '#6ee7b7', '#60a5fa', '#f472b6', '#facc15', '#fb923c',
            '#f87171', '#a78bfa', '#34d399', '#38bdf8', '#c084fc'
        ],
        PLAY_ICON: '<span class="material-symbols-outlined">play_arrow</span>',
        PAUSE_ICON: '<span class="material-symbols-outlined">pause</span>',
        DEFAULT_PLAY_INTERVAL_MS: 500
    };

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        timeSlider: 'timeSlider',
        tsToggleBtn: 'tsToggleBtn',
        tsTrackWrap: 'tsTrackWrap',
        tsTrack: 'tsTrack',
        tsTicks: 'tsTicks',
        tsHandle: 'tsHandle',
        tsHighlights: 'tsHighlights',
        tsTooltip: 'tsTooltip',
        tsPlay: 'tsPlay',
        tsSpeed: 'tsSpeed',
        tsNow: 'tsNow',
        tsStartLabel: 'tsStartLabel',
        tsEndLabel: 'tsEndLabel'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};
    let startDate = null;
    let endDate = null;
    let currentValue = null;
    let stepMinutes = TIME_SLIDER_CONSTANTS.DEFAULT_STEP_MINUTES;
    let playTimer = null;
    let timestampRegister = new Map();
    let colorIndex = 0;

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il componente TimeSlider
     * @param {Object} config - Configurazione
     * @param {string} config.startISO - Data inizio ISO
     * @param {string} config.endISO - Data fine ISO
     * @param {string} [config.valueISO] - Data iniziale slider
     * @param {number} [config.stepMinutes] - Step in minuti (default 60)
     * @param {Array<Object>} [config.intervals] - Array di intervalli { start, end, label?, color? }
     */
    function init({ startISO, endISO, valueISO, stepMinutes: step = 60, intervals = [] }) {
        domElements = cacheElements(DOM_IDS);
        
        stepMinutes = step || TIME_SLIDER_CONSTANTS.DEFAULT_STEP_MINUTES;
        colorIndex = 0;

        setRange(startISO, endISO);
        setValue(valueISO || startISO);
        setIntervals(intervals);

        bindEvents();
        
        // Mostra componente, disabilita se nessun intervallo
        if (domElements.timeSlider) {
            domElements.timeSlider.classList.remove('hidden');
        }

        if (intervals.length === 0 && domElements.timeSlider) {
            domElements.timeSlider.classList.add('closed');
        }
    }

    /**
     * Associa i listener agli eventi principali
     */
    function bindEvents() {
        if (!domElements.tsToggleBtn) return;

        domElements.tsToggleBtn.addEventListener('click', () => {
            if (domElements.timeSlider) {
                domElements.timeSlider.classList.toggle('closed');
            }
        });

        domElements.tsPlay?.addEventListener('click', togglePlay);
        domElements.tsSpeed?.addEventListener('change', () => {
            if (isPlaying()) {
                pause();
                play();
            }
        });

        domElements.tsTrack?.addEventListener('pointerdown', handleTrackPointerDown);
        enableHandleDrag();
        enableRangeEdit();
    }

    // =========================================================================
    // RANGE E VALORE
    // =========================================================================

    /**
     * Imposta l'intervallo di tempo dello slider
     * @param {string} aISO - Data inizio ISO
     * @param {string} bISO - Data fine ISO
     * @throws {Error} Se l'intervallo non è valido
     */
    function setRange(aISO, bISO) {
        startDate = new Date(aISO);
        endDate = new Date(bISO);

        if (!isValidDate(startDate) || !isValidDate(endDate) || endDate <= startDate) {
            throw new Error('[TimeSlider] Time range not valid');
        }

        if (domElements.tsStartLabel) {
            domElements.tsStartLabel.textContent = formatDate(startDate);
        }
        if (domElements.tsEndLabel) {
            domElements.tsEndLabel.textContent = formatDate(endDate);
        }

        layoutTicks();

        if (currentValue === null || currentValue < startDate || currentValue > endDate) {
            setValue(aISO);
        }
    }

    /**
     * Imposta il valore corrente dello slider
     * @param {string} iso - Data ISO
     */
    function setValue(iso) {
        currentValue = new Date(iso);

        if (!isValidDate(currentValue)) {
            currentValue = new Date(startDate);
        }

        const percent = calculatePositionPercent(currentValue);
        if (domElements.tsHandle) {
            domElements.tsHandle.style.left = percent + '%';
        }

        if (domElements.tsNow) {
            domElements.tsNow.textContent = formatDateTime(currentValue);
        }

        dispatchChange();
    }

    // =========================================================================
    // INTERVALLI E HIGHLIGHTS
    // =========================================================================

    /**
     * Pulisce tutti gli intervalli visualizzati
     */
    function clearIntervals() {
        if (domElements.tsHighlights) {
            domElements.tsHighlights.innerHTML = '';
        }
        colorIndex = 0;
    }

    /**
     * Imposta gli intervalli visualizzati come highlighting
     * @param {Array<Object>} list - Array di { start, end, label?, color? }
     */
    function setIntervals(list) {
        if (!Array.isArray(list)) return;

        list.forEach(interval => {
            const intervalStart = new Date(interval.start);
            const intervalEnd = new Date(interval.end);

            // Skip se fuori range
            if (!isValidDate(intervalStart) || !isValidDate(intervalEnd) || 
                intervalEnd <= startDate || intervalStart >= endDate) {
                return;
            }

            const leftPercent = Math.max(0, calculatePercentBetween(intervalStart));
            const rightPercent = Math.min(100, calculatePercentBetween(intervalEnd));
            const width = Math.max(0, rightPercent - leftPercent);

            const highlight = document.createElement('div');
            highlight.className = 'ts-highlight';
            highlight.style.left = leftPercent + '%';
            highlight.style.width = width + '%';

            // Assegna colore
            const color = interval.color || TIME_SLIDER_CONSTANTS.INTERVAL_COLORS[colorIndex++ % TIME_SLIDER_CONSTANTS.INTERVAL_COLORS.length];
            if (color) {
                highlight.style.background = `linear-gradient(180deg, ${hexToRgba(color, 0.20)}, ${hexToRgba(color, 0.08)})`;
                highlight.style.borderLeftColor = hexToRgba(color, 0.35);
                highlight.style.borderRightColor = hexToRgba(color, 0.35);
            }

            // Tooltip su hover
            if (interval.label) {
                highlight.addEventListener('pointerenter', (e) => showTooltip(e, interval.label));
                highlight.addEventListener('pointermove', (e) => moveTooltip(e));
                highlight.addEventListener('pointerleave', hideTooltip);
            }

            if (domElements.tsHighlights) {
                domElements.tsHighlights.appendChild(highlight);
            }
        });
    }

    // =========================================================================
    // RANGE EDIT (click-to-edit start/end labels)
    // =========================================================================

    /**
     * Abilita la modifica di start/end date cliccando sulle label
     */
    function enableRangeEdit() {
        const targets = [
            { el: domElements.tsStartLabel, isStart: true },
            { el: domElements.tsEndLabel, isStart: false }
        ];

        targets.forEach(({ el, isStart }) => {
            if (!el) return;
            el.classList.add('ts-range-label-editable');

            el.addEventListener('click', () => {
                const currentISO = isStart ? startDate?.toISOString() : endDate?.toISOString();
                if (!currentISO) return;

                const input = document.createElement('input');
                input.type = 'datetime-local';
                input.value = toDatetimeLocalValue(new Date(currentISO));
                input.className = 'ts-range-input';

                const originalText = el.textContent.trim();
                el.textContent = '';
                el.appendChild(input);
                input.focus();

                let committed = false;

                const commit = () => {
                    if (committed) return;
                    committed = true;
                    if (input.value) {
                        const newISO = new Date(input.value).toISOString();
                        try {
                            if (isStart) {
                                setRange(newISO, endDate.toISOString());
                            } else {
                                setRange(startDate.toISOString(), newISO);
                            }
                        } catch {
                            el.textContent = originalText;
                        }
                    } else {
                        el.textContent = originalText;
                    }
                };

                const cancel = () => {
                    committed = true;
                    el.textContent = originalText;
                };

                input.addEventListener('blur', commit);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                    if (e.key === 'Escape') { cancel(); }
                });
            });
        });
    }

    /**
     * Converte una Date nel formato richiesto da input[type=datetime-local]
     * @param {Date} d
     * @returns {string} "YYYY-MM-DDTHH:MM"
     */
    function toDatetimeLocalValue(d) {
        return `${formatDate(d)}T${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
    }

    // =========================================================================
    // DRAG AND DROP
    // =========================================================================

    /**
     * Abilita il drag del handle
     */
    function enableHandleDrag() {
        if (!domElements.tsHandle) return;

        let dragging = false;

        domElements.tsHandle.addEventListener('pointerdown', (e) => {
            dragging = true;
            domElements.tsHandle.setPointerCapture(e.pointerId);
        });

        domElements.tsHandle.addEventListener('pointerup', (e) => {
            dragging = false;
            domElements.tsHandle.releasePointerCapture(e.pointerId);
        });

        domElements.tsHandle.addEventListener('pointermove', (e) => {
            if (dragging) {
                moveHandleToClientX(e.clientX);
            }
        });
    }

    /**
     * Gestisce il click sul track
     * @param {PointerEvent} e
     */
    function handleTrackPointerDown(e) {
        moveHandleToClientX(e.clientX);
    }

    /**
     * Sposta l'handle a una posizione X
     * @param {number} clientX - Posizione X in viewport
     */
    function moveHandleToClientX(clientX) {
        if (!domElements.tsTrack) return;

        const rect = domElements.tsTrack.getBoundingClientRect();
        const clampX = Math.max(rect.left, Math.min(clientX, rect.right));
        const ratio = (clampX - rect.left) / rect.width;

        const timestamp = startDate.getTime() + ratio * (endDate.getTime() - startDate.getTime());
        const snappedDate = snapToMinutes(new Date(timestamp), stepMinutes);

        setValue(snappedDate.toISOString());
    }

    // =========================================================================
    // LAYOUT TICKS
    // =========================================================================

    /**
     * Calcola e layout i tick orari sul track
     */
    function layoutTicks() {
        if (!domElements.tsTrack || !domElements.tsTicks) return;

        const hours = (endDate - startDate) / (1000 * 60 * 60);
        const width = domElements.tsTrack.clientWidth || TIME_SLIDER_CONSTANTS.DEFAULT_TRACK_WIDTH;
        const scale = Math.max(
            TIME_SLIDER_CONSTANTS.SCALE_MIN,
            Math.min(
                TIME_SLIDER_CONSTANTS.SCALE_MAX,
                width / (hours * TIME_SLIDER_CONSTANTS.DESIRED_PX_PER_HOUR)
            )
        );

        domElements.tsTicks.style.transform = `scaleX(${scale})`;

        // Crea label per ogni 2 ore
        const existingLabels = domElements.tsTrack.querySelectorAll('.ts-tick-label');
        existingLabels.forEach(l => l.remove());

        const startHour = new Date(startDate);
        startHour.setMinutes(0, 0, 0);

        for (let t = +startHour; t <= +endDate; t += TIME_SLIDER_CONSTANTS.TICK_INTERVAL_HOURS * 3600 * 1000) {
            const dt = new Date(t);
            const percent = calculatePercentBetween(dt);

            if (percent < 0 || percent > 100) continue;

            const label = document.createElement('div');
            label.className = 'ts-tick-label';
            label.style.position = 'absolute';
            label.style.left = percent + '%';
            label.style.top = '25%';
            label.style.transform = 'translateX(-50%)';
            label.style.color = '#9aa0a6';
            label.style.fontSize = '.7rem';
            label.style.marginTop = '0px';
            label.textContent = (dt.getHours() === 0) ? formatDate(dt) : formatHour(dt);

            domElements.tsTrack.appendChild(label);
        }
    }

    // =========================================================================
    // PLAY / PAUSE
    // =========================================================================

    /**
     * Avvia la riproduzione automatica
     */
    function play() {
        if (playTimer) return;

        const interval = +domElements.tsSpeed?.value || TIME_SLIDER_CONSTANTS.DEFAULT_PLAY_INTERVAL_MS;
        playTimer = setInterval(stepForward, interval);

        if (domElements.tsPlay) {
            domElements.tsPlay.innerHTML = TIME_SLIDER_CONSTANTS.PAUSE_ICON;
        }
    }

    /**
     * Pausa la riproduzione automatica
     */
    function pause() {
        if (!playTimer) return;

        clearInterval(playTimer);
        playTimer = null;

        if (domElements.tsPlay) {
            domElements.tsPlay.innerHTML = TIME_SLIDER_CONSTANTS.PLAY_ICON;
        }
    }

    /**
     * Toggle play/pause
     */
    function togglePlay() {
        isPlaying() ? pause() : play();
    }

    /**
     * Verifica se la riproduzione è attiva
     * @returns {boolean}
     */
    function isPlaying() {
        return !!playTimer;
    }

    /**
     * Avanza di uno step (usato in play)
     */
    function stepForward() {
        const next = new Date(currentValue.getTime() + stepMinutes * 60 * 1000);

        if (next > endDate) {
            pause();
            return;
        }

        setValue(next.toISOString());
    }

    // =========================================================================
    // TOOLTIP
    // =========================================================================

    /**
     * Mostra il tooltip con un testo
     * @param {PointerEvent} e
     * @param {string} text
     */
    function showTooltip(e, text) {
        if (!domElements.tsTooltip) return;

        domElements.tsTooltip.textContent = text;
        domElements.tsTooltip.classList.remove('hidden');
        moveTooltip(e);
    }

    /**
     * Sposta il tooltip seguendo il mouse
     * @param {PointerEvent} e
     */
    function moveTooltip(e) {
        if (!domElements.tsTooltip || !domElements.tsTrackWrap) return;

        const rect = domElements.tsTrackWrap.getBoundingClientRect();
        domElements.tsTooltip.style.left = (e.clientX - rect.left) + 'px';
    }

    /**
     * Nasconde il tooltip
     */
    function hideTooltip() {
        if (domElements.tsTooltip) {
            domElements.tsTooltip.classList.add('hidden');
        }
    }

    // =========================================================================
    // TIMESTAMP REGISTRY
    // =========================================================================

    /**
     * Registra un item associato a uno specifico timestamp
     * @param {string} isoDate - Data ISO
     * @param {Object} item - Oggetto item da registrare
     */
    function registerTimestampItem(isoDate, item) {
        const existing = timestampRegister.get(isoDate);
        timestampRegister.set(isoDate, existing ? [...existing, item] : [item]);

        // Abilita componente se era disabilitato
        if (domElements.timeSlider && domElements.timeSlider.classList.contains('disabled')) {
            domElements.timeSlider.classList.remove('disabled');
        }
    }

    /**
     * Recupera gli items registrati per un timestamp
     * @param {string} isoDate - Data ISO
     * @param {string} [itemType] - Tipo di item da filtrare (opzionale)
     * @returns {Array}
     */
    function getTimestampItems(isoDate, itemType = null) {
        const items = timestampRegister.get(isoDate) || [];
        return itemType ? items.filter(it => it.type === itemType) : items;
    }

    // =========================================================================
    // UTILITY - CALCOLATORI
    // =========================================================================

    /**
     * Calcola la percentuale tra start e end per una data
     * @param {Date} dt
     * @returns {number} Percentuale 0-100
     */
    function calculatePercentBetween(dt) {
        if (!startDate || !endDate) return 0;
        return ((dt - startDate) / (endDate - startDate)) * 100;
    }

    /**
     * Calcola la percentuale pinzata (0-100)
     * @param {Date} dt
     * @returns {number}
     */
    function calculatePositionPercent(dt) {
        return Math.max(0, Math.min(100, calculatePercentBetween(dt)));
    }

    /**
     * Snappa una data al multiplo più vicino di minuti
     * @param {Date} d
     * @param {number} minutes
     * @returns {Date}
     */
    function snapToMinutes(d, minutes) {
        const ms = minutes * 60 * 1000;
        return new Date(Math.round(d.getTime() / ms) * ms);
    }

    /**
     * Valida se un oggetto è una Date valida
     * @param {Date} d
     * @returns {boolean}
     */
    function isValidDate(d) {
        return d instanceof Date && !isNaN(d.getTime());
    }

    /**
     * Converte hex color a rgba con alpha
     * @param {string} color - Colore hex #rrggbb
     * @param {number} alpha - Valore alpha 0-1
     * @returns {string} rgba(r,g,b,a)
     */
    function hexToRgba(color, alpha = 0.2) {
        if (/^#([0-9a-f]{6})$/i.test(color)) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        return color; // fallback
    }

    // =========================================================================
    // UTILITY - FORMATTATORI
    // =========================================================================

    /**
     * Formatta una data come YYYY-MM-DD
     * @param {Date} d
     * @returns {string}
     */
    function formatDate(d) {
        return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
    }

    /**
     * Formatta l'ora come HH:00
     * @param {Date} d
     * @returns {string}
     */
    function formatHour(d) {
        return `${padZero(d.getHours())}:00`;
    }

    /**
     * Formatta data e ora come YYYY-MM-DD HH:MM
     * @param {Date} d
     * @returns {string}
     */
    function formatDateTime(d) {
        return `${formatDate(d)} ${padZero(d.getHours())}:${padZero(d.getMinutes())}`;
    }

    /**
     * Padda un numero con zero
     * @param {number} n
     * @returns {string}
     */
    function padZero(n) {
        return (n < 10 ? '0' : '') + n;
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    /**
     * Dispatcha evento di cambio valore
     */
    function dispatchChange() {
        dispatchEvent('timeslider:change', {
            iso: currentValue.toISOString(),
            date: new Date(currentValue)
        });
    }

    // =========================================================================
    // PUBLIC UTILITIES
    // =========================================================================

    /**
     * Genera un array di date tra start e end
     * @param {Date} start
     * @param {Date} end
     * @param {number} count - Numero di date da generare
     * @returns {Array<Date>}
     */
    function dateRange(start, end, count) {
        const dates = [];
        const step = (end - start) / (count - 1);

        for (let i = 0; i < count; i++) {
            dates.push(new Date(start.getTime() + step * i));
        }

        return dates;
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        setRange,
        setValue,
        setIntervals,
        clearIntervals,
        play,
        pause,
        togglePlay,
        isPlaying,
        dateRange,
        registerTimestampItem,
        getTimestampItems,
        timestampRegister
    };
})();
