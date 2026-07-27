(() => {
    'use strict';

    const INSTALL_VERSION = '0.11.5';
    if (window.__vitalismenFunnelLauncherInstalled === INSTALL_VERSION) return;
    window.__vitalismenFunnelLauncherInstalled = INSTALL_VERSION;

    const LAUNCHER_HOST_ID = 'vitalismen-funnel-launcher-host';
    const OVERLAY_HOST_ID = 'vitalismen-funnel-overlay-host';
    const LAYOUT_KEY = 'vitalismenFunnelOverlayLayoutV080';
    const MIN_WIDTH = 440;
    const MIN_HEIGHT = 540;
    const HEADER_HEIGHT = 48;
    const DEFAULT_WIDTH = 540;
    const DEFAULT_HEIGHT = 820;
    let overlay = null;
    let launcherButton = null;
    let minimized = false;
    let lastExpandedHeight = 620;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const saveLayout = () => {
        if (!overlay) return;
        chrome.storage.local.set({
            [LAYOUT_KEY]: {
                left: overlay.offsetLeft,
                top: overlay.offsetTop,
                width: overlay.offsetWidth,
                height: minimized ? lastExpandedHeight : overlay.offsetHeight
            }
        });
    };

    const constrainOverlay = () => {
        if (!overlay || overlay.hidden) return;
        const availableWidth = Math.max(240, window.innerWidth - 16);
        const availableHeight = Math.max(HEADER_HEIGHT, window.innerHeight - 16);
        const measuredWidth = overlay.offsetWidth || DEFAULT_WIDTH;
        const measuredHeight = overlay.offsetHeight || lastExpandedHeight || DEFAULT_HEIGHT;
        const width = Math.min(Math.max(MIN_WIDTH, measuredWidth), availableWidth);
        const height = minimized
            ? HEADER_HEIGHT
            : Math.min(Math.max(MIN_HEIGHT, measuredHeight), availableHeight);
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlay.style.left = `${clamp(overlay.offsetLeft, 8, Math.max(8, window.innerWidth - overlay.offsetWidth - 8))}px`;
        overlay.style.top = `${clamp(overlay.offsetTop, 8, Math.max(8, window.innerHeight - overlay.offsetHeight - 8))}px`;
    };

    const setMinimized = (next) => {
        if (!overlay) return;
        minimized = Boolean(next);
        if (minimized) {
            lastExpandedHeight = Math.max(MIN_HEIGHT, overlay.offsetHeight);
            overlay.style.height = `${HEADER_HEIGHT}px`;
        } else {
            overlay.style.height = `${Math.min(lastExpandedHeight, window.innerHeight - 16)}px`;
        }
        overlay.classList.toggle('is-minimized', minimized);
        const button = overlay.querySelector('[data-action="minimize"]');
        if (button) {
            button.textContent = minimized ? '□' : '—';
            button.title = minimized ? 'Restaurar funil' : 'Minimizar funil';
        }
        constrainOverlay();
        saveLayout();
    };

    const hideOverlay = () => {
        if (!overlay) return;
        overlay.hidden = true;
        launcherButton?.classList.remove('is-active');
        saveLayout();
    };

    const showOverlay = () => {
        ensureOverlay().then(() => {
            overlay.hidden = false;
            if (minimized) setMinimized(false);
            if (overlay.offsetHeight < MIN_HEIGHT) {
                overlay.style.height = `${Math.min(lastExpandedHeight || DEFAULT_HEIGHT, window.innerHeight - 16)}px`;
            }
            constrainOverlay();
            launcherButton?.classList.add('is-active');
            overlay.querySelector('iframe')?.contentWindow?.postMessage(
                { source: 'vitalismen-funnel-shell', action: 'refresh' },
                '*'
            );
        });
    };

    const toggleOverlay = () => {
        if (overlay && !overlay.hidden) hideOverlay();
        else showOverlay();
    };

    const startDrag = (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        if (minimized) setMinimized(false);
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = overlay.offsetLeft;
        const startTop = overlay.offsetTop;
        overlay.setPointerCapture?.(event.pointerId);

        const move = (moveEvent) => {
            overlay.style.left = `${clamp(
                startLeft + moveEvent.clientX - startX,
                8,
                Math.max(8, window.innerWidth - overlay.offsetWidth - 8)
            )}px`;
            overlay.style.top = `${clamp(
                startTop + moveEvent.clientY - startY,
                8,
                Math.max(8, window.innerHeight - overlay.offsetHeight - 8)
            )}px`;
        };
        const end = () => {
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', end, true);
            saveLayout();
        };
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', end, true);
        event.preventDefault();
    };

    const startResize = (event) => {
        if (event.button !== 0 || minimized) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = overlay.offsetWidth;
        const startHeight = overlay.offsetHeight;

        const move = (moveEvent) => {
            overlay.style.width = `${clamp(
                startWidth + moveEvent.clientX - startX,
                MIN_WIDTH,
                window.innerWidth - overlay.offsetLeft - 8
            )}px`;
            overlay.style.height = `${clamp(
                startHeight + moveEvent.clientY - startY,
                MIN_HEIGHT,
                window.innerHeight - overlay.offsetTop - 8
            )}px`;
        };
        const end = () => {
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', end, true);
            lastExpandedHeight = overlay.offsetHeight;
            saveLayout();
        };
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', end, true);
        event.preventDefault();
    };

    const ensureOverlay = async () => {
        if (overlay?.isConnected) return;
        let host = document.getElementById(OVERLAY_HOST_ID);
        if (!host) {
            host = document.createElement('div');
            host.id = OVERLAY_HOST_ID;
            document.body.append(host);
        }
        const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
        root.innerHTML = `
            <style>
                :host { all: initial; }
                .panel {
                    position: fixed;
                    z-index: 2147483646;
                    width: ${DEFAULT_WIDTH}px;
                    height: ${DEFAULT_HEIGHT}px;
                    left: calc(100vw - 950px);
                    top: 70px;
                    display: grid;
                    grid-template-rows: ${HEADER_HEIGHT}px minmax(0, 1fr);
                    overflow: hidden;
                    border: 1px solid #087f70;
                    border-radius: 16px;
                    background: #f7fbf9;
                    box-shadow: 0 18px 52px rgba(0, 0, 0, .32);
                    font: 13px/1.35 Arial, sans-serif;
                    color: #102c27;
                }
                .panel[hidden] { display: none; }
                .panel.is-minimized { grid-template-rows: ${HEADER_HEIGHT}px 0; }
                .bar {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 0 8px 0 14px;
                    color: #fff;
                    background: linear-gradient(135deg, #087f70, #0b9b7e);
                    cursor: move;
                    user-select: none;
                }
                .brand { flex: 1; min-width: 0; }
                .brand strong, .brand span { display: block; }
                .brand strong { font-size: 13px; }
                .brand span { font-size: 10px; opacity: .85; }
                .control {
                    width: 30px;
                    height: 30px;
                    padding: 0;
                    border: 1px solid rgba(255,255,255,.55);
                    border-radius: 50%;
                    color: #fff;
                    background: transparent;
                    cursor: pointer;
                    font: 700 15px Arial, sans-serif;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: 0;
                    background: #f7fbf9;
                }
                .resize {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 22px;
                    height: 22px;
                    cursor: nwse-resize;
                    background: linear-gradient(135deg, transparent 48%, #087f70 49%, #087f70 57%, transparent 58%);
                }
                .is-minimized .resize { display: none; }
            </style>
            <section class="panel" hidden>
                <header class="bar">
                    <div class="brand">
                        <strong>Funil Vitalismen · v${INSTALL_VERSION}</strong>
                        <span>Arraste para qualquer lugar · uso humano</span>
                    </div>
                    <button class="control" type="button" data-action="minimize" title="Minimizar funil">—</button>
                    <button class="control" type="button" data-action="close" title="Fechar funil">×</button>
                </header>
                <iframe title="Respostas do funil Vitalismen" src="${chrome.runtime.getURL('funnel-overlay.html')}"></iframe>
                <span class="resize" title="Redimensionar"></span>
            </section>
        `;
        overlay = root.querySelector('.panel');
        const saved = await chrome.storage.local.get(LAYOUT_KEY).catch(() => ({}));
        const layout = saved?.[LAYOUT_KEY];
        if (layout) {
            const savedWidth = Number(layout.width);
            const savedHeight = Number(layout.height);
            overlay.style.left = `${Number(layout.left) || 8}px`;
            overlay.style.top = `${Number(layout.top) || 90}px`;
            overlay.style.width = `${savedWidth >= MIN_WIDTH ? savedWidth : DEFAULT_WIDTH}px`;
            overlay.style.height = `${savedHeight >= MIN_HEIGHT ? savedHeight : DEFAULT_HEIGHT}px`;
            lastExpandedHeight = savedHeight >= MIN_HEIGHT ? savedHeight : DEFAULT_HEIGHT;
        }
        root.querySelector('.bar').addEventListener('pointerdown', startDrag);
        root.querySelector('[data-action="minimize"]').addEventListener('click', () => setMinimized(!minimized));
        root.querySelector('[data-action="close"]').addEventListener('click', hideOverlay);
        root.querySelector('.resize').addEventListener('pointerdown', startResize);
    };

    const makeLauncher = () => {
        let host = document.getElementById(LAUNCHER_HOST_ID);
        if (!host) {
            host = document.createElement('span');
            host.id = LAUNCHER_HOST_ID;
        }
        if (!host.shadowRoot) {
            const root = host.attachShadow({ mode: 'open' });
            root.innerHTML = `
                <style>
                    :host { display: inline-flex; flex: 0 0 auto; align-items: center; margin: 0 5px; }
                    button {
                        height: 38px;
                        padding: 0 16px;
                        border: 1px solid #087f70;
                        border-radius: 19px;
                        color: #075e54;
                        background: #fff;
                        cursor: pointer;
                        font: 700 13px Arial, sans-serif;
                        box-shadow: 0 1px 2px rgba(0,0,0,.08);
                    }
                    button:hover, button.is-active { color: #fff; background: #0b9b7e; }
                </style>
                <button type="button" title="Abrir funil móvel Vitalismen">Funil</button>
            `;
            launcherButton = root.querySelector('button');
            launcherButton.addEventListener('click', toggleOverlay);
        } else {
            const previousButton = host.shadowRoot.querySelector('button');
            launcherButton = previousButton.cloneNode(true);
            previousButton.replaceWith(launcherButton);
            launcherButton.addEventListener('click', toggleOverlay);
        }
        return host;
    };

    const findComposer = () => (
        document.querySelector('#main footer')
        || document.querySelector('#main [contenteditable="true"]')?.closest('footer')
        || document.querySelector('[data-testid="conversation-compose-box-input"]')?.closest('footer')
    );

    const ensureLauncher = () => {
        const composer = findComposer();
        if (!composer) return;
        const host = makeLauncher();
        if (host.parentElement !== composer) composer.append(host);
    };

    const observer = new MutationObserver(ensureLauncher);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ensureLauncher();
    ensureOverlay();
    window.addEventListener('resize', constrainOverlay);
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.action !== 'activeWhatsAppChat' && message?.action !== 'whatsAppChatSwitchStarted') return;
        overlay?.querySelector('iframe')?.contentWindow?.postMessage(
            { source: 'vitalismen-funnel-shell', action: 'refresh' },
            '*'
        );
    });
})();
