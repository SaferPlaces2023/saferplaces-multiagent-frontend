// =========================================================================
// GESTIONE ROTTE API
// =========================================================================
const Routes = (() => {
    const Agent = (() => {
        let flask_base = '';
        let localhost_base = 'http://localhost:5000';
        let agent_base = 'agent';
        let ngrock_base = ' https://bdc1201eff1b.ngrok-free.app';

        const BASE = flask_base
        const NEWTHREAD = `${BASE}/t`;
        const THREAD = (threadId) => `${BASE}/t/${threadId}`;
        const USER = `${BASE}/user`;
        const STATE = (threadId) => `${THREAD(threadId)}/state`;
        const LAYERS = (threadId) => `${THREAD(threadId)}/layers`;
        const RENDER = (threadId) => `${THREAD(threadId)}/render`;
        const LAYER_URL = `${BASE}/get-layer-url`;
        const REGISTER_VECTOR = (threadId) => `${THREAD(threadId)}/register-vector`;
        const REGISTER_RASTER = (threadId) => `${THREAD(threadId)}/register-raster`;

        return { 
            BASE, NEWTHREAD, THREAD, USER, STATE, LAYERS, RENDER,
            LAYER_URL, REGISTER_VECTOR, REGISTER_RASTER
        };
    })();

    return { Agent };
})();

// =========================================================================
// CHIAVI LOCALSTORAGE
// =========================================================================
const STORAGE_KEYS = {
    THREAD_ID: 'thread_id',
    USER_ID: 'user_id',
    PROJECT_ID: 'project_id',
    AUTH_GATE_AUTO_OPEN_PROJECT: 'auth_gate_auto_open_project'
};

// =========================================================================
// TIMING COSTANTI
// =========================================================================
const TIMING = {
    FOCUS_DELAY_MS: 50,
    TOAST_DURATION_MS: 2500
};

// =========================================================================
// MESSAGGI COMUNI
// =========================================================================
const MESSAGES = {
    VERIFYING: 'Verifico…',
    LOADING: 'Project loading...',
    ENTER: 'Entra',
    CREATE_ENTER: 'Create and enter',
    CREATING_CHAT: 'Creating a new chat ...',
    TYPING: 'in calcolo…'
};

// =========================================================================
// ERRORI COMUNI
// =========================================================================
const ERRORS = {
    // Autenticazione
    INSERT_USER_ID: 'Insert a user_id',
    CHECK_FAILED: 'Check failed. Check user_id.',
    
    // Progetti
    INSERT_PROJECT_NAME: 'Insert a project name',
    NO_PROJECTS: 'No other projects',
    
    // Thread/Chat
    NO_ACTIVE_THREAD: 'No active thread. Create a new chat first.',
    AGENT_CONTACT: 'Error contacting the agent 😢. Try send again the message',
    CREATE_CHAT_FAILED: 'Error while creating new chat.',
    INVALID_THREAD_RESPONSE: 'Errore nel recupero del thread_id.',
    THREAD_RESPONSE_INVALID: 'Invalid response from server',
    PROJECT_LOADING: 'Project loading is failed. Try again.',
    LOAD_PROJECT_CACHED: 'Impossibile caricare il progetto. Riprova.',
    INVALID_PROJECT_NAME: 'Inserisci un nome progetto',
    INVALID_USER: 'Invalid user. Access needed.',
    CREATION_FAILED: 'Creation failed. Try again.',
    INVALID_RESPONSE: 'Invalid response',
    OPERATION_FAILED: 'Operation failed.'
};

// =========================================================================
// CLASSI CSS
// =========================================================================
const CSS_CLASSES = {
    // Chat
    MIN: 'min',
    BUBBLE: 'bubble',
    USER: 'user',
    AI: 'ai',
    TOOL_ITEM: 'tool-item',
    TOOL_HEAD: 'tool-head',
    TOOL_ID: 'tool-id',
    TOOL_ARGS: 'tool-args',
    TYPING: 'typing',
    
    // UI generale
    D_NONE: 'd-none',
    CLOSED: 'closed',
    BLURRED: 'blurred',
    HIDDEN: 'hidden'
};