(() => {
    const TOKEN_KEY = 'vitalismen_admin_token';
    let lastToken = '';

    const validToken = (value) => {
        const token = String(value || '').trim();
        return token.length >= 40
            && token.length <= 4096
            && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
            ? token
            : '';
    };

    const publishPanelSession = () => {
        const token = validToken(window.localStorage.getItem(TOKEN_KEY));
        if (!token || token === lastToken) return;
        lastToken = token;
        chrome.runtime.sendMessage({
            action: 'panelAuthCandidate',
            token
        }).catch(() => {});
    };

    window.addEventListener('storage', (event) => {
        if (event.key === TOKEN_KEY) publishPanelSession();
    });
    window.addEventListener('focus', publishPanelSession);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) publishPanelSession();
    });
    publishPanelSession();
    setInterval(publishPanelSession, 5000);
})();
