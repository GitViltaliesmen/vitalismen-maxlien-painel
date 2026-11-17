// backend/server.js (recreated)
const path = require('path');
const fs = require('fs');
// Load .env (prefer cwd, then always merge backend/.env overriding defaults)
try {
  const dotenv = require('dotenv');
  try { dotenv.config(); } catch {}
  const p = path.join(__dirname, '.env');
  if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
} catch {}

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');

const logger = require('./logger');
const security = require('./security');
const { buildLimiter } = require('./rateLimiter');
const { CloakerLite } = require('./cloaker-lite');
let whatsapp = null;
let tracking = null;

const app = express();
try { app.set('trust proxy', true); } catch {}

// PM2 cluster: determine if this is the primary instance
// In PM2 cluster mode, NODE_APP_INSTANCE is '0', '1', ... per instance
const INSTANCE = process.env.NODE_APP_INSTANCE;
const IS_PRIMARY = (INSTANCE === undefined || INSTANCE === '0');

// Security headers + CSP
security(app);

// Perf toggles
const ENABLE_COMPRESSION = (process.env.ENABLE_COMPRESSION || 'true').toLowerCase() === 'true';
const PERF_DISABLE_ETAG = (process.env.PERF_DISABLE_ETAG || 'false').toLowerCase() === 'true';
if (PERF_DISABLE_ETAG) app.set('etag', false);

// CORS
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN : true;
app.use(cors({ origin: corsOrigin }));

// Parsers
app.use(bodyParser.json({ limit: '256kb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Request ID + logs
const { randomUUID } = require('crypto');
app.use((req, res, next) => { req.id = randomUUID(); res.setHeader('X-Request-ID', req.id); next(); });
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
  customReceivedMessage: (req) => `start ${req.method} ${req.url}`,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms`,
  customErrorMessage: (req, res) => `error ${req.method} ${req.url} ${res.statusCode || 500} ${res.responseTime}ms`
}));
if (ENABLE_COMPRESSION) app.use(compression());

// Rate limit global
app.use(buildLimiter({ windowMs: 15_000, max: 240, prefix: 'rl:g:' }));

// Static dir reference (mount later to avoid cloaker bypass)
const staticDir = path.join(__dirname, 'public');
const staticOpts = { maxAge: '7d', immutable: true, index: false };
const protocoloGPrivateVslFile = path.join(__dirname, 'private', 'vsl', 'protocolo-g.html');
const protocoloGInformativeFile = path.join(staticDir, 'verdevibe', 'dist', 'index.html');
const exutraPrivateVslFile = path.join(__dirname, 'private', 'vsl', 'exutra.html');
const exutraInformativeFile = path.join(staticDir, 'exutra', 'desktop', 'index.html');

// MongoDB (optional)
try {
  const mongoUri = process.env.MONGO_URI || '';
  if (mongoUri) {
    // Avoid long 10s buffer timeouts when DB is unreachable
    mongoose.set('bufferCommands', false);
    mongoose.set('strictQuery', true);
    mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        maxPoolSize: 10,
      })
      .then(() => { try { logger.info({ msg: 'mongo_connected' }); } catch {} })
      .catch((err) => { try { logger.warn({ msg: 'mongo_connect_failed', err: err && err.message ? err.message : String(err) }); } catch {} });
  } else {
    try { logger.warn({ msg: 'mongo_disabled (MONGO_URI not set)' }); } catch {}
  }
} catch {}

// Routers
const vitpowerMeta = require('./vitpower-meta-server').createVitpowerMeta({ logger });
app.post('/api/public/vitpower-meta', buildLimiter({ windowMs: 60_000, max: 120, prefix: 'rl:vpmeta:' }), vitpowerMeta.handler);
vitpowerMeta.start();
// Tex measurement V243 is independent of every existing route and legacy queue.
const texMeasurementV243 = require('./tex-measurement-v243').createTexMeasurementV243({ logger });
app.post('/api/public/tex-measurement', buildLimiter({ windowMs: 60_000, max: 120, prefix: 'rl:tex243:' }), texMeasurementV243.publicHandler);
app.post('/api/private/tex-measurement-proof', buildLimiter({ windowMs: 60_000, max: 120, prefix: 'rl:tex243proof:' }), texMeasurementV243.proofHandler);
app.use('/api/public', require('./routes/public'));
app.use('/api', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// Cloaker
// Block crawlers/scanners, but allow Facebook in-app browser (do not match generic 'facebook')
const BLOCKED_UA = /(Facebot|facebookexternalhit|curl|yandex\.com\/bots|\b(bot|spider|crawler)\b|zgrab|bingbot|Googlebot|Wappalyzer|Semrush|AhrefsBot|OpenVAS|Qualys|WappalyzerBot|SemrushBot)/i;
const BLOCKED_REF = /(pipiads|adspy|adheart|semrush)/i;
const BLOCKED_Q   = /(ga|_ga|_gat|_gid|_gcl_au|bot|spider|crawler)/i;
const { cloakerMiddleware, smartIndexHandler, evaluate, ban: cloakerBan, unban: cloakerUnban } = CloakerLite({
  redis: require('./rateLimiter').redis || null,
  options: {
    publicDir: staticDir,
    okFile: (process.env.INDEX_OK_FILE || 'index.html').trim() || 'index.html',
    blockFile: (process.env.INDEX_BLOCK_FILE || 'index-2.html').trim() || 'index-2.html',
    blockedUA: BLOCKED_UA,
    blockedRef: BLOCKED_REF,
    blockedQ: BLOCKED_Q
  }
});

// Expose cloaker helpers to routes via app.locals so admin can unban
try {
  app.locals.cloakerUnban = cloakerUnban;
  app.locals.cloakerBan = cloakerBan;
} catch {}

// Root guarded by cloaker
app.get(['/', '/index.html'], smartIndexHandler);

function cloakPage(okFile, blockedFile = 'index-2.html') {
  return async (req, res) => {
    try {
      const r = await evaluate(req);
      try {
        logger.info({
          evt: 'cloaker_decision',
          path: req.path,
          ip: r.ip || '',
          allowed: !!r.allowed,
          reason: r.reason || (r.allowed ? 'ok' : 'blocked'),
          status: r.allowed ? 'liberado' : 'bloqueado',
          ua: req.headers['user-agent'] || '',
          cc: req.headers['cf-ipcountry'] || ''
        });
      } catch {}
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('X-Cloaker', r.allowed ? 'allowed' : `blocked; reason=${r.reason}`);
      try { res.set('X-Effective-IP', r.ip || ''); } catch {}
      if (!r.allowed) { try { res.set('X-Block-Reason', r.reason || 'blocked'); } catch {} }
      res.set('Vary', 'Accept-Language, User-Agent, CF-Connecting-IP');
      try { res.removeHeader('ETag'); res.removeHeader('Last-Modified'); } catch {}
      if (!r.allowed && typeof blockedFile === 'string' && blockedFile.startsWith('/')) {
        return res.redirect(302, blockedFile);
      }
      const file = r.allowed ? okFile : blockedFile;
      return res.sendFile(file, { root: staticDir });
    } catch {
      return res.sendFile(okFile, { root: staticDir });
    }
  };
}

function cloakPageMulti(okFile, blockedFiles = [], okRoot = staticDir) {
  const arr = Array.isArray(blockedFiles) ? blockedFiles.filter(Boolean) : [];
  const pickExisting = (candidates) => {
    for (const f of candidates) {
      try {
        if (typeof f === 'string' && f.startsWith('/')) return f; // redirect target
        if (typeof f === 'string' && fs.existsSync(path.join(staticDir, f))) return f;
      } catch {}
    }
    return candidates[0];
  };
  return async (req, res) => {
    try {
      const r = await evaluate(req);
      try {
        logger.info({
          evt: 'cloaker_decision',
          path: req.path,
          ip: r.ip || '',
          allowed: !!r.allowed,
          reason: r.reason || (r.allowed ? 'ok' : 'blocked'),
          status: r.allowed ? 'liberado' : 'bloqueado',
          ua: req.headers['user-agent'] || '',
          cc: req.headers['cf-ipcountry'] || ''
        });
      } catch {}
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('X-Cloaker', r.allowed ? 'allowed' : `blocked; reason=${r.reason}`);
      try { res.set('X-Effective-IP', r.ip || ''); } catch {}
      if (!r.allowed) { try { res.set('X-Block-Reason', r.reason || 'blocked'); } catch {} }
      res.set('Vary', 'Accept-Language, User-Agent, CF-Connecting-IP');
      try { res.removeHeader('ETag'); res.removeHeader('Last-Modified'); } catch {}

      if (r.allowed) return res.sendFile(okFile, { root: okRoot });

      const bf = pickExisting(arr);
      if (typeof bf === 'string' && bf.startsWith('/')) return res.redirect(302, bf);
      return res.sendFile(bf || okFile, { root: staticDir });
    } catch {
      return res.sendFile(okFile, { root: okRoot });
    }
  };
}

// Content routes with cloaker
// Assets do build do VerdeVibe (Vite) quando servido em /protocolo1
try {
  const verdevibeAssetsDir = path.join(staticDir, 'verdevibe', 'dist', 'assets');
  app.use('/protocolo1/assets', express.static(verdevibeAssetsDir, { maxAge: '7d', immutable: true, index: false }));
} catch {}

app.get('/upsell-1', cloakPage('upsell-1.html', 'upsell-1-blocked.html'));
app.get('/upsell-2', cloakPage('upsell-2.html'));
app.get('/checkout', cloakPage('checkout.html'));
app.get('/downsell-1', cloakPage('downsell-1.html', 'downsell-blocked.html'));
app.get('/downsell-2', cloakPage('downsell-2.html', 'downsell-blocked.html'));
app.get('/protocolo', cloakPageMulti('protocolo.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));
app.get('/protocolo.html', cloakPageMulti('protocolo.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));
app.get('/protocolo-d', cloakPageMulti('protocolo-d.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));
app.get('/protocolo-d.html', cloakPageMulti('protocolo-d.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));
// Novo caminho: /protocolo1 usa protocolo.html como liberada e verdevibe como bloqueada (sem afetar o cloaker atual)
app.get(['/protocolo1', '/protocolo1/'], cloakPageMulti('protocolo.html', [
  'verdevibe/dist/index.html',   // React build (Vite)
  'verdevibe/blocked.html',      // fallback estÃ¡tico
  'protocolo-blocked.html'       // fallback antigo
]));
	app.get('/protocolo1.html', cloakPageMulti('protocolo.html', [
	  'verdevibe/dist/index.html',
	  'verdevibe/blocked.html',
	  'protocolo-blocked.html'
	]));
	function setProtocoloGNoStoreHeaders(res) {
  res.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.set('CDN-Cache-Control', 'no-store');
  res.set('Cloudflare-CDN-Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.vary('User-Agent');
  res.vary('Sec-CH-UA-Mobile');
  res.vary('Sec-CH-UA-Platform');
}

function serveProtocoloGInformative(res) {
  res.set('X-Protocolo-G-Variant', 'informativa-desktop');
  return res.sendFile(protocoloGInformativeFile);
}

function serveProtocoloGByDevice(req, res) {
  setProtocoloGNoStoreHeaders(res);
  const userAgent = String(req.get('user-agent') || '');
  const mobileHint = String(req.get('sec-ch-ua-mobile') || '').trim() === '?1';
  const isMobileOrTablet =
    mobileHint ||
    /Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk|Kindle/i.test(userAgent);

  if (!isMobileOrTablet) {
    return serveProtocoloGInformative(res);
  }

  res.set('X-Protocolo-G-Variant', 'vsl-mobile');
  return res.sendFile(protocoloGPrivateVslFile, (error) => {
    if (!error) return;
    if (!res.headersSent) {
      res.set('X-Protocolo-G-Variant', 'informativa-desktop');
      return res.sendFile(protocoloGInformativeFile);
    }
    return res.end();
  });
}

app.get('/protocolo-g', serveProtocoloGByDevice);
const vitpowerPage = cloakPageMulti('vitpower.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
], path.join(__dirname, 'private', 'vsl'));
app.get(['/tex', '/tex/'], (req, res) => {
  setProtocoloGNoStoreHeaders(res);
  return vitpowerPage(req, res);
});
app.get(['/bienestar', '/bienestar/', '/vitpower', '/vitpower/', '/vitpoers', '/vitpoers/'], (req, res) => {
  setProtocoloGNoStoreHeaders(res);
  const queryStart = req.originalUrl.indexOf('?');
  const query = queryStart === -1 ? '' : req.originalUrl.slice(queryStart);
  return res.redirect(302, '/tex' + query);
});
app.get(['/tex/index.html', '/bienestar/index.html', '/vitpower/index.html', '/vitpoers/index.html'], (_req, res) => {
  setProtocoloGNoStoreHeaders(res);
  return res.status(404).type('text/plain').send('Not Found');
});
app.get('/exutra', require('./exutraRoute.cjs').createExutraRoute({
  evaluate,
  setNoStoreHeaders: setProtocoloGNoStoreHeaders,
  vslFile: exutraPrivateVslFile,
  informativeFile: exutraInformativeFile
}));
app.get('/protocolo-g.html', (_req, res) => {
  setProtocoloGNoStoreHeaders(res);
  return res.status(404).type('text/plain').send('Not Found');
});
	app.get('/ortoflex', cloakPageMulti('ortoflex.html', [
	  'verdevibe/dist/index.html',
	  'verdevibe/blocked.html',
	  'protocolo-blocked.html'
	]));
	app.get('/ortoflex.html', cloakPageMulti('ortoflex.html', [
	  'verdevibe/dist/index.html',
	  'verdevibe/blocked.html',
	  'protocolo-blocked.html'
	]));
	// Equador: /protocolo-g-ec usa protocolo-g-ec.html como liberada e mantÃ©m o bloqueio padrÃ£o do /protocolo-g
	app.get('/protocolo-g-ec', cloakPage('protocolo-g-ec.html', 'index-2.html'));
	app.get('/protocolo-g-ec.html', cloakPage('protocolo-g-ec.html', 'index-2.html'));
	app.get('/protocolo-co', cloakPageMulti('protocolo-co.html', [
	  'verdevibe/dist/index.html',   // mesma bloqueada (React) do /protocolo1
	  'verdevibe/blocked.html',      // fallback estÃ¡tico (se existir)
	  'protocolo-blocked.html'       // fallback antigo
]));
// Also protect direct .html access
app.get('/protocolo-ht', cloakPage('protocolo-ht.html', 'protocolo-blocked.html'));
app.get('/protocolo-ht.html', cloakPage('protocolo-ht.html', 'protocolo-blocked.html'));
app.get('/protocolo-co.html', cloakPageMulti('protocolo-co.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));
app.get('/protocolo-tg', cloakPageMulti('protocolo-tg.html', [
  'index-2.html',
  'index-2-new.html',
  'index-2-alt.html'
]));
app.get('/protocolo-tg.html', cloakPageMulti('protocolo-tg.html', [
  'index-2.html',
  'index-2-new.html',
  'index-2-alt.html'
]));

app.get('/protocolo-gt', cloakPageMulti('protocolo-gt.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));
app.get('/protocolo-gt.html', cloakPageMulti('protocolo-gt.html', [
  'verdevibe/dist/index.html',
  'verdevibe/blocked.html',
  'protocolo-blocked.html'
]));

// Defense in depth: never expose operational artifacts through the public root.
// Keep ACME/standards verification paths available for the reverse proxy.
function blockSensitivePublicPath(req, res, next) {
  const rawPath = String(req.path || '');
  let requestPath = rawPath;
  try { requestPath = decodeURIComponent(rawPath); } catch {}

  const lowerPath = requestPath.toLowerCase();
  if (lowerPath === '/.well-known' || lowerPath.startsWith('/.well-known/')) {
    return next();
  }

  const segments = lowerPath.split('/').filter(Boolean);
  const fileName = segments.length ? segments[segments.length - 1] : '';
  const blockedDirectories = new Set([
    '.git', 'log', 'logs', 'dump', 'dumps', 'config', 'configs',
    'test', 'tests', 'doc', 'docs', 'tmp', 'temp', 'work',
    'private', 'backup', 'backups'
  ]);
  const blockedDirectory = segments.some((segment) => blockedDirectories.has(segment));
  const blockedDotfile = segments.some((segment) => segment.startsWith('.'));
  const blockedArtifact = /(?:\.bak(?:[-.].*)?|\.backup(?:[-.].*)?|\.old(?:[-.].*)?|\.tmp(?:[-.].*)?|\.log|\.dump|\.sql|\.map|~)$/i.test(fileName);
  const blockedConfig = /^(?:package(?:-lock)?\.json|npm-shrinkwrap\.json|(?:ts|js)config(?:\.[^.]+)?\.json|(?:vite|webpack|rollup|ecosystem)\.config\.[^.]+|config\.(?:js|cjs|mjs|ts|json|ya?ml))$/i.test(fileName);

  if (blockedDirectory || blockedDotfile || blockedArtifact || blockedConfig) {
    return res.status(404).type('text/plain').send('Not Found');
  }
  return next();
}

app.use(blockSensitivePublicPath);

// Mount static AFTER cloaked content routes so .html is not bypassed
app.use(express.static(staticDir, staticOpts));
// Helper to set permissive headers for media so the extension can embed
const mediaStaticHeaders = (res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Relax CSP for subresource responses (browsers usually ignore CSP on subresources, but be safe)
    res.setHeader('Content-Security-Policy', "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:; media-src * data: blob:");
    res.setHeader('Timing-Allow-Origin', '*');
  } catch {}
};
// Expose audio assets for voice-sender UI
try { app.use('/audios', express.static(path.join(__dirname, 'audio'), { maxAge: '1h', setHeaders: mediaStaticHeaders })); } catch {}
// Expose image assets for voice-sender UI (preview only)
try { app.use('/wa-images', express.static(path.join(__dirname, 'images'), { maxAge: '1h', setHeaders: mediaStaticHeaders })); } catch {}
// Also expose at /images to match extension defaults
try { app.use('/images', express.static(path.join(__dirname, 'images'), { maxAge: '1h', setHeaders: mediaStaticHeaders })); } catch {}

// Admin UI
app.get('/admin/login', (req, res) => {
  try { return res.sendFile('admin/login.html', { root: staticDir }); } catch {}
  res.status(404).send('login not found');
});
app.get('/admin/analytics', (req, res) => {
  const p = path.join(staticDir, 'admin', 'analytics.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('analytics not found');
});
app.get('/admin/analytics.html', (req, res) => {
  const p = path.join(staticDir, 'admin', 'analytics.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('analytics not found');
});
app.get(['/admin', '/admin/*'], (req, res) => {
  const p = path.join(staticDir, 'admin', 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(200).send('<!doctype html><meta charset="utf-8"><title>Admin</title><body style="font-family:system-ui;max-width:640px;margin:40px auto"><h1>Admin</h1><p>Admin UI nÃ£o pÃ´de ser servido. Verifique se <code>backend/public/admin/index.html</code> existe no servidor e reinicie a aplicaÃ§Ã£o.</p></body>');
});

// Favicon helper -> serve our SVG
app.get('/favicon.ico', (req, res) => {
  try { return res.sendFile('favicon.svg', { root: staticDir }); } catch {}
  res.status(204).end();
});

// Debug: whoami (sanitized; do not expose cloaker config publicly)
app.get('/api/public/whoami', async (req, res) => {
  try {
    const decision = await evaluate(req);
    const rawCf = req.headers['cf-connecting-ip'] || '';
    const rawXf = req.headers['x-forwarded-for'] || '';
    const sock  = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      ip_header_guess: rawCf || rawXf || req.ip,
      ua: req.headers['user-agent'] || '',
      transport: { rawCf, rawXf, sock, forwarded: req.headers['forwarded'] || '' },
      decision
    }));
  } catch {
    res.statusCode = 500; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ ok: false }));
  }
});

// Intent classifier (Spanish-CO) using local heuristic + optional OpenAI
app.post('/api/public/classify', express.json({ limit: '8kb' }), async (req, res) => {
  try {
    const { classifyYesNo } = require('./utils/classifier');
    const text = String((req.body && req.body.text) || '');
    if (!text) return res.status(400).json({ ok: false, error: 'missing_text' });
    const out = await classifyYesNo(text);
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    return res.status(200).json({ ok: true, label: 'uncertain', confidence: 0.5, reason: 'error', source: 'local' });
  }
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || process.env.BIND_HOST || '0.0.0.0';

// Fallback para requisiÃ§Ãµes nÃ£o atendidas por nenhuma rota: evitar 404 em navegaÃ§Ãµes
// - Para Accept com HTML, servir a pÃ¡gina de Ã­ndice via cloaker
// - Para assets/APIs inexistentes, retornar 404.html se existir
app.use((req, res, next) => {
  try {
    const accept = String(req.headers['accept'] || '');
    // Ignore if already handled
    if (res.headersSent) return next();
    // NavegaÃ§Ã£o (HTML): devolve a pÃ¡gina inicial protegida
    if (accept.includes('text/html')) {
      return smartIndexHandler(req, res);
    }
    // Asset/API: tenta servir um 404 amigÃ¡vel, senÃ£o texto
    const p404 = path.join(staticDir, '404.html');
    if (fs.existsSync(p404)) return res.status(404).sendFile(p404);
    return res.status(404).send('Not Found');
  } catch {
    return res.status(404).send('Not Found');
  }
});

const server = app.listen(PORT, HOST, () => {
  try { logger.info({ msg: `listening on ${HOST}:${PORT}` }); } catch { console.log(`listening on ${HOST}:${PORT}`); }
});

// Ajustes recomendados atrÃ¡s de proxy/tÃºnel (Cloudflare/ALB)
try {
  // MantÃ©m conexÃµes estÃ¡veis com o cloudflared/edge
  server.keepAliveTimeout = parseInt(process.env.NODE_KEEPALIVE_TIMEOUT_MS || '65000', 10);
  server.headersTimeout = parseInt(process.env.NODE_HEADERS_TIMEOUT_MS || '67000', 10);
  // 0 = sem timeout de request no Node (deixar proxy gerir)
  server.requestTimeout = parseInt(process.env.NODE_REQUEST_TIMEOUT_MS || '0', 10);
} catch {}

// Initialize WhatsApp (optional) â€” only on primary instance to avoid duplicates in cluster
try {
  const waEnabled = (process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true';
  const waAll = (process.env.WA_ON_ALL_INSTANCES || 'false').toLowerCase();
  if ((IS_PRIMARY || waAll === 'true' || waAll === '1' || waAll === 'on' || waAll === 'yes') && waEnabled) {
    whatsapp = require('./whatsapp');
    whatsapp.initWhatsApp(app);
  }
} catch {}

// Start tracking watcher (Interrapidisimo)
// By default only on primary instance; override with TRACKING_ON_ALL_INSTANCES=true
try {
  tracking = require('./tracking');
  const TRACK_ON_ALL = (process.env.TRACKING_ON_ALL_INSTANCES || 'false').toLowerCase() === 'true';
  if ((IS_PRIMARY || TRACK_ON_ALL) && tracking && typeof tracking.startWatcher === 'function') {
    try { logger.info({ msg: 'tracking_watcher_start', primary: IS_PRIMARY, instance: String(INSTANCE ?? '') }); } catch {}
    tracking.startWatcher();
  }
} catch {}

// Schedule Dropi automation (batch send) at set Brazil times
try {
  const DROP_ON_ALL = (process.env.DROPI_ON_ALL_INSTANCES || 'false').toLowerCase() === 'true';
  if (IS_PRIMARY || DROP_ON_ALL) {
    const { scheduleDropiJobs } = require('./scheduler/dropiScheduler');
    scheduleDropiJobs();
  }
} catch {}

// Schedule Colombia job at 11:00 and 19:00 (America/Bogota)
try {
  const CO_ON_ALL = (process.env.COLOMBIA_ON_ALL_INSTANCES || 'false').toLowerCase() === 'true';
  if (IS_PRIMARY || CO_ON_ALL) {
    const cron = require('node-cron');
    const { spawn } = require('child_process');
    const tz = process.env.COLOMBIA_SCHEDULE_TZ || 'America/Bogota';
    const timesRaw = (process.env.COLOMBIA_SCHEDULE_TIMES || '11:00,19:00').split(',').map(s => String(s||'').trim()).filter(Boolean);

    const fmtYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const nowBRT = () => new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

    function computeRangeForRun() {
      // Calcular faixa de datas no fuso da Dropi (ColÃ´mbia) para alinhar com o calendÃ¡rio do site
      const co = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      co.setHours(0, 0, 0, 0);
      const dow = co.getDay(); // 0=Domingo, 1=Segunda, 2=TerÃ§a, ...
      if (dow === 1) {
        // Segunda: cobrir SÃ¡bado atÃ© Segunda (inclusivo) no fuso BogotÃ¡
        const sat = new Date(co); sat.setDate(co.getDate() - 2);
        return { from: fmtYMD(sat), until: fmtYMD(co), reason: 'monday_weekend_plus_mon' };
      }
      if (dow >= 2 && dow <= 6) {
        // TerÃ§a a SÃ¡bado: usar ONTEMâ†’HOJE (fuso BogotÃ¡) para garantir visibilidade dos registros do dia anterior
        const y = new Date(co); y.setDate(co.getDate() - 1);
        return { from: fmtYMD(y), until: fmtYMD(co), reason: 'weekday_yesterday_to_today' };
      }
      // Domingo: usar hoje (fuso BogotÃ¡)
      return { from: fmtYMD(co), until: fmtYMD(co), reason: 'sunday_today' };
    }

    function runColombiaJob(trigger) {
      const range = computeRangeForRun();
      try { logger.info({ evt: 'colombia_schedule_fire', trigger, ...range }); } catch {}
      const child = spawn('node', [ 'colombia.js' ], {
        cwd: __dirname,
        env: { ...process.env, DATE_FROM: range.from, DATE_UNTIL: range.until },
        stdio: 'inherit'
      });
      child.on('exit', (code, signal) => {
        try { logger.info({ evt: 'colombia_schedule_exit', code, signal }); } catch {}
      });
      child.on('error', (err) => {
        try { logger.error({ evt: 'colombia_schedule_error', err: err && err.message ? err.message : String(err) }); } catch {}
      });
    }

    // Register schedules from env list (HH:mm)
    for (const t of timesRaw) {
      const m = t.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) continue;
      const hh = Math.max(0, Math.min(23, Number(m[1])));
      const mm = Math.max(0, Math.min(59, Number(m[2])));
      const expr = `${mm} ${hh} * * *`;
      const tag = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
      cron.schedule(expr, () => runColombiaJob(`sched_${tag}`), { timezone: tz });
    }
    try { logger.info({ msg: 'colombia_schedule_ready', tz, times: timesRaw }); } catch {}
  }
} catch {}
