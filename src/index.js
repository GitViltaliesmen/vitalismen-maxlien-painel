import 'dotenv/config';
import path from 'path';
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
import { startScheduler } from './services/schedulerService.js';
import healthRoutes from './routes/health.js';
import { startConfiguredWhatsAppSessions } from './whatsapp/connection.js';

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

// Connect to MongoDB
connectDB();

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

// Standard Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"]
        }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" } // access to media
}));

// Rate Limiting (Global: 1000 requests per 15 minutes)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    skip: isLocalRequest,
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

app.get('/', (_req, res) => {
    res.redirect('/qr.html');
});

app.get('/qr.html', (_req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store'
    });
    res.sendFile(path.join(process.cwd(), 'public', 'qr.html'));
});

app.get('/leads-window.html', (_req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store'
    });
    res.sendFile(path.join(process.cwd(), 'public', 'leads-window.html'));
});

// Serve static files (uploaded media)
app.use(express.static('public')); // Serve generic static files (like qr.html)
app.use('/media', express.static('public/media')); // Keep specific media route if needed for compatibility

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

// Start Scheduler
if (String(process.env.DISABLE_SCHEDULER || '') === '1') {
    console.log('[SCHEDULER] 🛑 Scheduler desativado por DISABLE_SCHEDULER=1');
} else {
    console.log('[SCHEDULER] ✅ Scheduler ativado');
    startScheduler();
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
