import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { productionWebOrderAccessV231 } from '../services/vitPowerWebVoiceStatusV231Service.js';
import express from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { hasExplicitWebDashboardBearerV222, productionWebDashboardReaderV222 } from '../services/vitPowerWebDashboardV222Service.js';

const router = express.Router();
router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' });
    // Do not inherit the legacy loopback/no-password authentication fallback.
    if (!hasExplicitWebDashboardBearerV222(req)) return res.status(401).json({ error: 'Autenticação de administrador necessária.' });
    return next();
}, authMiddleware, adminOnly);
router.get('/', async (req, res) => {
    try { return res.json({ version: 222, readOnly: true, conversations: await productionWebDashboardReaderV222().list() }); }
    catch { return res.status(503).json({ error: 'Conversas do site indisponíveis. Tente novamente.' }); }
});
router.get('/:id', async (req, res) => {
    try {
        const conversation = await productionWebDashboardReaderV222().read(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada ou expirada.' });
        return res.json({ version: 222, readOnly: true, conversation });
    } catch { return res.status(503).json({ error: 'Conversa indisponível. Tente novamente.' }); }
});
// Explicit admin authentication above also protects this credential issuance.
router.post('/:id/order-access', async (req, res) => {
    if (!req.is('application/json') || Number(req.headers['content-length'] || 0) > 1024 || !req.body || Object.keys(req.body).some(k => !['orderId', 'phone', 'identityVerified'].includes(k)) || req.body.identityVerified !== true)
        return res.status(400).json({ error: 'Confirme a identidade do destinatário antes de emitir o código.' });
    try {
        let administrator;
        try { const decoded = jwt.verify(req.headers.authorization.slice(7), process.env.JWT_SECRET); administrator = await User.findById(decoded.id).select('_id role isActive').lean(); }
        catch { return res.status(401).json({ error: 'Autenticação válida de administrador necessária.' }); }
        if (!administrator?.isActive || administrator.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
        const conversation = await productionWebDashboardReaderV222().read(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada ou expirada.' });
        const grant = await productionWebOrderAccessV231().issue({ orderId: req.body.orderId, phone: req.body.phone, administrator: administrator._id });
        return res.json({ ok: true, ...grant });
    } catch { return res.status(403).json({ error: 'Não foi possível autorizar esse pedido. Confira o pedido EC Vit Power e o telefone completo do titular.' }); }
});
export default router;
