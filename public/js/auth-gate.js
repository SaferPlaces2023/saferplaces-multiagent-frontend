/**
 * AuthGate - Modulo di autenticazione e selezione progetto
 * 
 * Flusso:
 * 1. Verifica user_id
 * 2. Carica lista progetti
 * 3. Toggle tra selezione progetto (se esistenti) e creazione nuovo
 * 4. Processa accesso e dispatch evento 'auth:ready'
 * 
 * Dipendenze: _utils.js, _consts.js
 */
const AuthGate = (() => {
    
    const MODULE_SUMMARY = {
        // COSTANTI E CONFIGURAZIONE
        DOM_IDS: 'Mapping ID elementi DOM: auth gate, user input, project select/create',
        CONSTANTS: 'Costanti modalità: MODE_SELECT="select", MODE_CREATE="create"',

        // STATO INTERNO
        domElements: 'Cache riferimenti DOM elements dalla mappa DOM_IDS',
        currentUser: 'User ID corrente verificato',
        mode: 'Modalità corrente: "select" (scelta progetto) o "create" (nuovo)',

        // INIZIALIZZAZIONE
        init: 'Entry point: cachea DOM, bind events, controlla sessione cache',
        bindEvents: 'Bind: verify user (click + Enter), mode switch, proceed',
        checkCachedSession: 'Se esiste sessione localStorage → loadUserProject, else → showGate',

        // VERIFICA UTENTE
        handleVerifyUser: 'Valida user_id, fetchia endpoint USER, popola projects UI',
        setUserButtonLoading: 'Mostra/nasconde loading spinner su authSubmit button',

        // UI PROGETTI
        buildProjectsUI: 'Decide: 0 progetti → create only, N progetti → select + toggle',
        populateProjectSelect: 'Popola <select> dropdown con lista progetti',
        setMode: 'Toggle modalità select⟷create, abilita/disabilita sezioni, focus',

        // AZIONE PRINCIPALE
        handleProceed: 'Estrae projectId da select o input, chiama loadUserProject',

        // CARICAMENTO PROGETTO
        loadUserProject: 'POST NEWTHREAD endpoint, valida risposta, salva storage',
        setProceedButtonLoading: 'Mostra/nasconde loading spinner su proceed button',

        // FINALIZZAZIONE
        finalizeAuth: 'Nasconde gate, dispatcha evento auth:ready',
        dispatchAuthReady: 'Crea e dispatcha CustomEvent "auth:ready" con dettagli',

        // UI HELPERS
        showGate: 'Mostra authGate: add blurred, remove hidden',
        hideGate: 'Nasconde authGate: remove blurred, add hidden',
        focusUserInput: 'Focus con delay su input authUserId',

        // EXPORTED API
        'return.init': 'Inizializzazione modulo',
        'return.loadUserProject': 'API pubblica: carica progetto specifico'
    }

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        authGate: 'authGate',
        authGateLogo: 'authGateLogo',
        appRoot: 'appRoot',
        authStepUser: 'authStepUser',
        authUserId: 'authUserId',
        authSubmit: 'authSubmit',
        authError: 'authError',
        authProjectArea: 'authProjectArea',
        authUserBadge: 'authUserBadge',
        authModeWrap: 'authModeWrap',
        authModeSwitch: 'authModeSwitch',
        authSectionSelect: 'authSectionSelect',
        authProjectSelect: 'authProjectSelect',
        authSectionCreate: 'authSectionCreate',
        authProjectName: 'authProjectName',
        authProjError: 'authProjError',
        authProceed: 'authProceed'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    
    // Costanti locali per modalità
    const CONSTANTS = {
        MODE_SELECT: 'select',
        MODE_CREATE: 'create'
    };
    
    let domElements = {};
    let currentUser = null;
    let mode = CONSTANTS.MODE_SELECT;

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo AuthGate
     */
    function init() {
        domElements = cacheElements(DOM_IDS);
        bindEvents();
        checkCachedSession();
    }

    /**
     * Associa i listener agli eventi
     */
    function bindEvents() {
        domElements.authSubmit?.addEventListener('click', handleVerifyUser);
        domElements.authUserId?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleVerifyUser();
        });
        domElements.authModeSwitch?.addEventListener('change', () => {
            setMode(domElements.authModeSwitch.checked ? CONSTANTS.MODE_CREATE : CONSTANTS.MODE_SELECT);
        });
        domElements.authProceed?.addEventListener('click', handleProceed);
    }

    /**
     * Verifica se esiste una sessione già attiva in localStorage
     */
    function checkCachedSession() {
        const user = getStorageValue(STORAGE_KEYS.USER_ID);
        const project = getStorageValue(STORAGE_KEYS.PROJECT_ID);
        const thread = getStorageValue(STORAGE_KEYS.THREAD_ID);

        if (!user || !project) {
            showGate();
            focusUserInput();
            return;
        }

        // Ricarica progetto dalla sessione
        loadUserProject(user, project, thread);
    }

    // =========================================================================
    // VERIFICAZIONE UTENTE
    // =========================================================================

    /**
     * Gestisce la verifica dell'utente
     */
    async function handleVerifyUser() {
        const userId = (domElements.authUserId?.value || '').trim();
        if (!userId) {
            showFlash(domElements.authError, ERRORS.INSERT_USER_ID);
            return;
        }

        setUserButtonLoading(true);
        hideFlash(domElements.authError);

        try {
            const cardTopBefore = document.querySelector('.auth-card')?.getBoundingClientRect().top || 0;

            if (!Routes?.Agent?.USER) {
                throw new Error('Routes.Agent.USER non configurato');
            }

            const response = await fetch(Routes.Agent.USER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            currentUser = data.user_id || userId;
            setStorageValue(STORAGE_KEYS.USER_ID, currentUser);

            // Costruisci UI progetti
            const projects = Array.isArray(data.projects) ? data.projects : [];
            buildProjectsUI(projects);

            // Aggiusta posizione del logo se l'elemento è cresciuto
            const cardTopAfter = document.querySelector('.auth-card')?.getBoundingClientRect().top || 0;
            if (domElements.authGateLogo) {
                const currentTop = domElements.authGateLogo.getBoundingClientRect().top;
                domElements.authGateLogo.style.top = `${currentTop - (cardTopBefore - cardTopAfter)}px`;
            }

        } catch (error) {
            console.error('[AuthGate] Error verifying user:', error);
            showFlash(domElements.authError, ERRORS.CHECK_FAILED);
        } finally {
            setUserButtonLoading(false);
        }
    }

    /**
     * Disabilita/abilita il bottone di verifica con loading state
     * @param {boolean} loading - true per mostrare loading
     */
    function setUserButtonLoading(loading) {
        if (!domElements.authSubmit) return;
        domElements.authSubmit.disabled = loading;
        domElements.authSubmit.dataset.originalText = domElements.authSubmit.dataset.originalText || domElements.authSubmit.textContent;
        domElements.authSubmit.textContent = loading ? MESSAGES.VERIFYING : domElements.authSubmit.dataset.originalText;
    }

    // =========================================================================
    // UI PROGETTI
    // =========================================================================

    /**
     * Costruisce la UI per la selezione/creazione del progetto
     * @param {Array<string>} projects - Lista di progetti disponibili
     */
    function buildProjectsUI(projects) {
        if (!domElements.authProjectArea) return;
        visibility(domElements.authProjectArea, true);

        if (projects.length === 0) {
            // Nessun progetto: solo modalità creazione
            visibility(domElements.authModeWrap, false);
            setMode(CONSTANTS.MODE_CREATE);
        } else {
            // Progetti disponibili: popola select e abilita switch
            populateProjectSelect(projects);
            visibility(domElements.authModeWrap, true);
            if (domElements.authModeSwitch) {
                domElements.authModeSwitch.checked = false;
            }
            setMode(CONSTANTS.MODE_SELECT);
        }
    }

    /**
     * Popola il dropdown di selezione progetti
     * @param {Array<string>} projects - Lista di progetti
     */
    function populateProjectSelect(projects) {
        if (!domElements.authProjectSelect) return;
        domElements.authProjectSelect.innerHTML = '';

        projects.forEach((projectName, index) => {
            const option = document.createElement('option');
            option.value = projectName;
            option.textContent = projectName;
            if (index === 0) option.selected = true;
            domElements.authProjectSelect.appendChild(option);
        });
    }

    /**
     * Imposta la modalità selezionata (select o create)
     * @param {string} nextMode - Modalità da impostare
     */
    function setMode(nextMode) {
        mode = nextMode;
        const isCreate = mode === CONSTANTS.MODE_CREATE;

        // Abilita/disabilita sezioni
        if (domElements.authSectionSelect) domElements.authSectionSelect.disabled = isCreate;
        if (domElements.authSectionCreate) domElements.authSectionCreate.disabled = !isCreate;

        // Aggiorna testo bottone
        if (domElements.authProceed) {
            domElements.authProceed.textContent = isCreate ? MESSAGES.CREATE_ENTER : MESSAGES.ENTER;
        }

        hideFlash(domElements.authProjError);

        // Focus appropriato
        const focusEl = isCreate ? domElements.authProjectName : domElements.authProjectSelect;
        if (focusEl) {
            delayedFocus(focusEl, TIMING.FOCUS_DELAY_MS);
        }
    }

    // =========================================================================
    // AZIONE PRINCIPALE
    // =========================================================================

    /**
     * Gestisce il proceedimento (enter project)
     */
    async function handleProceed() {
        let projectId = null;

        if (mode === CONSTANTS.MODE_SELECT) {
            projectId = domElements.authProjectSelect?.value;
            if (!projectId) return;
        } else {
            const name = (domElements.authProjectName?.value || '').trim();
            if (!name) {
                showFlash(domElements.authProjError, ERRORS.INSERT_PROJECT_NAME);
                return;
            }
            projectId = name;
        }

        setProceedButtonLoading(true);

        try {
            await loadUserProject(currentUser, projectId);
        } catch (error) {
            console.error('[AuthGate] Error in proceed:', error);
            showFlash(domElements.authProjError, ERRORS.OPERATION_FAILED);
        }
    }

    /**
     * Carica il progetto selezionato e finalizza l'accesso
     * @param {string} userId - ID utente
     * @param {string} projectId - ID progetto
     * @param {string} [threadId] - ID thread opzionale (dalla cache)
     */
    async function loadUserProject(userId, projectId, threadId = null) {
        if (!Routes?.Agent?.NEWTHREAD) {
            console.error('[AuthGate] Routes.Agent.NEWTHREAD non configurato');
            throw new Error('Routes not configured');
        }

        const body = {
            user_id: userId,
            project_id: projectId
        };

        if (threadId) {
            body.thread_id = threadId;
        }

        try {
            const response = await fetch(Routes.Agent.NEWTHREAD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            validateThreadResponse(data);

            // Salva in localStorage
            saveSessionToStorage(data);

            // Finalizza
            setTimeout(() => {
                finalizeAuth(data.thread_id, data.user_id, data.project_id);
            }, 100);

        } catch (error) {
            console.error('[AuthGate] Error loading project:', error);
            const message = threadId ? ERRORS.LOAD_PROJECT_CACHED : ERRORS.PROJECT_LOADING;
            showFlash(domElements.authProjError, message);
            throw error;
        } finally {
            setProceedButtonLoading(false);
        }
    }

    /**
     * Disabilita/abilita il bottone di proceed con loading state
     * @param {boolean} loading - true per mostrare loading
     */
    function setProceedButtonLoading(loading) {
        if (!domElements.authProceed) return;
        domElements.authProceed.disabled = loading;
        if (loading) {
            domElements.authProceed.dataset.originalHtml = domElements.authProceed.innerHTML;
            domElements.authProceed.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                ${MESSAGES.LOADING}
            `;
        } else {
            domElements.authProceed.innerHTML = domElements.authProceed.dataset.originalHtml || MESSAGES.ENTER;
        }
    }

    // =========================================================================
    // FINALIZZAZIONE
    // =========================================================================

    /**
     * Finalizza l'autenticazione e notifica
     * @param {string} threadId - ID del thread
     * @param {string} userId - ID utente
     * @param {string} projectId - ID progetto
     */
    function finalizeAuth(threadId, userId, projectId) {
        hideGate();
        dispatchAuthReady(threadId, userId, projectId);
    }

    /**
     * Dispatch dell'evento auth:ready
     * @param {string} threadId - ID del thread
     * @param {string} userId - ID utente
     * @param {string} projectId - ID progetto
     */
    function dispatchAuthReady(threadId, userId, projectId) {
        document.dispatchEvent(new CustomEvent('auth:ready', {
            detail: { thread_id: threadId, user_id: userId, project_id: projectId }
        }));
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    /**
     * Mostra l'authGate
     */
    function showGate() {
        if (domElements.appRoot) domElements.appRoot.classList.add(CSS_CLASSES.BLURRED);
        if (domElements.authGate) domElements.authGate.classList.remove(CSS_CLASSES.HIDDEN);
        if (domElements.authGateLogo) domElements.authGateLogo.classList.remove(CSS_CLASSES.HIDDEN);
    }

    /**
     * Nasconde l'authGate
     */
    function hideGate() {
        if (domElements.appRoot) domElements.appRoot.classList.remove(CSS_CLASSES.BLURRED);
        if (domElements.authGate) domElements.authGate.classList.add(CSS_CLASSES.HIDDEN);
        if (domElements.authGateLogo) domElements.authGateLogo.classList.add(CSS_CLASSES.HIDDEN);
    }

    /**
     * Focus sull'input utente
     */
    function focusUserInput() {
        delayedFocus(domElements.authUserId, TIMING.FOCUS_DELAY_MS);
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        loadUserProject
    };
})();
