/**
 * UserPanel - Modulo gestione pannello utente e progetti
 * 
 * Responsabilità:
 * - Visualizzazione info utente (user_id, project_id, thread_id)
 * - Gestione lista progetti
 * - Creazione nuovo progetto
 * - Switch tra progetti
 * - Logout e pulizia storage
 */
const UserPanel = (() => {
    // =========================================================================
    // COSTANTI
    // =========================================================================
    const CONSTANTS = {
        LS_THREAD_ID: 'thread_id',
        LS_USER_ID: 'user_id',
        LS_PROJECT_ID: 'project_id',
        ENDPOINT_USER: 'http://localhost:5000/user',
        FOCUS_DELAY_MS: 50,
        TOAST_DURATION_MS: 2500,
        ERR_INVALID_PROJECT_NAME: 'Inserisci un nome progetto',
        ERR_INVALID_USER: 'Invalid user. Access needed.',
        ERR_CREATION_FAILED: 'Creation failed. Try again.',
        ERR_HTTP_PREFIX: 'HTTP ',
        ERR_INVALID_RESPONSE: 'Invalid response',
        MSG_NO_PROJECTS: 'No other projects'
    };

    const DOM_IDS = {
        userSidebar: 'userSidebar',
        toggleUserBtn: 'toggleUserBtn',
        logoutBtn: 'logoutBtn',
        userProjects: 'userProjects',
        infoUserId: 'infoUserId',
        infoProjectId: 'infoProjectId',
        infoThreadId: 'infoThreadId',
        newProjBtn: 'newProjBtn',
        newProjForm: 'newProjForm',
        newProjName: 'newProjName',
        newProjCreateBtn: 'newProjCreateBtn',
        newProjError: 'newProjError',
        toggleBtn: 'toggleBtn',
        layerSidebar: 'sidebar'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo UserPanel
     */
    function init() {
        cacheElements();
        bindEvents();
        fillInfo();
    }

    /**
     * Cachea i riferimenti agli elementi DOM
     */
    function cacheElements() {
        Object.entries(DOM_IDS).forEach(([key, id]) => {
            domElements[key] = document.getElementById(id);
            if (!domElements[key]) {
                console.warn(`[UserPanel] Elemento DOM non trovato: ${id}`);
            }
        });
    }

    /**
     * Associa i listener agli eventi
     */
    function bindEvents() {
        domElements.toggleUserBtn?.addEventListener('click', handleToggleUserPanel);
        domElements.logoutBtn?.addEventListener('click', handleLogout);
        domElements.newProjBtn?.addEventListener('click', handleToggleNewProjectForm);
        domElements.newProjCreateBtn?.addEventListener('click', handleCreateProject);
        domElements.newProjName?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleCreateProject();
        });
        domElements.toggleBtn?.addEventListener('click', () => {
            if (domElements.userSidebar) {
                domElements.userSidebar.classList.add('closed');
            }
        });
        domElements.userProjects?.addEventListener('click', handleProjectMenuAction);
    }

    /**
     * Gestisce il toggle del pannello utente
     */
    function handleToggleUserPanel() {
        if (!domElements.userSidebar || !domElements.layerSidebar) return;

        domElements.layerSidebar.classList.add('closed');
        domElements.userSidebar.classList.toggle('closed');

        if (!domElements.userSidebar.classList.contains('closed')) {
            fillInfo();
            loadProjects();
        }
    }

    /**
     * Gestisce il logout
     */
    function handleLogout() {
        localStorage.removeItem(CONSTANTS.LS_THREAD_ID);
        localStorage.removeItem(CONSTANTS.LS_USER_ID);
        localStorage.removeItem(CONSTANTS.LS_PROJECT_ID);
        location.reload();
    }

    /**
     * Gestisce il toggle del form "Nuovo progetto"
     */
    function handleToggleNewProjectForm() {
        if (!domElements.newProjForm) return;

        domElements.newProjForm.classList.toggle('d-none');
        if (!domElements.newProjForm.classList.contains('d-none')) {
            setTimeout(() => domElements.newProjName?.focus(), CONSTANTS.FOCUS_DELAY_MS);
        }
    }

    // =========================================================================
    // AZIONI MENU PROGETTI
    // =========================================================================

    /**
     * Gestisce le azioni sul menu dei progetti (open, export)
     * @param {Event} event - L'evento click
     */
    function handleProjectMenuAction(event) {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        event.preventDefault();
        const action = actionElement.dataset.action;
        const projectId = actionElement.dataset.project;

        if (!projectId) return;

        if (action === 'open') {
            handleOpenProject(projectId);
        } else if (action === 'export') {
            handleExportProject(projectId);
        }
    }

    /**
     * Apre un progetto selezionato
     * @param {string} projectId - ID del progetto
     */
    function handleOpenProject(projectId) {
        if (!Routes?.Agent?.NEWTHREAD) {
            console.error('[UserPanel] Routes.Agent.NEWTHREAD non configurato');
            return;
        }

        const currentUser = localStorage.getItem(CONSTANTS.LS_USER_ID);
        if (!currentUser) return;

        // Prova AuthGate se disponibile
        if (window.AuthGate?.loadUserProject) {
            AuthGate.loadUserProject(currentUser, projectId);
            return;
        }

        // Fallback: POST diretto
        fetch(Routes.Agent.NEWTHREAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser, project_id: projectId })
        })
            .then(response => {
                if (!response.ok) throw new Error(`${CONSTANTS.ERR_HTTP_PREFIX}${response.status}`);
                return response.json();
            })
            .then(data => {
                validateProjectResponse(data);
                saveProjectToStorage(data);
                fillInfo();
            })
            .catch(err => {
                console.error('[UserPanel] Error opening project:', err);
            });
    }

    /**
     * Gestisce l'export di un progetto
     * @param {string} projectId - ID del progetto
     */
    function handleExportProject(projectId) {
        // TODO: agganciare la logica di export
        console.log('[UserPanel] Export progetto:', projectId);
    }

    // =========================================================================
    // GESTIONE PROGETTI
    // =========================================================================

    /**
     * Crea un nuovo progetto
     */
    function handleCreateProject() {
        const projectName = (domElements.newProjName?.value || '').trim();

        if (!projectName) {
            showProjectError(CONSTANTS.ERR_INVALID_PROJECT_NAME);
            return;
        }

        const currentUser = localStorage.getItem(CONSTANTS.LS_USER_ID);
        if (!currentUser) {
            showProjectError(CONSTANTS.ERR_INVALID_USER);
            return;
        }

        if (!Routes?.Agent?.NEWTHREAD) {
            console.error('[UserPanel] Routes.Agent.NEWTHREAD non configurato');
            showProjectError(CONSTANTS.ERR_CREATION_FAILED);
            return;
        }

        lockProjectButton(true);

        fetch(Routes.Agent.NEWTHREAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser, project_id: projectName })
        })
            .then(response => {
                if (!response.ok) throw new Error(`${CONSTANTS.ERR_HTTP_PREFIX}${response.status}`);
                return response.json();
            })
            .then(data => {
                validateProjectResponse(data);
                saveProjectToStorage(data);
                resetProjectForm();
                fillInfo();
                loadProjects();
                closeUserSidebar();
            })
            .catch(err => {
                console.error('[UserPanel] Error creating project:', err);
                showProjectError(CONSTANTS.ERR_CREATION_FAILED);
            })
            .finally(() => {
                lockProjectButton(false);
            });
    }

    /**
     * Carica la lista progetti dal backend
     */
    function loadProjects() {
        const currentUser = localStorage.getItem(CONSTANTS.LS_USER_ID);
        const currentProject = localStorage.getItem(CONSTANTS.LS_PROJECT_ID);

        if (!currentUser) return;

        fetch(CONSTANTS.ENDPOINT_USER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser })
        })
            .then(response => {
                if (!response.ok) throw new Error(`${CONSTANTS.ERR_HTTP_PREFIX}${response.status}`);
                return response.json();
            })
            .then(data => {
                const projects = (data?.projects && Array.isArray(data.projects)) ? data.projects : [];
                const filteredProjects = projects.filter(p => p !== currentProject);
                renderProjects(filteredProjects);
            })
            .catch(err => {
                console.error('[UserPanel] Error loading projects:', err);
                renderProjects([]);
            });
    }

    /**
     * Renderizza la lista progetti
     * @param {Array<string>} projects - Array di nomi progetti
     */
    function renderProjects(projects) {
        if (!domElements.userProjects) return;

        domElements.userProjects.innerHTML = '';

        if (!projects || projects.length === 0) {
            domElements.userProjects.innerHTML = `<div class="text-secondary small">${CONSTANTS.MSG_NO_PROJECTS}</div>`;
            return;
        }

        projects.forEach(projectName => {
            const row = document.createElement('div');
            row.className = 'project-item';
            row.innerHTML = `
                <span class="project-name">${escapeHtml(projectName)}</span>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-light" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
                    <ul class="dropdown-menu dropdown-menu-dark">
                        <li><a class="dropdown-item" href="#" data-action="open" data-project="${escapeHtml(projectName)}">Open</a></li>
                        <li><a class="dropdown-item" href="#" data-action="export" data-project="${escapeHtml(projectName)}">Export</a></li>
                    </ul>
                </div>
            `;
            domElements.userProjects.appendChild(row);
        });
    }

    /**
     * Apre un progetto (API pubblica)
     * @param {string} projectId - ID del progetto
     */
    function openProject(projectId) {
        if (!projectId) return;
        handleOpenProject(projectId);
    }

    // =========================================================================
    // UTENTE - INFO E STORAGE
    // =========================================================================

    /**
     * Aggiorna il display con le info utente da localStorage
     */
    function fillInfo() {
        if (domElements.infoUserId) {
            domElements.infoUserId.textContent = localStorage.getItem(CONSTANTS.LS_USER_ID) || '—';
        }
        if (domElements.infoProjectId) {
            domElements.infoProjectId.textContent = localStorage.getItem(CONSTANTS.LS_PROJECT_ID) || '—';
        }
        if (domElements.infoThreadId) {
            const threadId = localStorage.getItem(CONSTANTS.LS_THREAD_ID) || '—';
            domElements.infoThreadId.innerHTML = `<code>${escapeHtml(threadId)}</code>`;
        }
    }

    /**
     * Salva i dati del progetto in localStorage
     * @param {Object} data - Oggetto con thread_id, user_id, project_id
     */
    function saveProjectToStorage(data) {
        localStorage.setItem(CONSTANTS.LS_THREAD_ID, data.thread_id);
        localStorage.setItem(CONSTANTS.LS_USER_ID, data.user_id);
        localStorage.setItem(CONSTANTS.LS_PROJECT_ID, data.project_id);
    }

    /**
     * Valida la risposta di un progetto dal backend
     * @param {Object} data - Dati da validare
     * @throws {Error} Se la risposta non è valida
     */
    function validateProjectResponse(data) {
        if (!data?.thread_id || !data?.user_id || !data?.project_id) {
            throw new Error(CONSTANTS.ERR_INVALID_RESPONSE);
        }
    }

    // =========================================================================
    // FORM HELPERS
    // =========================================================================

    /**
     * Mostra un messaggio di errore nella form
     * @param {string} message - Messaggio di errore
     */
    function showProjectError(message) {
        if (!domElements.newProjError) return;

        domElements.newProjError.textContent = message;
        domElements.newProjError.classList.remove('d-none');
        setTimeout(() => {
            domElements.newProjError?.classList.add('d-none');
        }, CONSTANTS.TOAST_DURATION_MS);
    }

    /**
     * Resetta la form di creazione progetto
     */
    function resetProjectForm() {
        if (domElements.newProjName) {
            domElements.newProjName.value = '';
        }
        if (domElements.newProjForm) {
            domElements.newProjForm.classList.add('d-none');
        }
    }

    /**
     * Abilita/disabilita il bottone di creazione con spinner
     * @param {boolean} locked - true per disabilitare, false per abilitare
     */
    function lockProjectButton(locked) {
        if (!domElements.newProjCreateBtn) return;

        if (locked) {
            domElements.newProjCreateBtn.disabled = true;
            domElements.newProjCreateBtn.dataset.originalContent = domElements.newProjCreateBtn.innerHTML;
            domElements.newProjCreateBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            `;
        } else {
            domElements.newProjCreateBtn.disabled = false;
            domElements.newProjCreateBtn.innerHTML = domElements.newProjCreateBtn.dataset.originalContent || 'Create';
        }
    }

    /**
     * Chiude il pannello utente e apre layer sidebar
     */
    function closeUserSidebar() {
        if (domElements.userSidebar) {
            domElements.userSidebar.classList.add('closed');
        }
        if (domElements.layerSidebar) {
            domElements.layerSidebar.classList.remove('closed');
        }
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    /**
     * Escapa stringhe per evitare XSS in innerHTML
     * @param {string} str - Stringa da escapare
     * @returns {string} Stringa escapata
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        openProject,
        fillInfo
    };
})();
