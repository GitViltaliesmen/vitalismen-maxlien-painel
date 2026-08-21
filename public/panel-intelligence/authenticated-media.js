(function attachVitalismenAuthenticatedMedia(root) {
    const protectedPrefixes = [
        '/api/whatsapp/media/',
        '/api/whatsapp/media-proxy'
    ];

    const mediaKindLabel = (kind = '') => {
        const value = String(kind || '').toLowerCase();
        if (value === 'audio' || value === 'ptt') return 'Áudio';
        if (value === 'image') return 'Imagem';
        if (value === 'video') return 'Vídeo';
        return 'Mídia';
    };

    const reasonLabels = Object.freeze({
        missing_provider_media_url: 'o provedor não informou o arquivo',
        provider_url_not_allowed: 'a URL do provedor não é autorizada',
        provider_redirect_not_allowed: 'o provedor redirecionou para um endereço não autorizado',
        provider_redirect_without_location: 'o redirecionamento do provedor veio incompleto',
        provider_redirect_limit: 'o provedor excedeu o limite de redirecionamentos',
        provider_download_timeout: 'o provedor demorou demais para entregar o arquivo',
        provider_download_failed: 'não foi possível baixar o arquivo do provedor',
        provider_http_401: 'o provedor recusou a autenticação antes do download',
        provider_http_403: 'o provedor recusou o acesso antes do download',
        provider_http_404: 'a URL temporária do provedor expirou antes do download',
        media_too_large: 'o arquivo ultrapassa o limite operacional',
        empty_media: 'o provedor entregou um arquivo vazio',
        invalid_media_signature: 'o conteúdo recebido não é uma mídia válida',
        media_type_mismatch: 'o tipo real do arquivo diverge da mensagem',
        mime_mismatch: 'o MIME real diverge do MIME informado',
        response_mime_mismatch: 'o MIME da resposta diverge do conteúdo',
        unsupported_audio_codec: 'o codec do áudio não é reproduzível no painel',
        stored_file_missing: 'o arquivo persistido não foi encontrado',
        stored_file_verification_failed: 'o arquivo não passou na verificação de persistência',
        media_not_ready: 'o arquivo ainda não está pronto'
    });

    const pathFromUrl = (value = '', origin = root.location?.origin || 'https://ec.maxlien.shop') => {
        try {
            return new URL(String(value || ''), origin).pathname;
        } catch {
            return '';
        }
    };

    const isProtectedMediaUrl = (value = '', origin) => {
        const pathname = pathFromUrl(value, origin);
        return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
    };

    const failureText = ({ kind = 'media', reason = '', status = '' } = {}) => {
        const label = mediaKindLabel(kind);
        const normalizedStatus = String(status || '').toUpperCase();
        if (normalizedStatus && normalizedStatus !== 'FAILED') {
            const progress = {
                RECEIVED: 'recebida, aguardando captura segura',
                FETCHING: 'sendo baixada do provedor',
                STORED: 'armazenada, concluindo verificação'
            }[normalizedStatus];
            if (progress) return `${label} ${progress}`;
        }
        const detail = reasonLabels[String(reason || '')] || 'o arquivo não pôde ser carregado';
        return `${label} indisponível · ${detail}`;
    };

    const responseReason = async (response) => {
        const payload = await response.clone().json().catch(() => ({}));
        if (payload.reason) return String(payload.reason);
        if (response.status === 401) return 'panel_http_401';
        if (response.status === 403) return 'panel_http_403';
        if (response.status === 404) return 'provider_http_404';
        if (response.status === 409) return 'media_not_ready';
        return `panel_http_${response.status || 'error'}`;
    };

    const fetchObjectUrl = async (value, {
        token = '',
        fetchImpl = root.fetch?.bind(root),
        createObjectURL = root.URL?.createObjectURL?.bind(root.URL)
    } = {}) => {
        if (typeof fetchImpl !== 'function' || typeof createObjectURL !== 'function') {
            const error = new Error('panel_media_fetch_unavailable');
            error.reason = 'panel_media_fetch_unavailable';
            throw error;
        }
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetchImpl(value, {
            method: 'GET',
            cache: 'force-cache',
            credentials: 'same-origin',
            headers
        });
        if (!response.ok) {
            const reason = await responseReason(response);
            const error = new Error(reason);
            error.reason = reason;
            error.status = response.status;
            throw error;
        }
        const blob = await response.blob();
        if (!blob.size) {
            const error = new Error('empty_media');
            error.reason = 'empty_media';
            throw error;
        }
        return {
            objectUrl: createObjectURL(blob),
            contentType: blob.type || response.headers.get('content-type') || '',
            size: blob.size
        };
    };

    root.VitalismenAuthenticatedMedia = Object.freeze({
        failureText,
        fetchObjectUrl,
        isProtectedMediaUrl,
        mediaKindLabel,
        reasonLabels
    });
}(window));
