/**
 * Toasts - Sistema di notifiche toast con spinner e icone
 * 
 * Responsabilità:
 * - Visualizzare notifiche toast con spinner in loading
 * - Aggiornare toast a stato ok (check icon + messaggio)
 * - Aggiornare toast a stato error (messaggio + close rapido)
 * - Animazione smooth show/hide con transizioni
 * - XSS-safe HTML rendering
 * 
 * Dipendenze: _utils.js
 */
const Toasts = (() => {

    const MODULE_SUMMARY = {
        // COSTANTI
        'TOAST_CONSTANTS.CSS_CLASSES': 'Toast UI classes: toast-item, show, ok, hide, toast-icon, toast-msg',
        'TOAST_CONSTANTS.ICONS': 'Material icons: check_circle per ok state',
        'TOAST_CONSTANTS.MESSAGES': 'Messaggi default: "Operazione in corso…", "Fatto", "Errore"',
        'TOAST_CONSTANTS.TIMING': 'Durate: DEFAULT_HOLD_MS=2000, ERROR_CLOSE_MS=600',
        'TOAST_CONSTANTS.DOM': 'ID elemento container: toastStack',

        // DOM IDS
        DOM_IDS: 'Mapping singolo elemento: toastStack',

        // HELPERS
        getStack: 'Retrieves toast container element via getElementById',
        createToastElement: 'Factory: crea div toast-item con spinner + messaggio',
        buildToastHTML: 'Costruisce HTML template toast con escapeHtml safe rendering',
        updateToastState: 'Aggiorna classe toast-item con stato (ok, error)',

        // PUBLIC API
        'return.show': 'Mostra toast con spinner + messaggio, ritorna handle',
        'return.ok': 'Aggiorna toast a ok state, close dopo delay',
        'return.error': 'Aggiorna toast a error state, close rapido',
        'return.close': 'Chiude toast con animazione fade'
    };

    // =========================================================================
    // COSTANTI LOCALI
    // =========================================================================
    const TOAST_CONSTANTS = {
        // CSS classes
        CSS_CLASSES: {
            TOAST_ITEM: 'toast-item',
            TOAST_ICON: 'toast-icon',
            TOAST_MSG: 'toast-msg',
            SPINNER: 'spinner-border spinner-border-sm',
            OK_ICON: 'ok',
            SHOW: 'show',
            HIDE: 'hide',
            OK_STATE: 'ok'
        },

        // Material Design Icons
        ICONS: {
            CHECK_CIRCLE: 'check_circle'
        },

        // Messaggi default
        MESSAGES: {
            LOADING: 'Operazione in corso…',
            SUCCESS: 'Fatto',
            ERROR: 'Errore'
        },

        // Timing (ms)
        TIMING: {
            DEFAULT_HOLD_MS: 2000,
            ERROR_CLOSE_MS: 600,
            CLOSE_DELAY_MS: 0
        }
    };

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        toastStack: 'toastStack'
    };

    // =========================================================================
    // STATE & CACHE
    // =========================================================================
    let domElements = {};

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Inizializzazione modulo Toasts
     */
    function init() {
        domElements = cacheElements(DOM_IDS);
        console.log('[Toasts] Initialized');
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Retrieves toast container stack element
     * @returns {HTMLElement|null}
     */
    function getStack() {
        if (!domElements.toastStack) {
            domElements.toastStack = document.getElementById(DOM_IDS.toastStack);
        }
        return domElements.toastStack;
    }

    /**
     * Factory: crea elemento toast DOM
     * @param {string} message - Messaggio toast
     * @returns {HTMLElement} Elemento toast
     */
    function createToastElement(message) {
        const el = document.createElement('div');
        el.className = TOAST_CONSTANTS.CSS_CLASSES.TOAST_ITEM;
        el.innerHTML = buildToastHTML(message);
        return el;
    }

    /**
     * Costruisce HTML template toast con rendering safe
     * @param {string} message - Messaggio da renderizzare
     * @returns {string} HTML template
     */
    function buildToastHTML(message) {
        // Escape HTML per XSS safety
        const safeMessage = escapeHtml(message);

        return `
            <div class="${TOAST_CONSTANTS.CSS_CLASSES.TOAST_ICON}">
                <span class="${TOAST_CONSTANTS.CSS_CLASSES.SPINNER}" role="status" aria-hidden="true"></span>
                <span class="${TOAST_CONSTANTS.CSS_CLASSES.OK_ICON} material-symbols-outlined">${TOAST_CONSTANTS.ICONS.CHECK_CIRCLE}</span>
            </div>
            <div class="${TOAST_CONSTANTS.CSS_CLASSES.TOAST_MSG}">${safeMessage}</div>
        `;
    }

    /**
     * Aggiorna messaggio di un toast
     * @param {HTMLElement} handle - Toast element
     * @param {string} newMessage - Nuovo messaggio
     */
    function updateToastMessage(handle, newMessage) {
        if (!handle) return;

        const msgEl = handle.querySelector(`.${TOAST_CONSTANTS.CSS_CLASSES.TOAST_MSG}`);
        if (msgEl) {
            msgEl.innerHTML = escapeHtml(newMessage);
        }
    }

    /**
     * Aggiorna stato visuale toast (ok, error, etc)
     * @param {HTMLElement} handle - Toast element
     * @param {string} state - Stato: 'ok' | 'error'
     */
    function updateToastState(handle, state) {
        if (!handle) return;

        if (state === 'ok') {
            handle.classList.add(TOAST_CONSTANTS.CSS_CLASSES.OK_STATE);
        } else if (state === 'error') {
            // Error state potrebbe avere diversa visualizzazione se necessario
            // Per ora uso lo stesso meccanismo
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Mostra toast con spinner + messaggio
     * @param {string} [message='Operazione in corso…'] - Messaggio da visualizzare
     * @returns {HTMLElement} Handle per aggiornamenti successivi
     */
    function show(message = TOAST_CONSTANTS.MESSAGES.LOADING) {
        const stackEl = getStack();
        if (!stackEl) {
            console.warn('[Toasts] Toast stack container not found');
            return null;
        }

        const el = createToastElement(message);
        stackEl.appendChild(el);

        // Trigger animation via requestAnimationFrame
        requestAnimationFrame(() => {
            el.classList.add(TOAST_CONSTANTS.CSS_CLASSES.SHOW);
        });

        return el;
    }

    /**
     * Aggiorna toast a stato ok
     * Mostra check icon e messaggio di successo, poi chiude dopo delay
     * @param {HTMLElement} handle - Toast handle da show()
     * @param {string} [finalMessage='Fatto'] - Messaggio finale
     * @param {number} [holdMs=2000] - Tempo prima di chiudere (ms)
     */
    function ok(handle, finalMessage = TOAST_CONSTANTS.MESSAGES.SUCCESS, holdMs = TOAST_CONSTANTS.TIMING.DEFAULT_HOLD_MS) {
        if (!handle) return;

        updateToastState(handle, 'ok');
        updateToastMessage(handle, finalMessage);

        setTimeout(() => {
            close(handle);
        }, holdMs);
    }

    /**
     * Aggiorna toast a stato error
     * Mostra messaggio errore e chiude rapidamente
     * @param {HTMLElement} handle - Toast handle da show()
     * @param {string} [finalMessage='Errore'] - Messaggio errore
     * @param {number} [closeAfterMs=600] - Tempo prima di chiudere (ms)
     */
    function error(handle, finalMessage = TOAST_CONSTANTS.MESSAGES.ERROR, closeAfterMs = TOAST_CONSTANTS.TIMING.ERROR_CLOSE_MS) {
        if (!handle) return;

        updateToastMessage(handle, finalMessage);

        close(handle, closeAfterMs);
    }

    /**
     * Chiude toast con animazione fade
     * @param {HTMLElement} handle - Toast element
     * @param {number} [afterMs=0] - Delay prima di iniziare animazione close (ms)
     */
    function close(handle, afterMs = TOAST_CONSTANTS.TIMING.CLOSE_DELAY_MS) {
        if (!handle) return;

        setTimeout(() => {
            handle.classList.add(TOAST_CONSTANTS.CSS_CLASSES.HIDE);

            // Rimuove elemento al termine della transizione
            const onTransitionEnd = () => {
                handle.removeEventListener('transitionend', onTransitionEnd);
                handle.remove();
            };

            handle.addEventListener('transitionend', onTransitionEnd, { once: true });

        }, afterMs);
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    /**
     * Escapes HTML special characters per XSS prevention
     * @param {string} s - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(s) {
        // Preferibilmente usare da _utils.js, ma qui come fallback inline
        const charMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(s).replace(/[&<>"']/g, m => charMap[m]);
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        show,
        ok,
        error,
        close
    };
})();
