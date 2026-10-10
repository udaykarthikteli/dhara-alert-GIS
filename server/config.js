import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// tiny .env loader (no dependency)
try {
  const envFile = path.join(here, '..', '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]] && m[2] !== '') process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

export const config = {
  port: Number(process.env.PORT || 8787),
  dataDir: process.env.DATA_DIR || path.join(here, 'data'),
  uploadDir: process.env.UPLOAD_DIR || path.join(here, 'uploads'),
  clientDist: path.join(here, '..', 'client', 'dist'),
  refreshMinutes: Number(process.env.REFRESH_MINUTES || 15),
  adminToken: process.env.ADMIN_TOKEN || crypto.randomBytes(9).toString('base64url'),
  adminTokenGenerated: !process.env.ADMIN_TOKEN,
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_FROM,
  },
  // North-East India coverage box
  bounds: { south: 21.5, west: 87.5, north: 29.6, east: 97.6 },
};
config.smsEnabled = Boolean(config.twilio.sid && config.twilio.token && config.twilio.from);
