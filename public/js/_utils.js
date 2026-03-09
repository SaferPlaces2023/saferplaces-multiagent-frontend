/**
 * _utils.js - Utility funzioni condivise tra i moduli
 * 
 * Contiene funzioni comuni, helper DOM, e gestione localStorage
 * centralizzati per evitare duplicazioni
 */

// =========================================================================
// DOM UTILITIES
// =========================================================================

/**
 * Escapa stringhe per evitare XSS in context di innerHTML
 * @param {string} str - Stringa da escapare
 * @returns {string} Stringa escapata
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Imposta la visibilità di un elemento (toggle classe d-none)
 * @param {HTMLElement} element - Elemento
 * @param {boolean} visible - true per mostrare, false per nascondere
 */
function visibility(element, visible) {
    if (!element) return;
    if (visible) {
        element.classList.remove('d-none');
    } else {
        element.classList.add('d-none');
    }
}

/**
 * Mostra un messaggio di errore/info temporaneo in un elemento
 * @param {HTMLElement} element - Elemento dove mostrare il messaggio
 * @param {string} message - Messaggio da mostrare
 */
function showFlash(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
}

/**
 * Nasconde un messaggio di errore/info
 * @param {HTMLElement} element - Elemento da nascondere
 */
function hideFlash(element) {
    if (!element) return;
    element.classList.add('d-none');
}

/**
 * Cachea i riferimenti agli elementi DOM da un mapping di IDs
 * @param {Object} domIdsMap - Oggetto { key: 'id', key2: 'id2', ... }
 * @returns {Object} Oggetto { key: HTMLElement, key2: HTMLElement, ... }
 */
function cacheElements(domIdsMap) {
    const domElements = {};
    Object.entries(domIdsMap).forEach(([key, id]) => {
        domElements[key] = document.getElementById(id);
        if (!domElements[key]) {
            console.warn(`[Utils] Elemento DOM non trovato: ${id}`);
        }
    });
    return domElements;
}

// =========================================================================
// EVENT UTILITIES
// =========================================================================

/**
 * Dispatchea un CustomEvent
 * @param {string} eventName - Nome dell'evento
 * @param {Object} detail - Dettagli dell'evento
 */
function dispatchEvent(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

// =========================================================================
// LOCALSTORAGE UTILITIES
// =========================================================================

/**
 * Salva i dati di sessione in localStorage
 * @param {Object} data - Oggetto con thread_id, user_id, project_id
 */
function saveSessionToStorage(data) {
    if (data?.thread_id) localStorage.setItem(STORAGE_KEYS.THREAD_ID, data.thread_id);
    if (data?.user_id) localStorage.setItem(STORAGE_KEYS.USER_ID, data.user_id);
    if (data?.project_id) localStorage.setItem(STORAGE_KEYS.PROJECT_ID, data.project_id);
}

/**
 * Recupera un valore da localStorage
 * @param {string} key - Chiave (da STORAGE_KEYS)
 * @returns {string|null} Valore o null
 */
function getStorageValue(key) {
    return localStorage.getItem(key);
}

/**
 * Salva un valore in localStorage
 * @param {string} key - Chiave (da STORAGE_KEYS)
 * @param {string} value - Valore
 */
function setStorageValue(key, value) {
    localStorage.setItem(key, value);
}

/**
 * Pulisce tutta la sessione (logout)
 */
function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.THREAD_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    localStorage.removeItem(STORAGE_KEYS.PROJECT_ID);
}

/**
 * Valida una risposta di thread dal backend
 * @param {Object} data - Dati da validare
 * @returns {boolean} true se valida
 * @throws {Error} Se la risposta non è valida
 */
function validateThreadResponse(data) {
    if (!data?.thread_id || !data?.user_id || !data?.project_id) {
        throw new Error('Invalid thread response: missing thread_id, user_id, or project_id');
    }
    return true;
}

// =========================================================================
// FOCUS & TIMING UTILITIES
// =========================================================================

/**
 * Setta il focus su un elemento dopo un delay
 * @param {HTMLElement} element - Elemento su cui fare focus
 * @param {number} delay - Delay in ms (default: TIMING.FOCUS_DELAY_MS)
 */
function delayedFocus(element, delay = TIMING.FOCUS_DELAY_MS) {
    if (!element) return;
    setTimeout(() => element.focus(), delay);
}

/**
 * Nasconde un elemento dopo un delay
 * @param {HTMLElement} element - Elemento da nascondere
 * @param {number} delay - Delay in ms (default: TIMING.TOAST_DURATION_MS)
 */
function delayedHide(element, delay = TIMING.TOAST_DURATION_MS) {
    if (!element) return;
    setTimeout(() => visibility(element, false), delay);
}
