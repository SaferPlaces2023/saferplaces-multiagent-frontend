// Pannello utente (esclusivo rispetto al pannello layer)
const UserPanel = (() => {
    const LS_THREAD = 'thread_id';
    const LS_USER = 'user_id';
    const LS_PROJ = 'project_id';

    // opzionale: endpoint per ricaricare lista progetti
    const ENDPOINT_USER = 'http://localhost:5000/user'; // POST {user_id} -> {user_id, projects:[]}

    let userSidebar, toggleUserBtn, logoutBtn, projectsWrap;
    let infoUserId, infoProjectId, infoThreadId;

    function init() {
        userSidebar = document.getElementById('userSidebar');
        toggleUserBtn = document.getElementById('toggleUserBtn');
        logoutBtn = document.getElementById('logoutBtn');
        projectsWrap = document.getElementById('userProjects');

        infoUserId = document.getElementById('infoUserId');
        infoProjectId = document.getElementById('infoProjectId');
        infoThreadId = document.getElementById('infoThreadId');

        // nuovo progetto (UI)
        const newProjBtn = document.getElementById('newProjBtn');
        const newProjForm = document.getElementById('newProjForm');
        const newProjName = document.getElementById('newProjName');
        const newProjCreateBtn = document.getElementById('newProjCreateBtn');
        const newProjError = document.getElementById('newProjError');


        // toggle pannello utente (chiude quello layer)
        toggleUserBtn?.addEventListener('click', () => {
            const layerSidebar = document.getElementById('sidebar'); // pannello layer esistente
            layerSidebar?.classList.add('closed');
            userSidebar.classList.toggle('closed');

            if (!userSidebar.classList.contains('closed')) {
                // appena aperto → sincronizza info + progetti
                fillInfo();
                loadProjects();
            }
        });

        // logout → pulisce storage e ricarica (torna auth gate)
        logoutBtn?.addEventListener('click', () => {
            localStorage.removeItem(LS_THREAD);
            localStorage.removeItem(LS_USER);
            localStorage.removeItem(LS_PROJ);
            location.reload();
        });

        // toggle form "Nuovo progetto"
        newProjBtn?.addEventListener('click', () => {
            newProjForm.classList.toggle('d-none');
            if (!newProjForm.classList.contains('d-none')) setTimeout(() => newProjName?.focus(), 50);
        });

        // crea progetto
        newProjCreateBtn?.addEventListener('click', createNewProject);
        newProjName?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') createNewProject();
        });


        // chiudi pannello utente se si apre quello layer
        document.getElementById('toggleBtn')?.addEventListener('click', () => {
            userSidebar.classList.add('closed');
        });

        // Azioni menu "⋯"
        projectsWrap?.addEventListener('click', (e) => {
            const a = e.target.closest('[data-action]');
            if (!a) return;
            e.preventDefault();
            const action = a.dataset.action;
            const project = a.dataset.project;
            if (!project) return;

            if (action === 'open') {
                // apri il progetto selezionato: chiama lo stesso flusso del gate
                const currentUser = localStorage.getItem(LS_USER);
                if (!currentUser) return;
                // riusa la tua load_user_project esistente, se è globale:
                if (window.AuthGate && typeof AuthGate !== 'undefined' && AuthGate.loadUserProject) {
                    AuthGate.loadUserProject(currentUser, project);
                } else {
                    // fallback: semplice POST come nel gate
                    fetch(Routes.Agent.NEWTHREAD, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: currentUser, project_id: project })
                    })
                        .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
                        .then(data => {
                            if (!data.thread_id || !data.user_id || !data.project_id) throw new Error('Invalid response');
                            localStorage.setItem(LS_THREAD, data.thread_id);
                            localStorage.setItem(LS_USER, data.user_id);
                            localStorage.setItem(LS_PROJ, data.project_id);
                            fillInfo();
                        })
                        .catch(err => console.error(err));
                }
            } else if (action === 'export') {
                // qui puoi agganciare la tua logica di export
                console.log('Export progetto:', project);
            }
        });

        // aggiorna info al boot (se già loggato)
        fillInfo();
    }

    function fillInfo() {
        infoUserId.textContent = localStorage.getItem(LS_USER) || '—';
        infoProjectId.textContent = localStorage.getItem(LS_PROJ) || '—';
        infoThreadId.innerHTML = `<code>${localStorage.getItem(LS_THREAD) || '—'}</code>`;
    }

    function loadProjects() {
        const currentUser = localStorage.getItem(LS_USER);
        const currentProj = localStorage.getItem(LS_PROJ);
        if (!currentUser) return;

        // ricarica lista progetti dal backend
        fetch(ENDPOINT_USER, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser })
        })
            .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
            .then(data => {
                console.log(data)
                const list = (data && Array.isArray(data.projects)) ? data.projects : [];
                renderProjects(list.filter(p => p !== currentProj));
            })
            .catch(err => {
                console.error(err);
                renderProjects([]); // fallback vuoto
            });
    }

    function renderProjects(projects) {
        projectsWrap.innerHTML = '';
        if (!projects.length) {
            projectsWrap.innerHTML = '<div class="text-secondary small">Nessun altro progetto</div>';
            return;
        }
        for (const p of projects) {
            const row = document.createElement('div');
            row.className = 'project-item';
            row.innerHTML = `
        <span class="project-name">${p}</span>
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-light" data-bs-toggle="dropdown" aria-expanded="false">⋯</button>
          <ul class="dropdown-menu dropdown-menu-dark">
            <li><a class="dropdown-item" href="#" data-action="open" data-project="${p}">Apri</a></li>
            <li><a class="dropdown-item" href="#" data-action="export" data-project="${p}">Esporta</a></li>
          </ul>
        </div>
      `;
            projectsWrap.appendChild(row);
        }
    }

    // opzionale: esponi una funzione per aprire progetti dall’esterno
    function openProject(projectId) {
        const currentUser = localStorage.getItem(LS_USER);
        if (!currentUser || !projectId) return;
        // come sopra...
    }

    function createNewProject() {
        const name = (newProjName.value || '').trim();
        if (!name) {
            showNewProjError('Inserisci un nome progetto');
            return;
        }
        const currentUser = localStorage.getItem(LS_USER);
        if (!currentUser) {
            showNewProjError('Utente non valido. Riesegui l’accesso.');
            return;
        }

        // lock bottone con spinner
        const prev = newProjCreateBtn.innerHTML;
        newProjCreateBtn.disabled = true;
        newProjCreateBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        `;

        function showNewProjError(msg) {
            if (!newProjError) return;
            newProjError.textContent = msg;
            newProjError.classList.remove('d-none');
            setTimeout(() => newProjError.classList.add('d-none'), 2500);
        }

        // Usa lo stesso flusso del gate: POST /t crea/attiva il progetto e ritorna thread/user/project
        fetch(Routes.Agent.NEWTHREAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser, project_id: name })
        })
            .then(r => r.ok ? r.json() : Promise.reject('HTTP ' + r.status))
            .then(data => {
                if (!data.thread_id || !data.user_id || !data.project_id) throw new Error('Invalid response');

                // salva e aggiorna UI
                localStorage.setItem(LS_THREAD, data.thread_id);
                localStorage.setItem(LS_USER, data.user_id);
                localStorage.setItem(LS_PROJ, data.project_id);

                // aggiorna header info + lista progetti (escluderà quello corrente)
                fillInfo();
                loadProjects();

                // reset form e nascondi
                newProjName.value = '';
                newProjForm.classList.add('d-none');

                // chiudi pannello utente dopo creazione
                userSidebar.classList.add('closed');
                // eventualmente apri pannello layer:
                document.getElementById('sidebar')?.classList.remove('closed');

            })
            .catch(err => {
                console.error(err);
                showNewProjError('Creazione non riuscita. Riprova.');
            })
            .finally(() => {
                newProjCreateBtn.disabled = false;
                newProjCreateBtn.innerHTML = prev;
            });
    }


    return { init, openProject, fillInfo };
})();
