const Toasts = (() => {
    const stack = () => document.getElementById('toastStack');

    function show(message = 'Operazione in corso…') {
        const el = document.createElement('div');
        el.className = 'toast-item';
        el.innerHTML = `
      <div class="toast-icon">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span class="ok material-symbols-outlined">check_circle</span>
      </div>
      <div class="toast-msg">${message}</div>
    `;
        stack().appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        return el; // handle
    }

    function ok(handle, finalMessage = 'Fatto', holdMs = 2000) {
        if (!handle) return;
        handle.classList.add('ok');
        handle.querySelector('.toast-msg').innerHTML = finalMessage;
        setTimeout(() => close(handle), holdMs);
    }

    function error(handle, finalMessage = 'Errore') {
        if (!handle) return;
        // se vuoi, icona rossa: puoi cambiare classe/emoji qui
        handle.querySelector('.toast-msg').innerHTML = finalMessage;
        close(handle, 600);
    }

    function close(handle, afterMs = 0) {
        if (!handle) return;
        setTimeout(() => {
            handle.classList.add('hide');
            handle.addEventListener('transitionend', () => handle.remove(), { once: true });
        }, afterMs);
    }

    // XSS-safe
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

    return { show, ok, error, close };
})();
