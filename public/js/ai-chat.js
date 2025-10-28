// Chat: invio messaggi, spinner "in calcolo", demo comandi
const AIChat = (() => {
    let chatBox, chatBody, chatInput, sendBtn, minBtn, expandBtn, clearBtn;

    function init() {
        chatBox = document.getElementById('chatBox');
        chatBody = document.getElementById('chatBody');
        chatInput = document.getElementById('chatInput');
        sendBtn = document.getElementById('sendMsg');
        minBtn = document.getElementById('minChat');
        expandBtn = document.getElementById('chatExpandBtn');
        clearBtn = document.getElementById('clearChat');

        marked.setOptions({ breaks: true, mangle: false, headerIds: false });

        minBtn.onclick = () => {
            chatBox.classList.toggle('min');
            if (!chatBox.classList.contains('min')) setTimeout(() => chatInput.focus(), 150);
        };
        expandBtn.addEventListener('click', () => {
            chatBox.classList.toggle('full-height');
            const expanded = chatBox.classList.contains('full-height');
            expandBtn.textContent = expanded ? '⬏' : '⬍'; // cambia icona
            expandBtn.title = expanded ? 'Riduci altezza' : 'Espandi a tutta altezza';
        });
        clearBtn.onclick = () => { 
            chatBody.innerHTML = '';
            const LS_USER = 'user_id';
            const LS_PROJ = 'project_id';
            const LS_THREAD = 'thread_id';
            const t = Toasts.show(`Creating a new chat ...`);
            fetch(Routes.Agent.NEWTHREAD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: localStorage.getItem(LS_USER), project_id: localStorage.getItem(LS_PROJ) })
            })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                localStorage.setItem(LS_THREAD, data.thread_id);
                localStorage.setItem(LS_USER, data.user_id);
                localStorage.setItem(LS_PROJ, data.project_id);

                Toasts.ok(t, `New chat created [ <code>${data.thread_id}</code> ]`);

                UserPanel.fillInfo();
            })
            .catch(err => {
                console.error(err);
                Toasts.error(t, 'Errore durante la creazione della chat.');
            })
        };

        sendBtn.onclick = send;
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
    }

    function send() {

        function handle_command(cmd, typingNode) {
            hideTyping(typingNode);
            let reply = '';

            if (/^help$/i.test(cmd)) {
                reply = "Comandi disponibili:\n" +
                    "/dark → stile scuro\n" +
                    "/light → stile chiaro\n" +
                    "/reset → vista su Roma\n" +
                    "/clear → cancella chat";
            }
            else if (/^dark/i.test(cmd)) {
                dispatch('map:set-style', { styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' });
                reply = '🌓 Stile Dark Matter attivato.';
            }
            else if (/^light|positron/i.test(cmd)) {
                dispatch('map:set-style', { styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' });
                reply = '☀️ Stile chiaro (Positron) attivato.';
            }
            else if (/^reset/i.test(cmd)) {
                dispatch('map:reset', {});
                reply = '📍 Mappa resettata su Roma/Italia.';
            }
            else if (/^clear/i.test(cmd)) {
                chatBody.innerHTML = '';
                reply = '🧹 Chat svuotata.';
            }
            else {
                reply = `Comando “/${cmd}” non riconosciuto. Scrivi /help per l'elenco.`;
            }

            appendBubble(reply, 'ai');
        }

        const t = chatInput.value.trim();
        if (!t) return;
        appendBubble(t, 'user');
        chatInput.value = '';

        // spinner mentre elabora
        const typing = showTyping();

        // 1️⃣ se è un comando locale
        if (t.startsWith('/')) {
            handle_command(t.slice(1).trim(), typing);
            return;
        }

        // 2️⃣ altrimenti: chiama l'agente remoto
        const LS_THREAD = 'thread_id';
        let thread_id = localStorage.getItem(LS_THREAD);
        fetch(Routes.Agent.THREAD(thread_id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: t })
        })
            .then(r => r.json())
            .then(data => {
                hideTyping(typing);
                data
                    .flat()
                    .filter(d => d.role != 'user')
                    .forEach(element => {
                        if (element.tool_calls && element.tool_calls.length > 0) {
                            element.tool_calls.forEach(call => appendToolCall(call));
                        } else if (element.role === 'tool') {
                            appendToolResponse(element);
                            dispatch('layer:reload-project-layers', {});
                        } else {
                            appendBubble(element.content || '(nessuna risposta)', element.role || 'ai');
                        }
                    });
            })
            .catch(err => {
                hideTyping(typing);
                appendBubble('Errore contattando l’agente 😢', 'ai');
                console.error(err);
            });
    }

    function appendToolCall(call) {
        if (!call) return;

        const bubble = document.createElement('div');
        bubble.className = 'bubble ai';

        const details = document.createElement('details');
        details.className = 'tool-item';

        const summary = document.createElement('summary');

        // head: "tool call: <code>name</code>"
        const head = document.createElement('div');
        head.className = 'tool-head';

        const label = document.createElement('span');
        label.textContent = 'tool call:';

        const codeEl = document.createElement('code');
        codeEl.textContent = call?.name || 'tool';

        head.appendChild(label);
        head.appendChild(codeEl);

        // id (piccolo, sotto al nome)
        const idLine = document.createElement('div');
        idLine.className = 'tool-id';
        idLine.textContent = `ID: ${String(call?.id || '—')}`;

        summary.appendChild(head);
        summary.appendChild(idLine);

        // args (json pretty)
        const pre = document.createElement('pre');
        pre.className = 'tool-args';
        pre.textContent = JSON.stringify(call?.args ?? {}, null, 2);

        details.appendChild(summary);
        details.appendChild(pre);
        bubble.appendChild(details);

        chatBody.appendChild(bubble);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    // Crea UNA bubble AI per una singola risposta di tipo "tool"
    function appendToolResponse(msg) {
        if (!msg) return;

        const bubble = document.createElement('div');
        bubble.className = 'bubble ai';

        const details = document.createElement('details');
        details.className = 'tool-item';

        // header
        const summary = document.createElement('summary');

        const head = document.createElement('div');
        head.className = 'tool-head';

        const label = document.createElement('span');
        label.textContent = 'tool response:';

        const codeEl = document.createElement('code');
        codeEl.textContent = msg?.name || 'tool';

        head.appendChild(label);
        head.appendChild(codeEl);

        const idLine = document.createElement('div');
        idLine.className = 'tool-id';
        idLine.textContent = `Call ID: ${String(msg?.tool_call_id || '—')}`;

        summary.appendChild(head);
        summary.appendChild(idLine);

        // corpo (raw, non parsare!)
        const pre = document.createElement('pre');
        pre.className = 'tool-args';
        pre.textContent = String(msg?.content ?? ''); // XSS-safe: textContent

        details.appendChild(summary);
        details.appendChild(pre);
        bubble.appendChild(details);

        chatBody.appendChild(bubble);
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function appendBubble(text, who = 'user') {
        const div = document.createElement('div');
        div.className = 'bubble ' + (who === 'user' ? 'user' : 'ai');


        if (who === 'ai' || who === 'interrupt') {
            const html = marked.parse(text);
            div.innerHTML = html;
        } else {
            div.textContent = text;
        }

        chatBody.appendChild(div);
        chatBody.scrollTop = chatBody.scrollHeight;
        return div;
    }


    function showTyping(label = 'in calcolo…') {
        const wrap = document.createElement('div');
        wrap.className = 'bubble typing';
        wrap.innerHTML = `
      <div class="spinner-border spinner-border-sm text-light" role="status" aria-hidden="true"></div>
      <span class="small text-secondary">${label}</span>`;
        chatBody.appendChild(wrap);
        chatBody.scrollTop = chatBody.scrollHeight;
        return wrap;
    }
    function hideTyping(node) { if (node && node.parentNode) node.parentNode.removeChild(node); }

    function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }

    // API opzionale
    return { init, appendBubble, showTyping, hideTyping };
})();
