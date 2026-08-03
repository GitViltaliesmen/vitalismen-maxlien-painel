(() => {
    if (window.__vitalismenContactSyncInstalled) return;
    window.__vitalismenContactSyncInstalled = true;

    const MAX_NAME_LENGTH = 90;
    let lastSignature = '';
    let debounceTimer = null;
    let retryTimers = [];
    let pendingHint = null;
    let pendingUntil = 0;
    let lastActivationSignature = '';
    let lastActivationAt = 0;
    const LABELS_KEY = 'vitalismenWhatsAppLabelsV1';
    const LABELS_META_KEY = 'vitalismenWhatsAppLabelsMetaV2';
    let contactLabels = {};
    let labelsMeta = {};
    let paintTimer = null;

    const digits = (value) => String(value || '').replace(/\D/g, '');
    const validPhone = (value) => {
        const normalized = digits(value);
        return normalized.length >= 9 && normalized.length <= 15 ? normalized : '';
    };
    const phoneFromText = (value) => {
        const candidates = String(value || '').match(/\+?\d[\d\s().-]{7,22}\d/g) || [];
        return candidates.map(validPhone).find(Boolean) || '';
    };
    const ensureLabelStyles = () => {
        if (typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') {
            return false;
        }
        if (document.getElementById('vitalismen-chat-label-styles')) return true;
        const style = document.createElement('style');
        style.id = 'vitalismen-chat-label-styles';
        style.textContent = `
            .vitalismen-chat-label {
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                min-height: 17px;
                margin-inline-start: 6px;
                padding: 1px 6px;
                border-radius: 999px;
                color: #fff !important;
                font: 700 9px/1.2 Arial, sans-serif !important;
                letter-spacing: .01em;
                white-space: nowrap;
            }
            .vitalismen-chat-label[data-stale="true"] {
                opacity: .68;
                outline: 1px dashed rgba(255,255,255,.85);
            }
        `;
        (document.head || document.documentElement).appendChild(style);
        return true;
    };
    const labelForTitle = (titleFrame) => {
        const titleNodes = Array.from(titleFrame.querySelectorAll('[title]'));
        const phone = titleNodes
            .map((node) => phoneFromText(node.getAttribute('title')))
            .find(Boolean)
            || phoneFromElementAttributes(titleFrame);
        if (phone && contactLabels[phone]) return contactLabels[phone];
        const names = titleNodes
            .map((node) => cleanName(node.getAttribute('title')))
            .filter((value) => value && !phoneFromText(value));
        if (!names.length) return null;
        const normalizedNames = new Set(names.map((name) => name.toLocaleLowerCase('pt-BR')));
        const matches = Object.values(contactLabels).filter((entry) => (
            entry?.name && normalizedNames.has(cleanName(entry.name).toLocaleLowerCase('pt-BR'))
        ));
        return matches.length === 1 ? matches[0] : null;
    };
    const paintChatLabels = () => {
        paintTimer = null;
        if (!ensureLabelStyles()) return;
        document.querySelectorAll('[data-testid="cell-frame-title"]').forEach((titleFrame) => {
            const label = labelForTitle(titleFrame);
            let chip = titleFrame.querySelector(':scope > .vitalismen-chat-label');
            if (!label) {
                chip?.remove();
                return;
            }
            if (!chip) {
                chip = document.createElement('span');
                chip.className = 'vitalismen-chat-label';
                chip.setAttribute('aria-label', `Etiqueta ${label.label}`);
                titleFrame.appendChild(chip);
            }
            if (chip.textContent !== label.label) chip.textContent = label.label;
            const color = label.color || '#0b9b7e';
            if (chip.style.backgroundColor !== color) chip.style.backgroundColor = color;
            const stale = labelsMeta?.stale === true;
            chip.dataset.stale = stale ? 'true' : 'false';
            chip.title = stale
                ? `${label.label} · aguardando sincronização com o painel`
                : `${label.label} · ${label.manual ? 'ajuste manual' : 'automático'}`;
        });
    };
    const scheduleLabelPaint = (delay = 80) => {
        clearTimeout(paintTimer);
        paintTimer = setTimeout(paintChatLabels, delay);
    };
    const cleanName = (value) => String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NAME_LENGTH);
    const ignoredTitle = (value) => /^(pesquisar|buscar|menu|mais opções|dados do contato|perfil|videochamada|ligação|comunidade)$/i.test(
        cleanName(value)
    );

    const phoneFromElementAttributes = (element) => {
        if (!element) return '';
        const nodes = [element, ...Array.from(element.querySelectorAll('*')).slice(0, 160)];
        for (const node of nodes) {
            for (const attribute of Array.from(node.attributes || [])) {
                const value = String(attribute.value || '');
                const usefulAttribute = /^(data-id|data-phone|data-contact-id|href|aria-label|title)$/i.test(attribute.name);
                const jidLike = /@(?:c\.us|s\.whatsapp\.net)|[?&]phone=/i.test(value);
                if (!usefulAttribute && !jidLike) continue;
                const phone = phoneFromText(value);
                if (phone) return phone;
            }
        }
        return '';
    };

    const selectionFromElement = (element, source) => {
        if (!element) return null;
        const titleValues = Array.from(element.querySelectorAll('[title]'))
            .map((node) => cleanName(node.getAttribute('title')))
            .filter((value) => value && !ignoredTitle(value))
            .slice(0, 20);
        const visibleText = cleanName(element.innerText || '');
        const firstLine = cleanName(String(element.innerText || '').split('\n')[0]);
        const phone = phoneFromText(firstLine)
            || phoneFromElementAttributes(element)
            || titleValues.map(phoneFromText).find(Boolean)
            || (source === 'visible_header' ? phoneFromText(visibleText) : '');
        const name = titleValues.find((value) => !phoneFromText(value))
            || (!phoneFromText(firstLine) ? firstLine : '')
            || '';

        if (!phone && !name) return null;
        return {
            phone,
            name: cleanName(name),
            source,
            observedAt: new Date().toISOString()
        };
    };

    const readConversationHeader = () => {
        const preferred = [
            document.querySelector('[data-testid="conversation-header"]'),
            document.querySelector('#main header')
        ].filter(Boolean);
        const allHeaders = Array.from(document.querySelectorAll('header'));
        const candidates = [...new Set([...preferred, ...allHeaders])]
            .map((header) => selectionFromElement(header, 'visible_header'))
            .filter(Boolean);
        return candidates.find((selection) => selection.phone)
            || candidates.find((selection) => (
                selection.name && !/^(whatsapp|conversas|comunidades)$/i.test(selection.name)
            ))
            || null;
    };

    const readSelectedChat = () => {
        const url = new URL(window.location.href);
        const queryPhone = validPhone(url.searchParams.get('phone'));
        const headerSelection = readConversationHeader() || {};
        const phone = queryPhone || headerSelection.phone || '';
        const name = headerSelection.name || '';
        if (!phone && !name) return null;
        return {
            phone,
            name: cleanName(name),
            source: queryPhone ? 'url' : 'visible_header',
            observedAt: new Date().toISOString()
        };
    };

    const sendSelection = (selected, { force = false } = {}) => {
        if (!selected) return;
        if (pendingHint && Date.now() < pendingUntil && selected.source !== 'list_click') {
            const phoneMatches = pendingHint.phone && selected.phone === pendingHint.phone;
            const nameMatches = !pendingHint.phone
                && pendingHint.name
                && cleanName(selected.name).toLowerCase() === cleanName(pendingHint.name).toLowerCase();
            if (!phoneMatches && !nameMatches) return;
            pendingHint = null;
            pendingUntil = 0;
        }
        const signature = `${selected.phone}|${selected.name}`;
        if (!force && signature === lastSignature) return;
        lastSignature = signature;
        chrome.runtime.sendMessage({
            action: 'activeWhatsAppChat',
            selection: selected
        }).catch(() => {});
    };

    const publishSelection = () => {
        debounceTimer = null;
        sendSelection(readSelectedChat());
    };

    const scheduleRead = (delay = 120) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(publishSelection, delay);
    };

    const scheduleConfirmationReads = () => {
        retryTimers.forEach(clearTimeout);
        retryTimers = [80, 220, 500, 1000, 1800].map((delay) => (
            setTimeout(() => sendSelection(readSelectedChat()), delay)
        ));
    };

    const readClickHint = (target, pane) => {
        let node = target?.nodeType === 1 ? target : target?.parentElement;
        let nameOnly = null;
        while (node && node !== pane) {
            const text = String(node.innerText || '').trim();
            if (text && text.length <= 800) {
                const candidate = selectionFromElement(node, 'list_click');
                if (candidate?.phone) return candidate;
                if (!nameOnly && candidate?.name) nameOnly = candidate;
            }
            node = node.parentElement;
        }
        return nameOnly;
    };

    const observer = new MutationObserver(() => {
        scheduleRead();
        scheduleLabelPaint();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: ['title', 'aria-selected', 'data-id', 'data-phone', 'href']
    });

    const handlePaneActivation = (event) => {
        const pane = event.target.closest?.('#pane-side');
        if (!pane) return;

        const hint = readClickHint(event.target, pane);
        const signature = `${hint?.phone || ''}|${cleanName(hint?.name).toLowerCase()}`;
        const duplicate = signature
            && signature === lastActivationSignature
            && Date.now() - lastActivationAt < 900;
        lastActivationSignature = signature;
        lastActivationAt = Date.now();
        pendingHint = hint;
        pendingUntil = Date.now() + 2500;
        if (!duplicate) {
            chrome.runtime.sendMessage({
                action: 'whatsAppChatSwitchStarted',
                selection: hint
            }).catch(() => {});
        }

        if (hint?.phone) sendSelection(hint, { force: true });
        scheduleConfirmationReads();
    };

    document.addEventListener('pointerdown', handlePaneActivation, true);
    document.addEventListener('click', handlePaneActivation, true);

    window.addEventListener('popstate', scheduleRead);
    window.addEventListener('hashchange', scheduleRead);
    chrome.storage?.local?.get?.([LABELS_KEY, LABELS_META_KEY], (stored) => {
        contactLabels = stored?.[LABELS_KEY] || {};
        labelsMeta = stored?.[LABELS_META_KEY] || {};
        scheduleLabelPaint(0);
    });
    chrome.storage?.onChanged?.addListener?.((changes, area) => {
        if (area !== 'local' || (!changes[LABELS_KEY] && !changes[LABELS_META_KEY])) return;
        if (changes[LABELS_KEY]) contactLabels = changes[LABELS_KEY].newValue || {};
        if (changes[LABELS_META_KEY]) labelsMeta = changes[LABELS_META_KEY].newValue || {};
        scheduleLabelPaint(0);
    });
    scheduleRead(50);
    scheduleLabelPaint(50);
    chrome.runtime.sendMessage({ action: 'ensureWhatsAppIntegration' }).catch(() => {});
})();
