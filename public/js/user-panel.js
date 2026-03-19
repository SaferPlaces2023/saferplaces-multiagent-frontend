/**
 * UserPanel - Modulo gestione pannello utente e progetti
 * 
 * Responsabilità:
 * - Visualizzazione info utente (user_id, project_id, thread_id)
 * - Gestione lista progetti
 * - Creazione nuovo progetto
 * - Switch tra progetti
 * - Logout e pulizia storage
 * 
 * Dipendenze: _utils.js, _consts.js
 */
const UserPanel = (() => {
    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
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
        domElements = cacheElements(DOM_IDS);
        bindEvents();
        fillInfo();
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
                domElements.userSidebar.classList.add(CSS_CLASSES.CLOSED);
            }
            // Collapse wrapper only if layer panel is also closed
            if (domElements.layerSidebar && domElements.layerSidebar.classList.contains(CSS_CLASSES.CLOSED)) {
                window.LayerPanel?.collapseLeftSidebar?.();
            }
        });
        domElements.userProjects?.addEventListener('click', handleProjectMenuAction);
    }

    /**
     * Gestisce il toggle del pannello utente
     */
    function handleToggleUserPanel() {
        if (!domElements.userSidebar) return;

        // Close layer panel (mutually exclusive)
        if (domElements.layerSidebar && !domElements.layerSidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            domElements.layerSidebar.classList.add(CSS_CLASSES.CLOSED);
        }

        domElements.userSidebar.classList.toggle(CSS_CLASSES.CLOSED);

        if (!domElements.userSidebar.classList.contains(CSS_CLASSES.CLOSED)) {
            // Opening: expand wrapper
            window.LayerPanel?.expandLeftSidebar?.();
            fillInfo();
            loadProjects();
        } else {
            // Closing: collapse wrapper (layer panel is already closed)
            window.LayerPanel?.collapseLeftSidebar?.();
        }
    }

    /**
     * Gestisce il logout
     */
    function handleLogout() {
        clearSession();
        location.reload();
    }

    /**
     * Gestisce il toggle del form "Nuovo progetto"
     */
    function handleToggleNewProjectForm() {
        if (!domElements.newProjForm) return;

        domElements.newProjForm.classList.toggle(CSS_CLASSES.D_NONE);
        if (!domElements.newProjForm.classList.contains(CSS_CLASSES.D_NONE)) {
            delayedFocus(domElements.newProjName, TIMING.FOCUS_DELAY_MS);
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

        const currentUser = getStorageValue(STORAGE_KEYS.USER_ID);
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
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                validateThreadResponse(data);
                saveSessionToStorage(data);
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
            showProjectError(ERRORS.INVALID_PROJECT_NAME);
            return;
        }

        const currentUser = getStorageValue(STORAGE_KEYS.USER_ID);
        if (!currentUser) {
            showProjectError(ERRORS.INVALID_USER);
            return;
        }

        if (!Routes?.Agent?.NEWTHREAD) {
            console.error('[UserPanel] Routes.Agent.NEWTHREAD non configurato');
            showProjectError(ERRORS.CREATION_FAILED);
            return;
        }

        lockProjectButton(true);

        fetch(Routes.Agent.NEWTHREAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser, project_id: projectName })
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                validateThreadResponse(data);
                saveSessionToStorage(data);
                resetProjectForm();
                fillInfo();
                loadProjects();
                closeUserSidebar();
            })
            .catch(err => {
                console.error('[UserPanel] Error creating project:', err);
                showProjectError(ERRORS.CREATION_FAILED);
            })
            .finally(() => {
                lockProjectButton(false);
            });
    }

    /**
     * Carica la lista progetti dal backend
     */
    function loadProjects() {
        const currentUser = getStorageValue(STORAGE_KEYS.USER_ID);
        const currentProject = getStorageValue(STORAGE_KEYS.PROJECT_ID);

        if (!currentUser) return;

        fetch(Routes.Agent.USER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser })
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
            domElements.userProjects.innerHTML = `<div class="text-secondary small">${ERRORS.NO_PROJECTS}</div>`;
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
            domElements.infoUserId.textContent = getStorageValue(STORAGE_KEYS.USER_ID) || '—';
        }
        if (domElements.infoProjectId) {
            domElements.infoProjectId.textContent = getStorageValue(STORAGE_KEYS.PROJECT_ID) || '—';
        }
        if (domElements.infoThreadId) {
            const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID) || '—';
            domElements.infoThreadId.innerHTML = `<code>${escapeHtml(threadId)}</code>`;
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

        showFlash(domElements.newProjError, message);
        delayedHide(domElements.newProjError, TIMING.TOAST_DURATION_MS);
    }

    /**
     * Resetta la form di creazione progetto
     */
    function resetProjectForm() {
        if (domElements.newProjName) {
            domElements.newProjName.value = '';
        }
        if (domElements.newProjForm) {
            domElements.newProjForm.classList.add(CSS_CLASSES.D_NONE);
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
            domElements.userSidebar.classList.add(CSS_CLASSES.CLOSED);
        }
        // Switch to layer panel (wrapper stays expanded)
        if (domElements.layerSidebar) {
            domElements.layerSidebar.classList.remove(CSS_CLASSES.CLOSED);
        }
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
