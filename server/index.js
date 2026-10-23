import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { Store } from './store.js';
import { createEngine } from './services/engine.js';
import { buildRouter } from './routes.js';
import { startTelegram } from './services/telegram.js';

const store = new Store(config.dataDir);
const engine = createEngine(store);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https://*.basemaps.cartocdn.com', 'https://*.tile.opentopomap.org', 'https://server.arcgisonline.com', 'https://*.tile.openstreetmap.org'],
      'media-src': ["'self'", 'blob:'],
      'connect-src': ["'self'"],
      'worker-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    },
  },
}));
app.use('/api', buildRouter(store, engine));
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', setHeaders: (res) => res.set('Content-Disposition', 'inline') }));
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, { maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('sw.js') || p.endsWith('index.html')) res.set('Cache-Control', 'no-cache'); } }));
  app.get(/^\/(?!api|uploads).*/, (_q, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
}
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'server error' }); });

const server = app.listen(config.port, () => {
  console.log(`\n  Dhara Alert API on http://localhost:${config.port}`);
  console.log(`  Live data refresh every ${config.refreshMinutes} min | SMS: ${config.smsEnabled ? 'Twilio enabled' : 'not configured (in-app alerts only)'} | model: ${engine.model.source}`);
  if (config.adminTokenGenerated) console.log(`  Authority token (set ADMIN_TOKEN to fix it): ${config.adminToken}`);
  console.log('');
});
startTelegram(store);
engine.refresh().then(() => console.log('[engine] first refresh done', engine.status.weather.ok ? '(live)' : '(weather unavailable: ' + engine.status.weather.error + ')'));
setInterval(() => engine.refresh(), config.refreshMinutes * 60e3).unref();
const stop = () => { store.flushAll(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
