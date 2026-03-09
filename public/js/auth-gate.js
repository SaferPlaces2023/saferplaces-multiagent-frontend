/**
 * AuthGate - Modulo di autenticazione e selezione progetto
 * 
 * Flusso:
 * 1. Verifica user_id
 * 2. Carica lista progetti
 * 3. Toggle tra selezione progetto (se esistenti) e creazione nuovo
 * 4. Processa accesso e dispatch evento 'auth:ready'
 */
const AuthGate = (() => {
    // =========================================================================
    // COSTANTI
    // =========================================================================
    const CONSTANTS = {
        LS_THREAD_ID: 'thread_id',
        LS_USER_ID: 'user_id',
        LS_PROJECT_ID: 'project_id',
        FOCUS_DELAY_MS: 50,
        TOAST_DURATION_MS: 2500,
        MODE_SELECT: 'select',
        MODE_CREATE: 'create',
        ERR_INSERT_USER_ID: 'Insert a user_id',
        ERR_CHECK_FAILED: 'Check failed. Check user_id.',
        ERR_INSERT_PROJECT_NAME: 'Insert a project name',
        ERR_INVALID_THREAD_RESPONSE: 'Errore nel recupero del thread_id.',
        ERR_THREAD_RESPONSE_INVALID: 'Invalid response from server',
        ERR_PROJECT_LOADING: 'Project loading is failed. Try again.',
        ERR_LOAD_PROJECT_CACHED: 'Impossibile caricare il progetto. Riprova.',
        ERR_OPERATION_FAILED: 'Operation failed.',
        MSG_VERIFYING: 'Verifico…',
        MSG_LOADING: 'Project loading...',
        MSG_ENTER: 'Entra',
        MSG_CREATE_ENTER: 'Create and enter'
    };

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
        cacheElements();
        bindEvents();
        checkCachedSession();
    }

    /**
     * Cachea i riferimenti agli elementi DOM
     */
    function cacheElements() {
        Object.entries(DOM_IDS).forEach(([key, id]) => {
            domElements[key] = document.getElementById(id);
            if (!domElements[key]) {
                console.warn(`[AuthGate] Elemento DOM non trovato: ${id}`);
            }
        });
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
        const user = localStorage.getItem(CONSTANTS.LS_USER_ID);
        const project = localStorage.getItem(CONSTANTS.LS_PROJECT_ID);
        const thread = localStorage.getItem(CONSTANTS.LS_THREAD_ID);

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
            showFlash(domElements.authError, CONSTANTS.ERR_INSERT_USER_ID);
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
            localStorage.setItem(CONSTANTS.LS_USER_ID, currentUser);

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
            showFlash(domElements.authError, CONSTANTS.ERR_CHECK_FAILED);
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
        domElements.authSubmit.textContent = loading ? CONSTANTS.MSG_VERIFYING : domElements.authSubmit.dataset.originalText;
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
            domElements.authProceed.textContent = isCreate ? CONSTANTS.MSG_CREATE_ENTER : CONSTANTS.MSG_ENTER;
        }

        hideFlash(domElements.authProjError);

        // Focus appropriato
        const focusEl = isCreate ? domElements.authProjectName : domElements.authProjectSelect;
        if (focusEl) {
            setTimeout(() => focusEl.focus(), CONSTANTS.FOCUS_DELAY_MS);
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
                showFlash(domElements.authProjError, CONSTANTS.ERR_INSERT_PROJECT_NAME);
                return;
            }
            projectId = name;
        }

        setProceedButtonLoading(true);

        try {
            await loadUserProject(currentUser, projectId);
        } catch (error) {
            console.error('[AuthGate] Error in proceed:', error);
            showFlash(domElements.authProjError, CONSTANTS.ERR_OPERATION_FAILED);
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
            localStorage.setItem(CONSTANTS.LS_THREAD_ID, data.thread_id);
            localStorage.setItem(CONSTANTS.LS_USER_ID, data.user_id);
            localStorage.setItem(CONSTANTS.LS_PROJECT_ID, data.project_id);

            // Finalizza
            setTimeout(() => {
                finalizeAuth(data.thread_id, data.user_id, data.project_id);
            }, 100);

        } catch (error) {
            console.error('[AuthGate] Error loading project:', error);
            const message = threadId ? CONSTANTS.ERR_LOAD_PROJECT_CACHED : CONSTANTS.ERR_PROJECT_LOADING;
            showFlash(domElements.authProjError, message);
            throw error;
        } finally {
            setProceedButtonLoading(false);
        }
    }

    /**
     * Valida la risposta dal thread endpoint
     * @param {Object} data - Dati da validare
     * @throws {Error} Se la risposta non è valida
     */
    function validateThreadResponse(data) {
        if (!data?.thread_id || !data?.user_id || !data?.project_id) {
            throw new Error(CONSTANTS.ERR_INVALID_THREAD_RESPONSE);
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
                ${CONSTANTS.MSG_LOADING}
            `;
        } else {
            domElements.authProceed.innerHTML = domElements.authProceed.dataset.originalHtml || CONSTANTS.MSG_ENTER;
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
        if (domElements.appRoot) domElements.appRoot.classList.add('blurred');
        if (domElements.authGate) domElements.authGate.classList.remove('hidden');
        if (domElements.authGateLogo) domElements.authGateLogo.classList.remove('hidden');
    }

    /**
     * Nasconde l'authGate
     */
    function hideGate() {
        if (domElements.appRoot) domElements.appRoot.classList.remove('blurred');
        if (domElements.authGate) domElements.authGate.classList.add('hidden');
        if (domElements.authGateLogo) domElements.authGateLogo.classList.add('hidden');
    }

    /**
     * Imposta visibilità di un elemento
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
     * Mostra un messaggio di errore temporaneo
     * @param {HTMLElement} element - Elemento dove mostrare il messaggio
     * @param {string} message - Messaggio da mostrare
     */
    function showFlash(element, message) {
        if (!element) return;
        element.textContent = message;
        element.classList.remove('d-none');
    }

    /**
     * Nasconde un messaggio di errore
     * @param {HTMLElement} element - Elemento da nascondere
     */
    function hideFlash(element) {
        if (!element) return;
        element.classList.add('d-none');
    }

    /**
     * Focus sull'input utente
     */
    function focusUserInput() {
        setTimeout(() => domElements.authUserId?.focus(), CONSTANTS.FOCUS_DELAY_MS);
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        loadUserProject
    };
})();
