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
export default router;
