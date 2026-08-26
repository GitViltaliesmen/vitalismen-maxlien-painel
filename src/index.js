import 'dotenv/config';
import path from 'path';
import './services/ecEngagementFreezeRuntimeGuardV40.js';
import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';

// Routes
import authRoutes from './routes/auth.js';
import ordersRoutes from './routes/orders.js';
import productsRoutes from './routes/products.js';
import webhookRoutes from './routes/webhook.js';
import whatsappRoutes from './routes/whatsapp.js';
import aiRoutes from './routes/ai.js';
import shipmentRoutes from './routes/shipments.js';
import automationRoutes from './routes/automation.js';
import leadsRoutes from './routes/leads.js';
import { publicWhatsAppRedirect } from './routes/leads.js';
import metaEventsRoutes from './routes/metaEvents.js';
import zapiRoutes from './routes/zapi.js';
import observationRoutes from './routes/observation.js';
import integrationsRoutes from './routes/integrations.js';
import funnelMetricsRoutes from './routes/funnelMetrics.js';
import customerContextRoutes from './routes/customerContext.js';
import { startScheduler } from './services/schedulerService.js';
import healthRoutes from './routes/health.js';
import { startConfiguredWhatsAppSessions } from './whatsapp/connection.js';
import { pauseOrphanedTexUltraInitialFlowsOnStartup } from './services/texUltraInitialLayerService.js';
import OperationalSafetyState from './models/OperationalSafetyState.js';
import {
    POST_SALE_RUNTIME_VERSION,
    POST_SALE_SAFETY_STATE_ID,
    assertRuntimeSupportsPostSaleData,
    resolvePostSaleOperationalMutationGate
} from './services/postSaleSafetyV66Service.js';

const isProductionVpsPath = process.cwd().startsWith('/opt/vitalismen-automacao/');
const isRunningUnderPm2 = Boolean(process.env.pm_id || process.env.PM2_HOME);
const allowManualNode = String(process.env.VITALISMEN_ALLOW_MANUAL_NODE || '').toLowerCase() === 'true';

if (isProductionVpsPath && !isRunningUnderPm2 && !allowManualNode) {
    console.error('[ANTI-CONTAMINACAO] Vitalismen no VPS so pode iniciar pelo PM2.');
    console.error('[ANTI-CONTAMINACAO] Use: pm2 restart vitalismen-automation --update-env');
    console.error('[ANTI-CONTAMINACAO] Para manutencao emergencial: VITALISMEN_ALLOW_MANUAL_NODE=true node src/index.js');
    process.exit(78);
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.DASHBOARD_HOST || process.env.HOST || undefined;

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// So req.ip works behind proxies/load balancers (needed for CAPI)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// V66: o servidor e os endpoints de observabilidade podem subir sem automacao
// mutante. O scheduler so e avaliado depois da conexao e da leitura do contrato
// persistente de compatibilidade; ausencia/erro/versao futura falha fechado.
connectDB()
    .then(async () => {
        const compatibilityState = await OperationalSafetyState.findById(POST_SALE_SAFETY_STATE_ID)
            .lean()
            .catch((error) => {
                console.error('[POST-SALE-V66] falha ao ler compatibilidade persistente:', error.message);
                return null;
            });
        const compatibility = assertRuntimeSupportsPostSaleData({
            runtimeVersion: POST_SALE_RUNTIME_VERSION,
            compatibilityState
        });
        if (!compatibility.ok) {
            console.error(`[POST-SALE-V66] runtime mutante bloqueado: ${compatibility.reason}; runtime=${compatibility.runtimeVersion}; minimo=${compatibility.minRuntimeVersion}.`);
            return;
        }
        const mutationGate = resolvePostSaleOperationalMutationGate(process.env, { compatibilityState });
        if (!mutationGate.allowed) {
            console.warn(`[STARTUP-V66] API/health ativos em modo seguro; nenhuma mutacao automatica iniciada; reason=${mutationGate.reason}.`);
            return;
        }
        if (String(process.env.DISABLE_SCHEDULER || '') === '1') {
            console.log('[SCHEDULER] Scheduler desativado por DISABLE_SCHEDULER=1');
            return;
        }
        await pauseOrphanedTexUltraInitialFlowsOnStartup();
        startScheduler({ compatibilityState });
    })
    .catch((error) => console.error('[STARTUP-V66] startup seguro sem scheduler mutante:', error.message));

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const isLocalRequest = (req) => {
    const host = String(req.hostname || req.headers.host || '').split(':')[0];
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    const isPrivateLanHost = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    return ['localhost', '127.0.0.1', '::1'].includes(host)
        || isPrivateLanHost
        || ip === '127.0.0.1'
        || ip === '::1'
        || ip === '::ffff:127.0.0.1';
};

const firstHeaderValue = (value) => Array.isArray(value) ? value[0] : value;

const firstHeaderIp = (value) => String(firstHeaderValue(value) || '').split(',')[0].trim();

const clientRateLimitKey = (req) => {
    const cloudflareIp = firstHeaderIp(req.headers['cf-connecting-ip']);
    if (cloudflareIp) return `cf:${cloudflareIp}`;
    const realIp = firstHeaderIp(req.headers['x-real-ip']);
    if (realIp) return `real:${realIp}`;
    return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
};

const isStaticPanelRequest = (req) => {
    if (!['GET', 'HEAD'].includes(String(req.method || '').toUpperCase())) return false;
    const pathname = String(req.path || req.originalUrl || '').split('?')[0];
    if (['/', '/qr.html', '/leads-window.html', '/funnel-metrics.html', '/favicon.ico'].includes(pathname)) return true;
    if (pathname.startsWith('/media/')) return true;
    return /\.(?:css|js|map|png|jpe?g|webp|gif|svg|ico|mp3|ogg|opus|m4a|mp4|mov|webm|wav|pdf)$/i.test(pathname);
};

const isPanelPollingRequest = (req) => {
    if (!['GET', 'HEAD'].includes(String(req.method || '').toUpperCase())) return false;
    const rawPathname = String(req.path || req.originalUrl || '').split('?')[0];
    const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname;
    return pathname === '/api/zapi/status'
        || pathname === '/api/zapi/device'
        || pathname === '/api/health'
        || pathname === '/api/orders'
        || pathname === '/api/orders/stats'
        || pathname === '/api/shipments'
        || pathname === '/api/shipments/manual-queue'
        || pathname === '/api/shipments/dispatch/status'
        || pathname === '/api/shipments/dispatch/history'
        || pathname === '/api/shipments/servientrega/ec/agencies'
        || pathname === '/api/shipments/droppi/ec/products'
        || pathname === '/api/whatsapp/status'
        || pathname === '/api/whatsapp/chats'
        || pathname === '/api/whatsapp/chats/search'
        || pathname === '/api/whatsapp/dashboard-metrics'
        || pathname === '/api/whatsapp/templates'
        || pathname === '/api/whatsapp/chat-labels'
        || pathname === '/api/funnel-metrics'
        || pathname === '/api/integrations/google-contacts/status'
        || /^\/api\/shipments\/droppi\/ec\/orders\/[^/]+\/submit-status$/.test(pathname)
        || pathname.startsWith('/api/whatsapp/messages/')
        || pathname.startsWith('/api/whatsapp/customer-profile/')
        || pathname.startsWith('/api/observation/');
};

const isPanelOperationalWriteRequest = (req) => {
    const method = String(req.method || '').toUpperCase();
    if (!['POST', 'PATCH'].includes(method)) return false;
    const rawPathname = String(req.path || req.originalUrl || '').split('?')[0];
    const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '') : rawPathname;

    if (method === 'POST' && pathname === '/api/whatsapp/contacts') return true;
    if (method === 'POST' && pathname === '/api/whatsapp/chats/action') return true;
    if (method === 'POST' && pathname === '/api/whatsapp/chats/read') return true;
    if (method === 'POST' && pathname === '/api/automation/alerts/acknowledge') return true;
    if (method === 'PATCH' && /^\/api\/whatsapp\/contact-state\/[^/]+$/.test(pathname)) return true;
    if (method === 'PATCH' && /^\/api\/whatsapp\/chat-labels\/[^/]+$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/integrations\/google-contacts\/(?:connect|disconnect)$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/integrations\/google-contacts\/sync\/[^/]+\/retry$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/integrations\/google-contacts\/sync\/[^/]+\/resolve-name$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/whatsapp\/contact-state\/[^/]+\/(?:claim|release)$/.test(pathname)) return true;
    if (method === 'PATCH' && /^\/api\/orders\/[^/]+$/.test(pathname)) return true;
    if (method === 'POST' && pathname === '/api/orders') return true;
    if (method === 'POST' && pathname === '/api/orders/review/bulk-from-confirmed') return true;
    if (method === 'POST' && /^\/api\/orders\/[^/]+\/(?:send-to-review|finalize-review|clear-review|confirm-payment)$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/shipments\/dispatch\/(?:pause|resume)$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/shipments\/[^/]+\/(?:panel-sync|manual-review|manual-send-required|requeue-dropi-submit|mark-manual-sent|remove-from-confirmed)$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/shipments\/droppi\/ec\/orders\/[^/]+\/(?:authorize-submit|revoke-submit-authorization)$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/shipments\/droppi\/ec\/admin-leads\/[^/]+\/configure-order$/.test(pathname)) return true;
    return false;
};

const noStoreHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store'
};

// Standard Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:", "https:"],
            "media-src": ["'self'", "data:", "blob:", "https:"]
        }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" } // access to media
}));

app.get('/', (_req, res) => {
    res.redirect('/qr.html');
});

app.get('/qr.html', (_req, res) => {
    res.set(noStoreHeaders);
    res.sendFile(path.join(process.cwd(), 'public', 'qr.html'));
});

app.get('/leads-window.html', (_req, res) => {
    res.set(noStoreHeaders);
    res.sendFile(path.join(process.cwd(), 'public', 'leads-window.html'));
});

app.get('/funnel-metrics.html', (_req, res) => {
    res.set(noStoreHeaders);
    res.sendFile(path.join(process.cwd(), 'public', 'funnel-metrics.html'));
});

app.use('/media', express.static('public/media', {
    setHeaders: (res) => res.set(noStoreHeaders)
}));

// Rate Limiting (Global: 1000 requests per 15 minutes)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: clientRateLimitKey,
    skip: (req) => isLocalRequest(req) || isStaticPanelRequest(req) || isPanelPollingRequest(req) || isPanelOperationalWriteRequest(req),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Specific stricter limiter for Auth and Phone Check (prevent enumeration)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased to 100 attempts per 15 min
    keyGenerator: clientRateLimitKey,
    skip: isLocalRequest,
    validate: { trustProxy: false },
    message: { error: 'Too many attempts, please try again later.' }
});
app.use('/api/auth', authLimiter);
app.use('/api/orders/check-phone', authLimiter);

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080',
        'https://maxtourus.com.br',
        'https://www.maxtourus.com.br'
    ],
    credentials: true
}));
// Allow larger payloads because Ops panel can send media as data URLs (base64)
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '25mb' }));

// Serve static files (uploaded media)
app.use(express.static('public')); // Serve generic static files (like qr.html)

app.get('/wa', publicWhatsAppRedirect);
app.get('/wa/ec', publicWhatsAppRedirect);

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/lead', leadsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/meta-events', metaEventsRoutes);
app.use('/api/zapi', zapiRoutes);
app.use('/api/observation', observationRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/funnel-metrics', funnelMetricsRoutes);
app.use('/api/customer-context', customerContextRoutes);

// Observability endpoints
app.use('/api/health', healthRoutes);

// Start Baileys WhatsApp Engine(s)
if (String(process.env.WHATSAPP_CONNECT_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[WHATSAPP] Engine desativado por WHATSAPP_CONNECT_ENABLED=false');
} else {
    startConfiguredWhatsAppSessions().catch(err => {
        console.error('❌ Catastrophic failure booting WhatsApp Engine(s):', err);
    });
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, HOST, () => {
    console.log('');
    console.log('🚀 ================================');
    console.log(`🚀  Express Checkout API Server`);
    if (HOST) console.log(`🚀  Host: ${HOST}`);
    console.log(`🚀  Port: ${PORT}`);
    console.log(`🚀  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🚀 ================================');
    console.log('');
    console.log('📍 Endpoints:');
    console.log(`   POST /api/auth/login`);
    console.log(`   POST /api/auth/register`);
    console.log(`   GET  /api/orders`);
    console.log(`   POST /api/orders`);
    console.log(`   GET  /api/products?country=EC`);
    console.log(`   POST /api/webhook/order-created`);
    console.log('');
});

export default app;
