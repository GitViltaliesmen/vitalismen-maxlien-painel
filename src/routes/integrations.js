import express from 'express';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import {
    completeGoogleContactsAuthorization,
    authorizeGoogleContactNameUpdate,
    createGoogleContactsAuthorization,
    disconnectGoogleContacts,
    googleContactsStatus,
    retryGoogleContactSync
} from '../services/googleContactsService.js';

const router = express.Router();

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const oauthResultPage = ({ ok, title, detail }) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>body{font:16px Arial,sans-serif;background:#f3faf7;color:#153b32;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:560px;background:#fff;border:1px solid #b9ddd3;border-radius:18px;padding:28px;box-shadow:0 12px 36px #073b2e1a}h1{font-size:23px;margin:0 0 12px}.ok{color:#087f70}.error{color:#b3261e}p{line-height:1.5}</style></head>
<body><main class="card"><h1 class="${ok ? 'ok' : 'error'}">${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p><p>Esta janela pode ser fechada. Volte para a extensão Vitalismen.</p></main></body></html>`;

router.get('/google-contacts/callback', async (req, res) => {
    try {
        const result = await completeGoogleContactsAuthorization({
            code: String(req.query.code || ''),
            state: String(req.query.state || '')
        });
        res.status(200).type('html').send(oauthResultPage({
            ok: true,
            title: 'Google Contatos conectado',
            detail: `Conta autorizada: ${result.accountEmail}. Somente pedidos confirmados a partir de agora entrarão na fila.`
        }));
    } catch (error) {
        res.status(400).type('html').send(oauthResultPage({
            ok: false,
            title: 'Não foi possível conectar',
            detail: String(error?.message || 'Falha de autorização.').replace(/[<>]/g, '')
        }));
    }
});

router.use(authMiddleware);

router.get('/google-contacts/status', async (_req, res) => {
    try {
        res.json(await googleContactsStatus());
    } catch (error) {
        res.status(500).json({ error: error?.message || 'Falha ao consultar Google Contatos.' });
    }
});

router.post('/google-contacts/connect', adminOnly, async (req, res) => {
    try {
        const result = await createGoogleContactsAuthorization({
            requestedBy: req.user?.email || req.user?.name || 'admin'
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error?.message || 'Falha ao iniciar autorização Google.' });
    }
});

router.post('/google-contacts/disconnect', adminOnly, async (req, res) => {
    try {
        await disconnectGoogleContacts({ requestedBy: req.user?.email || req.user?.name || 'admin' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error?.message || 'Falha ao desconectar Google Contatos.' });
    }
});

router.post('/google-contacts/sync/:phone/retry', async (req, res) => {
    try {
        const sync = await retryGoogleContactSync(req.params.phone);
        res.json({ success: true, status: sync.status, phoneDigits: sync.phoneDigits });
    } catch (error) {
        res.status(400).json({ error: error?.message || 'Falha ao reenfileirar contato.' });
    }
});

router.post('/google-contacts/sync/:phone/resolve-name', adminOnly, async (req, res) => {
    try {
        const sync = await authorizeGoogleContactNameUpdate(req.params.phone);
        res.json({ success: true, status: sync.status, phoneDigits: sync.phoneDigits });
    } catch (error) {
        res.status(400).json({ error: error?.message || 'Falha ao autorizar atualizacao do nome.' });
    }
});

export default router;
