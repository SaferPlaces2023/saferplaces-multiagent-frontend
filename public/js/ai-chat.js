/**
 * AIChat - Modulo gestione chat multiagent
 * 
 * Responsabilità:
 * - Interazione UI (input, invio messaggi, visualizzazione)
 * - Comunicazione con backend agent
 * - Rendering messaggi, tool calls e tool responses
 * - Gestione del thread (creazione, switch)
 */
const AIChat = (() => {
    // =========================================================================
    // COSTANTI
    // =========================================================================
    const CONSTANTS = {
        LS_USER_ID: 'user_id',
        LS_PROJECT_ID: 'project_id',
        LS_THREAD_ID: 'thread_id',
        FOCUS_DELAY_MS: 150,
        TYPING_LABEL: 'in calcolo…',
        ERR_NO_THREAD: 'No active thread. Create a new chat first.',
        ERR_AGENT_CONTACT: 'Error contacting the agent 😢. Try send again the message',
        ERR_CREATE_CHAT: 'Error while creating new chat.',
        MSG_CREATE_CHAT: 'Creating a new chat ...'
    };

    const DOM_IDS = {
        chatBox: 'chatBox',
        chatBody: 'chatBody',
        chatInput: 'chatInput',
        sendBtn: 'sendMsg',
        minBtn: 'minChat',
        expandBtn: 'chatExpandBtn',
        clearBtn: 'clearChat',
        settingsBtn: 'chatSettingsBtn'
    };

    const CSS_CLASSES = {
        MIN: 'min',
        BUBBLE: 'bubble',
        USER: 'user',
        AI: 'ai',
        TOOL_ITEM: 'tool-item',
        TOOL_HEAD: 'tool-head',
        TOOL_ID: 'tool-id',
        TOOL_ARGS: 'tool-args',
        TYPING: 'typing'
    };

    // =========================================================================
    // STATO INTERNO
    // =========================================================================
    let domElements = {};

    // =========================================================================
    // INIZIALIZZAZIONE
    // =========================================================================

    /**
     * Inizializza il modulo AIChat
     */
    function init() {
        cacheElements();
        configureMarked();
        bindEvents();
        ChatSettings.init();
    }

    /**
     * Cachea i riferimenti agli elementi DOM
     */
    function cacheElements() {
        Object.entries(DOM_IDS).forEach(([key, id]) => {
            domElements[key] = document.getElementById(id);
            if (!domElements[key]) {
                console.warn(`[AIChat] Elemento DOM non trovato: ${id}`);
            }
        });
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
        
        domElements.chatBox.classList.toggle(CSS_CLASSES.MIN);
        if (!domElements.chatBox.classList.contains(CSS_CLASSES.MIN)) {
            setTimeout(() => domElements.chatInput?.focus(), CONSTANTS.FOCUS_DELAY_MS);
        }
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

        const toastId = Toasts.show(CONSTANTS.MSG_CREATE_CHAT);
        
        const userId = localStorage.getItem(CONSTANTS.LS_USER_ID);
        const projectId = localStorage.getItem(CONSTANTS.LS_PROJECT_ID);

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
            localStorage.setItem(CONSTANTS.LS_THREAD_ID, data.thread_id);
            localStorage.setItem(CONSTANTS.LS_USER_ID, data.user_id);
            localStorage.setItem(CONSTANTS.LS_PROJECT_ID, data.project_id);

            const message = `New chat created [ <code>${data.thread_id}</code> ]`;
            Toasts.ok(toastId, message);
            UserPanel?.fillInfo?.();
        })
        .catch(error => {
            console.error('[AIChat] Error creating new thread:', error);
            Toasts.error(toastId, CONSTANTS.ERR_CREATE_CHAT);
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
            const threadId = localStorage.getItem(CONSTANTS.LS_THREAD_ID);
            if (!threadId) {
                hideTyping(typingIndicator);
                appendBubble(CONSTANTS.ERR_NO_THREAD, CSS_CLASSES.AI);
                return;
            }

            if (!Routes?.Agent?.THREAD) {
                hideTyping(typingIndicator);
                appendBubble(CONSTANTS.ERR_AGENT_CONTACT, CSS_CLASSES.AI);
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
                appendBubble(CONSTANTS.ERR_AGENT_CONTACT, CSS_CLASSES.AI);
                console.error(`[AIChat] HTTP ${response.status}: ${response.statusText}`);
                return;
            }

            const data = await response.json();
            hideTyping(typingIndicator);

            processAgentResponse(data);

        } catch (error) {
            hideTyping(typingIndicator);
            appendBubble(CONSTANTS.ERR_AGENT_CONTACT, CSS_CLASSES.AI);
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
    function showTyping(label = CONSTANTS.TYPING_LABEL) {
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
    // UTILITY
    // =========================================================================

    /**
     * Dispatchea un CustomEvent
     * @param {string} eventName - Nome dell'evento
     * @param {Object} detail - Dettagli dell'evento
     */
    function dispatchEvent(eventName, detail) {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

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
