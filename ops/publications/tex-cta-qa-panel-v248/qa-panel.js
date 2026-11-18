function createQaPanelUiV248({ api, getChat, getScope, refresh, now = () => Date.now() }) {
    const phone = '5515998038637';
    let cache = null, pending = null, requestedAt = 0;
    const exact = chat => {
        const raw = String(chat?.phone || chat?.id || '').split('@')[0];
        return raw.replace(/\D/g, '') === phone;
    };
    function status(chat) {
        if (!exact(chat)) return null;
        if (!cache) return { badge: 'TESTE: CONSULTANDO JANELA', kind: 'loading' };
        if (cache.error) return { badge: 'TESTE: CONSULTA INDISPONÍVEL', kind: 'error' };
        const permit = cache.metadata?.qaTestContextV78;
        const until = Date.parse(permit?.expiresAt || '');
        if (permit?.version === 78 && permit.phone === phone && permit.status === 'armed' && until > now()) {
            return { badge: 'TESTE: JANELA ATIVA', kind: 'active' };
        }
        return { badge: 'TESTE: JANELA ENCERRADA', kind: 'closed' };
    }
    function emptyHtml(chat) {
        const value = status(chat);
        if (!value) return '<div class="empty">Sem mensagens salvas para este cliente.</div>';
        const explanation = value.kind === 'active'
            ? 'Janela de teste ativa. Aguardando uma nova mensagem enviada pelo WhatsApp 8637.'
            : value.kind === 'loading' ? 'Consultando a janela autorizada do teste 8637.'
            : value.kind === 'error' ? 'Não foi possível consultar a janela de teste. Atualize a página para conferir o estado atual.'
            : 'A janela anterior terminou. Abra uma nova janela de teste no Controle do Bot antes de enviar uma nova mensagem.';
        return '<div class="empty" data-qa-empty-v248="true"><strong>Teste 8637: nenhuma mensagem nesta rodada.</strong><br>' + explanation + '</div>';
    }
    async function load() {
        if (!exact(getChat()) || pending || now() - requestedAt < 15000) return;
        const scope = getScope(); requestedAt = now();
        pending = (async () => {
            let record;
            try {
                record = await api('/api/whatsapp/contact-state/' + phone);
                if (record?.phoneDigits !== phone || record?.metadata?.testOnly !== true) throw Error('qa_identity_mismatch');
            } catch (_) { record = { error: true }; }
            if (getScope() !== scope || !exact(getChat())) return;
            cache = record; refresh();
        })();
        try { await pending; } finally { pending = null; }
    }
    return Object.freeze({ status, emptyHtml, load });
}
