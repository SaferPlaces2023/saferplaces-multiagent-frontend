// AuthGate: user_id -> (select progetto | nuovo progetto) nella stessa card
const AuthGate = (() => {
    const LS_THREAD = 'thread_id';
    const LS_USER = 'user_id';
    const LS_PROJ = 'project_id';

    let gate, appRoot;
    // user
    let inputUser, btnUser, errorUser, stepUser;
    // project area
    let area, userBadge, modeWrap, modeSwitch;
    let sectionSelect, selProject;
    let sectionCreate, inputProjectName, errorProj;
    let btnProceed;

    // stato
    let currentUser = null;
    let mode = 'select'; // 'select' | 'create'

    function init() {
        gate = document.getElementById('authGate');
        gateLogo = document.getElementById('authGateLogo');
        appRoot = document.getElementById('appRoot');

        // user
        stepUser = document.getElementById('authStepUser');
        inputUser = document.getElementById('authUserId');
        btnUser = document.getElementById('authSubmit');
        errorUser = document.getElementById('authError');

        // project area
        area = document.getElementById('authProjectArea');
        userBadge = document.getElementById('authUserBadge');
        modeWrap = document.getElementById('authModeWrap');
        modeSwitch = document.getElementById('authModeSwitch');
        sectionSelect = document.getElementById('authSectionSelect');
        selProject = document.getElementById('authProjectSelect');
        sectionCreate = document.getElementById('authSectionCreate');
        inputProjectName = document.getElementById('authProjectName');
        errorProj = document.getElementById('authProjError');
        btnProceed = document.getElementById('authProceed');

        // se user + project già presenti → chiudi gate
        const u = localStorage.getItem(LS_USER);
        const p = localStorage.getItem(LS_PROJ);
        if (u && p) {
            const t = localStorage.getItem(LS_THREAD);  
            
            fetch("http://localhost:5000/t", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ thread_id: t, user_id: u, project_id: p })
            })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                localStorage.setItem(LS_THREAD, data.thread_id);
                localStorage.setItem(LS_USER, data.user_id);
                localStorage.setItem(LS_PROJ, data.project_id);

                hideGate();
                dispatchReady(t, u, p);
            })
            .catch(err => {
                console.error(err);
                flash(errorProj, 'Impossibile caricare il progetto. Riprova.');
            });
            return;
        }

        showGate();
        // wiring base
        btnUser.onclick = verifyUser;
        inputUser.addEventListener('keydown', e => { if (e.key === 'Enter') verifyUser(); });

        modeSwitch.onchange = () => setMode(modeSwitch.checked ? 'create' : 'select');
        btnProceed.onclick = proceed;
    }

    // UI helpers
    function showGate() { appRoot.classList.add('blurred'); gate.classList.remove('hidden'); gateLogo.classList.remove('hidden'); setTimeout(() => inputUser?.focus(), 50); }
    function hideGate() { appRoot.classList.remove('blurred'); gate.classList.add('hidden'); gateLogo.classList.add('hidden')}
    function show(el) { el.classList.remove('d-none'); }
    function hide(el) { el.classList.add('d-none'); }
    function flash(el, msg) { el.textContent = msg; el.classList.remove('d-none'); setTimeout(() => el.classList.add('d-none'), 2500); }

    // Step: verify user
    async function verifyUser() {
        const userId = (inputUser.value || '').trim();
        if (!userId) return flash(errorUser, 'Inserisci uno user_id');

        // lock UI
        const prev = btnUser.textContent; btnUser.disabled = true; btnUser.textContent = 'Verifico…'; hide(errorUser);

        try {
            let cardTopBefore = document.querySelector('.auth-card').getBoundingClientRect().top;

            const res = await fetch("http://localhost:5000/user", {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            
            const data = await res.json(); // { user_id, projects: [] }

            currentUser = data.user_id || userId;
            localStorage.setItem(LS_USER, currentUser);

            // prepara area progetto
            userBadge.textContent = `utente: ${currentUser}`;
            buildProjectsUI(Array.isArray(data.projects) ? data.projects : []);

            let cardTopAfter = document.querySelector('.auth-card').getBoundingClientRect().top;
            gateLogo.style.top = `${gateLogo.getBoundingClientRect().top - (cardTopBefore - cardTopAfter)}px`;

        } catch (e) {
            console.error(e);
            flash(errorUser, 'Verifica non riuscita. Controlla lo user_id.');
        } finally {
            btnUser.disabled = false; btnUser.textContent = prev;
        }
    }

    // Progetti UI (stessa card)
    function buildProjectsUI(projects) {
        show(area); // mostra sotto allo step user

        if (projects.length === 0) {
            // modeSwitch?.onchange = () => setMode(modeSwitch.checked ? 'create' : 'select');
            // niente switch, solo "nuovo progetto"
            hide(modeWrap);
            setMode('create');
        } else {
            // popula select + mostra switch
            selProject.innerHTML = '';
            projects.forEach((p, i) => {
                const opt = document.createElement('option');
                opt.value = p; opt.textContent = p;
                if (i === 0) opt.selected = true; // primo progetto selezionato di default
                selProject.appendChild(opt);
            });
            show(modeWrap);
            modeSwitch.checked = false; // default: select
            setMode('select');
        }
    }

    // toggle selezione ↔ creazione
    function setMode(next) {
        mode = next;
        const isCreate = mode === 'create';
        sectionSelect.disabled = isCreate;
        sectionCreate.disabled = !isCreate;

        btnProceed.textContent = isCreate ? 'Crea e entra' : 'Entra';
        hide(errorProj);

        if (isCreate) setTimeout(() => inputProjectName?.focus(), 50);
        else setTimeout(() => selProject?.focus(), 50);
    }
    async function load_user_project(currentUser, project) {
        fetch("http://localhost:5000/t", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser, project_id: project })
        })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                const thread_id = data.thread_id;
                const user_id = data.user_id;
                const project_id = data.project_id;

                if (!thread_id || !user_id || !project_id) {
                    flash(errorProj, 'Errore nel recupero del thread_id.');
                    throw new Error('Invalid response from server');
                }

                localStorage.setItem(LS_THREAD, thread_id);
                localStorage.setItem(LS_USER, user_id);
                localStorage.setItem(LS_PROJ, project_id);

                // ✅ passa i parametri corretti
                setTimeout(() => {
                    finalize(thread_id, user_id, project_id)
                }, 100);
            })
            .catch(err => {
                console.error(err);
                flash(errorProj, 'Impossibile caricare il progetto. Riprova.');
            })
            .finally(() => {
                btnProceed.disabled = false;
                btnProceed.innerHTML = "Entra";
            });
    }

    // azione unica
    async function proceed() {
        let project = null;
        if (mode === 'select') {
            project = selProject.value;
            if (!project) return;
        } else {
            const name = (inputProjectName.value || '').trim();
            if (!name) return flash(errorProj, 'Inserisci un nome progetto');
            project = name;
        }

        // mostra spinner + blocca bottone
        const prev = btnProceed.innerHTML;
        btnProceed.disabled = true;
        btnProceed.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            caricamento progetto...
        `;

        try {
            load_user_project(currentUser, project);
        } catch (e) {
            console.error(e);
            flash(errorProj, 'Operazione non riuscita.');
        } finally { }
    }


    // finalize
    function finalize(thread_id, user_id, project_id) {
        hideGate();
        dispatchReady(thread_id, user_id, project_id);
    }
    function dispatchReady(thread_id, user_id, project_id) {
        document.dispatchEvent(new CustomEvent('auth:ready', { detail: { thread_id, user_id, project_id } }));
    }

    return { init };
})();
