(function () {
    const queue = [];
    let activeRequest = null;

    function getElements() {
        return {
            modal: document.getElementById('appMessageModal'),
            message: document.getElementById('appMessageText'),
            cancel: document.getElementById('appMessageCancel'),
            confirm: document.getElementById('appMessageConfirm')
        };
    }

    function showNext() {
        if (activeRequest || queue.length === 0) return;
        const elements = getElements();
        if (!elements.modal) return;

        activeRequest = queue.shift();
        elements.message.textContent = activeRequest.message;
        elements.cancel.style.display = activeRequest.type === 'confirm' ? 'inline-flex' : 'none';
        elements.modal.style.display = 'flex';
        requestAnimationFrame(() => elements.confirm.focus());
    }

    function request(type, message) {
        return new Promise(resolve => {
            queue.push({ type, message: String(message ?? ''), resolve });
            showNext();
        });
    }

    function respond(confirmed) {
        if (!activeRequest) return;
        const elements = getElements();
        const requestToResolve = activeRequest;
        activeRequest = null;
        elements.modal.style.display = 'none';
        requestToResolve.resolve(Boolean(confirmed));
        showNext();
    }

    window.showAppAlert = message => request('alert', message);
    window.showAppConfirm = message => request('confirm', message);
    window.alert = message => { window.showAppAlert(message); };

    let toastTimer = null;
    window.showAppToast = (message, duration = 1800) => {
        let toast = document.getElementById('appTopToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appTopToast';
            toast.className = 'app-top-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }
        if (toastTimer) clearTimeout(toastTimer);
        toast.textContent = String(message ?? '');
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            toastTimer = null;
        }, duration);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const elements = getElements();
        elements.confirm.addEventListener('click', () => respond(true));
        elements.cancel.addEventListener('click', () => respond(false));
        elements.modal.addEventListener('click', event => {
            if (event.target === elements.modal && activeRequest && activeRequest.type === 'confirm') respond(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && activeRequest) respond(false);
            if (event.key === 'Enter' && activeRequest) respond(true);
        });
        showNext();
    });
})();
