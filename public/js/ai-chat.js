/**
 * AIChat - Modulo gestione chat multiagent
 * 
 * Responsabilità:
 * - Interazione UI (input, invio messaggi, visualizzazione)
 * - Comunicazione con backend agent
 * - Rendering messaggi, tool calls e tool responses
 * - Gestione del thread (creazione, switch)
 * 
 * Dipendenze: _utils.js, _consts.js
 */
const AIChat = (() => {

    const MODULE_SUMMARY = {
        // COSTANTI E CONFIGURAZIONE
        DOM_IDS: 'Mapping ID elementi DOM: chatBox, chatInput, sendBtn, buttons',

        // STATO INTERNO
        domElements: 'Cache riferimenti DOM elements dalla mappa DOM_IDS',

        // INIZIALIZZAZIONE
        init: 'Entry point: cachea DOM, configura marked, bind events',
        configureMarked: 'Configura libreria marked per il rendering markdown',
        bindEvents: 'Bind: minimize, new thread, settings, send, keydown',

        // GESTIONE EVENTI PRINCIPALI
        handleToggleMinimize: 'Toggle classe "min" sulla chat box + focus input',
        handleChatInputKeydown: 'Intercetta Enter (no Shift) → invia messaggio',

        // PUBLIC API
        invokeSend: 'API pubblica: invia messaggio programmaticamente',

        // GESTIONE THREAD
        onNewThread: 'Pulisce history, crea nuovo thread via backend POST',

        // INVIO MESSAGGI
        send: 'Invia messaggio a agent: fetch POST, gestisce typing, processing',
        processAgentResponse: 'Normalizza risposta a array, processa ogni elemento',
        processAgentElement: 'Routing: tool calls → tool responses → messaggi → state',
        handleStateUpdate: 'Estrae state_updates e dispatcha draw-tool update',

        // RENDERING - MESSAGGI E BOLLE
        appendBubble: 'Crea bolla di messaggio, parse markdown se AI, scrolla',
        showTyping: 'Mostra spinner + label "in calcolo..." nella chat',
        hideTyping: 'Rimuove elemento typing indicator dal DOM',
        scrollChatToBottom: 'Scrolla chat body al bottom',

        // RENDERING - TOOL CALLS E RESPONSES
        appendToolCall: 'Crea elemento details collassibile per tool call',
        appendToolResponse: 'Crea elemento details collassibile per tool response',
        createToolDetailsElement: 'Factory: crea <details> con title, id, args',

        // EXPORTED API
        'return.init': 'Inizializzazione modulo',
        'return.appendBubble': 'Aggiungi bolla messaggio (pubblica per ChatSettings?)',
        'return.showTyping': 'Mostra typing indicator (pubblica)',
        'return.hideTyping': 'Nascondi typing indicator (pubblica)',
        'return.invokeSend': 'API pubblica: invia messaggio'
    }

    // =========================================================================
    // CONFIGURATION - Resize constraints and storage
    // =========================================================================
    const CHAT_CONFIG = {
        MIN_WIDTH: 48,
        DEFAULT_WIDTH: 450,
        MAX_WIDTH: 800,
        COLLAPSE_THRESHOLD: 120,
        STORAGE_WIDTH_KEY: 'chat_sidebar_width',
        STORAGE_MIN_KEY: 'chat_sidebar_minimized',
        STORAGE_PREV_WIDTH_KEY: 'chat_sidebar_prev_width'
    };

    // =========================================================================
    // DOM_IDS MAPPING
    // =========================================================================
    const DOM_IDS = {
        chatBox: 'chatBox',
        chatBody: 'chatBody',
        chatInput: 'chatInput',
        sendBtn: 'sendMsg',
        minBtn: 'minChat',
        clearBtn: 'clearChat',
        settingsBtn: 'chatSettingsBtn',
        resizeHandle: 'chatResizeHandle'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};
    
    // Resize state
    let isResizing = false;
    let resizeStartX = 0;
    let resizeStartWidth = 0;
    
    // Minimize state
    let previousWidth = CHAT_CONFIG.DEFAULT_WIDTH;

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo AIChat
     */
    function init() {
        domElements = cacheElements(DOM_IDS);
        configureMarked();
        restoreChatState();
        setupResizeHandle();
        bindEvents();
        ChatSettings.init();
    }

    /**
     * Configura la libreria marked per il rendering markdown
     */
    function configureMarked() {
        if (typeof marked === 'undefined') {
            console.warn('[AIChat] Libreria marked non disponibile');
            return;
        }
        marked.setOptions({
            breaks: true,
            mangle: false,
            headerIds: false
        });
    }

    /**
     * Associa i listener agli eventi principali
     */
    function bindEvents() {
        if (!domElements.minBtn) return;
        
        domElements.minBtn.onclick = handleToggleMinimize;
        domElements.clearBtn?.addEventListener('click', onNewThread);
        domElements.settingsBtn?.addEventListener('click', () => ChatSettings?.togglePanel?.());
        domElements.sendBtn?.addEventListener('click', send);
        domElements.chatInput?.addEventListener('keydown', handleChatInputKeydown);
    }

    /**
     * Gestisce il toggle del minimizing della chat
     */
    function handleToggleMinimize() {
        if (!domElements.chatBox) return;
        
        const sidebarWrapper = document.querySelector('.chat-sidebar-wrapper');
        if (!sidebarWrapper) return;
        
        const isMinimized = domElements.chatBox.classList.contains(CSS_CLASSES.MIN);
        
        if (isMinimized) {
            // Minimizzato → Apri e ripristina larghezza precedente
            domElements.chatBox.classList.remove(CSS_CLASSES.MIN);
            sidebarWrapper.style.width = previousWidth + 'px';
            delayedFocus(domElements.chatInput, TIMING.FOCUS_DELAY_MS);
        } else {
            // Aperto → Salva larghezza e minimizza
            previousWidth = sidebarWrapper.offsetWidth;
            domElements.chatBox.classList.add(CSS_CLASSES.MIN);
            sidebarWrapper.style.width = CHAT_CONFIG.MIN_WIDTH + 'px';
        }
        
        saveChatState();
    }

    /**
     * Gestisce l'evento keydown dell'input chat
     * Invia il messaggio con Enter (no Shift)
     */
    function handleChatInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    // =========================================================================
    // RESIZE MANAGEMENT - Handle sidebar dragging and persistence
    // =========================================================================

    /**
     * Configura il resize handle con event listeners
     */
    function setupResizeHandle() {
        if (!domElements.resizeHandle) return;
        
        domElements.resizeHandle.addEventListener('mousedown', handleResizeStart);
    }

    /**
     * Inizia il resize della sidebar
     * @param {MouseEvent} e - Event del mouse
     */
    function handleResizeStart(e) {
        // Disabilita il resize se la chat è collassata
        if (domElements.chatBox && domElements.chatBox.classList.contains(CSS_CLASSES.MIN)) {
            return;
        }
        
        e.preventDefault();
        isResizing = true;
        resizeStartX = e.clientX;
        
        const sidebarWrapper = document.querySelector('.chat-sidebar-wrapper');
        if (sidebarWrapper) {
            resizeStartWidth = sidebarWrapper.offsetWidth;
        }
        
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        
        // Visual feedback
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    /**
     * Gestisce il movimento del mouse durante il resize
     * @param {MouseEvent} e - Event del mouse
     */
    function handleResizeMove(e) {
        if (!isResizing) return;
        
        const sidebarWrapper = document.querySelector('.chat-sidebar-wrapper');
        if (!sidebarWrapper) return;
        
        const deltaX = e.clientX - resizeStartX; // Positivo = verso destra (chat più larga), Negativo = verso sinistra (chat più stretta)
        const newWidth = resizeStartWidth + deltaX; // Chat a sinistra: drag destra = più larga
        
        // Applica min/max constraints
        const constrainedWidth = Math.max(
            CHAT_CONFIG.MIN_WIDTH,
            Math.min(newWidth, CHAT_CONFIG.MAX_WIDTH)
        );
        
        sidebarWrapper.style.width = constrainedWidth + 'px';
        
        // Controlla se sotto la soglia e auto-collassa durante il drag
        if (constrainedWidth < CHAT_CONFIG.COLLAPSE_THRESHOLD && domElements.chatBox) {
            if (!domElements.chatBox.classList.contains(CSS_CLASSES.MIN)) {
                domElements.chatBox.classList.add(CSS_CLASSES.MIN);
                sidebarWrapper.style.width = CHAT_CONFIG.MIN_WIDTH + 'px';
            }
        }
    }

    /**
     * Finalizza il resize della sidebar
     */
    function handleResizeEnd() {
        if (!isResizing) return;
        
        isResizing = false;
        
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        
        // Ripristina cursor
        document.body.style.cursor = 'auto';
        document.body.style.userSelect = 'auto';
        
        const sidebarWrapper = document.querySelector('.chat-sidebar-wrapper');
        if (!sidebarWrapper) return;
        
        const currentWidth = sidebarWrapper.offsetWidth;
        
        // Controlla se la larghezza è sotto il threshold → auto-minimizza
        if (currentWidth < CHAT_CONFIG.COLLAPSE_THRESHOLD) {
            previousWidth = CHAT_CONFIG.DEFAULT_WIDTH;
            if (domElements.chatBox) {
                domElements.chatBox.classList.add(CSS_CLASSES.MIN);
            }
            sidebarWrapper.style.width = CHAT_CONFIG.MIN_WIDTH + 'px';
        } else {
            // Larghezza normale → salva
            previousWidth = currentWidth;
        }
        
        saveChatState();
    }

    /**
     * Salva lo stato minimizzato della chat
     */
    function saveChatState() {
        if (!domElements.chatBox) return;
        
        const isMinimized = domElements.chatBox.classList.contains(CSS_CLASSES.MIN);
        localStorage.setItem(CHAT_CONFIG.STORAGE_MIN_KEY, String(isMinimized));
        
        const sidebarWrapper = document.querySelector('.chat-sidebar-wrapper');
        if (sidebarWrapper) {
            const currentWidth = sidebarWrapper.offsetWidth;
            localStorage.setItem(CHAT_CONFIG.STORAGE_WIDTH_KEY, String(currentWidth));
        }
        
        localStorage.setItem(CHAT_CONFIG.STORAGE_PREV_WIDTH_KEY, String(previousWidth));
    }

    /**
     * Ripristina lo stato della chat da localStorage
     */
    function restoreChatState() {
        // Ripristina previousWidth
        const savedPrevWidth = localStorage.getItem(CHAT_CONFIG.STORAGE_PREV_WIDTH_KEY);
        if (savedPrevWidth) {
            previousWidth = Math.max(
                CHAT_CONFIG.MIN_WIDTH,
                Math.min(Number(savedPrevWidth), CHAT_CONFIG.MAX_WIDTH)
            );
        }
        
        // Ripristina larghezza
        const savedWidth = localStorage.getItem(CHAT_CONFIG.STORAGE_WIDTH_KEY);
        if (savedWidth) {
            const sidebarWrapper = document.querySelector('.chat-sidebar-wrapper');
            if (sidebarWrapper) {
                const width = Math.max(
                    CHAT_CONFIG.MIN_WIDTH,
                    Math.min(Number(savedWidth), CHAT_CONFIG.MAX_WIDTH)
                );
                sidebarWrapper.style.width = width + 'px';
            }
        }
        
        // Ripristina stato minimizzato
        const savedMinimized = localStorage.getItem(CHAT_CONFIG.STORAGE_MIN_KEY);
        if (savedMinimized === 'true' && domElements.chatBox) {
            domElements.chatBox.classList.add(CSS_CLASSES.MIN);
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * API pubblica per inviare un messaggio programmaticamente
     * @param {string} message - Il messaggio da inviare
     */
    function invokeSend(message) {
        if (!message || typeof message !== 'string' || message.trim() === '') {
            return;
        }
        if (domElements.chatInput) {
            domElements.chatInput.value = message;
        }
        send();
    }

    // =========================================================================
    // GESTIONE THREAD
    // =========================================================================

    /**
     * Crea un nuovo thread di chat
     * Pulisce la cronologia messaggi e comunica con il backend
     */
    function onNewThread() {
        if (!domElements.chatBody) return;
        
        domElements.chatBody.innerHTML = '';

        const toastId = Toasts.show(MESSAGES.CREATING_CHAT);
        
        const userId = getStorageValue(STORAGE_KEYS.USER_ID);
        const projectId = getStorageValue(STORAGE_KEYS.PROJECT_ID);

        const payload = {
            user_id: userId,
            project_id: projectId
        };

        fetch(Routes?.Agent?.NEWTHREAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            saveSessionToStorage(data);

            const message = `New chat created [ <code>${data.thread_id}</code> ]`;
            Toasts.ok(toastId, message);
            UserPanel?.fillInfo?.();
        })
        .catch(error => {
            console.error('[AIChat] Error creating new thread:', error);
            Toasts.error(toastId, ERRORS.CREATE_CHAT_FAILED);
        });
    }

    // =========================================================================
    // INVIO MESSAGGI
    // =========================================================================

    /**
     * Invia un messaggio all'agent remoto
     * Gestisce visualizzazione UI, typing indicator, e processing della risposta
     */
    async function send() {
        const messageText = domElements.chatInput?.value?.trim();
        if (!messageText) return;

        appendBubble(messageText, CSS_CLASSES.USER);
        if (domElements.chatInput) {
            domElements.chatInput.value = '';
        }

        const typingIndicator = showTyping();

        try {
            const threadId = getStorageValue(STORAGE_KEYS.THREAD_ID);
            if (!threadId) {
                hideTyping(typingIndicator);
                appendBubble(ERRORS.NO_ACTIVE_THREAD, CSS_CLASSES.AI);
                return;
            }

            if (!Routes?.Agent?.THREAD) {
                hideTyping(typingIndicator);
                appendBubble(ERRORS.AGENT_CONTACT, CSS_CLASSES.AI);
                console.error('[AIChat] Routes.Agent.THREAD non configurato');
                return;
            }

            const response = await fetch(Routes.Agent.THREAD(threadId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: messageText })
            });

            if (!response.ok) {
                hideTyping(typingIndicator);
                appendBubble(ERRORS.AGENT_CONTACT, CSS_CLASSES.AI);
                console.error(`[AIChat] HTTP ${response.status}: ${response.statusText}`);
                return;
            }

            const data = await response.json();
            hideTyping(typingIndicator);

            processAgentResponse(data);

        } catch (error) {
            hideTyping(typingIndicator);
            appendBubble(ERRORS.AGENT_CONTACT, CSS_CLASSES.AI);
            console.error('[AIChat] Error sending message:', error);
        }
    }

    /**
     * Processa la risposta dell'agent
     * Normalizza a array e processa ogni elemento
     * @param {Object|Array} data - Risposta dall'agent
     */
    function processAgentResponse(data) {
        const items = Array.isArray(data) ? data.flat() : [data];
        
        items
            .filter(item => item && item.role !== 'user')
            .forEach(element => processAgentElement(element));
    }

    /**
     * Processa un singolo elemento della risposta agent
     * Gestisce tool calls, tool responses, messaggi AI e state updates
     * @param {Object} element - Elemento della risposta
     */
    function processAgentElement(element) {
        if (!element) return;

        // Tool calls
        if (element.tool_calls && Array.isArray(element.tool_calls) && element.tool_calls.length > 0) {
            element.tool_calls.forEach(call => appendToolCall(call));
            return;
        }

        // Tool response
        if (element.role === 'tool') {
            appendToolResponse(element);
            dispatchEvent('layer:reload-project-layers', {});
            return;
        }

        // Messaggi standard (AI, system, etc)
        appendBubble(element.content || '(no response)', element.role || CSS_CLASSES.AI);

        // State updates (interrupt)
        if (element.role === 'interrupt' && element.state_updates) {
            handleStateUpdate(element.state_updates);
        }
    }

    /**
     * Gestisce gli state updates dalla risposta dell'agent
     * @param {Object} stateUpdates - Oggetto con i state updates
     */
    function handleStateUpdate(stateUpdates) {
        if (!stateUpdates) return;

        if (Object.prototype.hasOwnProperty.call(stateUpdates, 'user_drawn_shapes')) {
            dispatchEvent('draw-tool:update-user-drawn-shapes', {
                user_drawn_shapes: stateUpdates.user_drawn_shapes
            });
        }
    }

    // =========================================================================
    // RENDERING - MESSAGGI E BOLLE
    // =========================================================================

    /**
     * Aggiunge una bolla di messaggio al chat
     * @param {string} text - Testo del messaggio
     * @param {string} who - Mittente ('user', 'ai', etc)
     * @returns {HTMLElement} L'elemento della bolla creato
     */
    function appendBubble(text, who = CSS_CLASSES.AI) {
        if (!domElements.chatBody) return null;

        const bubble = document.createElement('div');
        bubble.className = `${CSS_CLASSES.BUBBLE} ${who}`;

        if (who === CSS_CLASSES.AI || who === 'interrupt') {
            try {
                if (typeof marked !== 'undefined') {
                    const html = marked.parse(text);
                    bubble.innerHTML = html;
                } else {
                    bubble.textContent = text;
                }
            } catch (error) {
                console.error('[AIChat] Error parsing markdown:', error);
                bubble.textContent = text;
            }
        } else {
            bubble.textContent = text;
        }

        domElements.chatBody.appendChild(bubble);
        scrollChatToBottom();
        return bubble;
    }

    /**
     * Mostra l'indicatore di typing (in calcolo)
     * @param {string} label - Etichetta da mostrare
     * @returns {HTMLElement} L'elemento dell'indicatore
     */
    function showTyping(label = MESSAGES.TYPING) {
        if (!domElements.chatBody) return null;

        const wrapper = document.createElement('div');
        wrapper.className = `${CSS_CLASSES.BUBBLE} ${CSS_CLASSES.TYPING}`;
        wrapper.innerHTML = `
            <div class="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>
            <span class="small text-secondary">${escapeHtml(label)}</span>`;

        domElements.chatBody.appendChild(wrapper);
        scrollChatToBottom();
        return wrapper;
    }

    /**
     * Nasconde l'indicatore di typing
     * @param {HTMLElement} node - Elemento dell'indicatore
     */
    function hideTyping(node) {
        if (node && node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }

    /**
     * Scrolla la chat al bottom
     */
    function scrollChatToBottom() {
        if (domElements.chatBody) {
            domElements.chatBody.scrollTop = domElements.chatBody.scrollHeight;
        }
    }

    // =========================================================================
    // RENDERING - TOOL CALLS E RESPONSES
    // =========================================================================

    /**
     * Aggiunge una visualizzazione di tool call al chat
     * @param {Object} call - Oggetto tool call
     */
    function appendToolCall(call) {
        if (!call || !domElements.chatBody) return;

        const bubble = document.createElement('div');
        bubble.className = `${CSS_CLASSES.BUBBLE} ${CSS_CLASSES.AI}`;

        const details = createToolDetailsElement(
            'tool call:',
            call.name || 'tool',
            `ID: ${String(call.id || '—')}`,
            JSON.stringify(call.args ?? {}, null, 2)
        );

        bubble.appendChild(details);
        domElements.chatBody.appendChild(bubble);
        scrollChatToBottom();
    }

    /**
     * Aggiunge una visualizzazione di tool response al chat
     * @param {Object} msg - Oggetto tool response
     */
    function appendToolResponse(msg) {
        if (!msg || !domElements.chatBody) return;

        const bubble = document.createElement('div');
        bubble.className = `${CSS_CLASSES.BUBBLE} ${CSS_CLASSES.AI}`;

        const details = createToolDetailsElement(
            'tool response:',
            msg.name || 'tool',
            `Call ID: ${String(msg.tool_call_id || '—')}`,
            String(msg.content ?? '')
        );

        bubble.appendChild(details);
        domElements.chatBody.appendChild(bubble);
        scrollChatToBottom();
    }

    /**
     * Crea un elemento details collassibile per tool call/response
     * @param {string} labelText - Etichetta (es: 'tool call:')
     * @param {string} toolName - Nome dello strumento
     * @param {string} idLine - Linea con ID
     * @param {string} argsContent - Contenuto dell'elemento args
     * @returns {HTMLElement} L'elemento details creato
     */
    function createToolDetailsElement(labelText, toolName, idLine, argsContent) {
        const details = document.createElement('details');
        details.className = CSS_CLASSES.TOOL_ITEM;

        const summary = document.createElement('summary');

        const head = document.createElement('div');
        head.className = CSS_CLASSES.TOOL_HEAD;

        const label = document.createElement('span');
        label.textContent = labelText;

        const code = document.createElement('code');
        code.textContent = escapeHtml(toolName);

        head.appendChild(label);
        head.appendChild(code);

        const id = document.createElement('div');
        id.className = CSS_CLASSES.TOOL_ID;
        id.textContent = idLine;

        summary.appendChild(head);
        summary.appendChild(id);

        const pre = document.createElement('pre');
        pre.className = CSS_CLASSES.TOOL_ARGS;
        pre.textContent = argsContent;

        details.appendChild(summary);
        details.appendChild(pre);

        return details;
    }

    // =========================================================================
    // EXPORTED API
    // =========================================================================

    return {
        init,
        appendBubble,
        showTyping,
        hideTyping,
        invokeSend
    };
})();
