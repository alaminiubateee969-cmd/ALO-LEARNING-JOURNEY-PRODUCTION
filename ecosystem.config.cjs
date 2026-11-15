const fs = require('fs');
const path = require('path');

// Read from .env.config (NOT .env — Next.js auto-loads .env and corrupts $ values)
const envVars = {};
const envPath = path.join(__dirname, '.env.config');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    envVars[m[1]] = val;
  });
}

const CRITICAL = {
  ADMIN_PASSWORD_HASH: 'scrypt$QDpU69Mn8wDFBAg3W5N-FQ$5d6YQFQPhqQoBsZu98K0WKNUCv-8Y5tzYgxI1dmnaVbeSNM77zziqruHn5TI_pkf_BEIHYHKejNWUluy8-YGYw',
  ALO_ADMIN_PASSWORD_HASH: 'scrypt$QDpU69Mn8wDFBAg3W5N-FQ$5d6YQFQPhqQoBsZu98K0WKNUCv-8Y5tzYgxI1dmnaVbeSNM77zziqruHn5TI_pkf_BEIHYHKejNWUluy8-YGYw',
  ADMIN_EMAIL: 'admin@alolabs.net',
  ADMIN_OTP_REQUIRED: 'false',
  NEXTAUTH_SECRET: envVars.NEXTAUTH_SECRET || 'alo-jwt-secret-key-32-bytes-random',
  NEXTAUTH_URL: 'https://learn.alolabs.net',
  JWT_SECRET: envVars.JWT_SECRET || 'fallback-jwt-secret',
  DATABASE_URL: envVars.DATABASE_URL || 'mysql://user_learn:AloLearn2026@127.0.0.1:3306/alo_learning',
};

const standalone = path.join(__dirname, '.next', 'standalone');
const useStandalone = fs.existsSync(path.join(standalone, 'server.js'));

const app = useStandalone ? {
  name: 'alo-learning-journey-prod',
  cwd: __dirname,
  script: path.join(standalone, 'server.js'),
  instances: 1, exec_mode: 'fork', autorestart: true, max_memory_restart: '1G',
  env: { ...envVars, ...CRITICAL, NODE_ENV: 'production', PORT: '3061', HOSTNAME: '127.0.0.1' }
} : {
  name: 'alo-learning-journey-prod',
  cwd: __dirname,
  script: 'node_modules/.bin/next',
  args: 'start -p 3061',
  instances: 1, exec_mode: 'fork', autorestart: true, max_memory_restart: '1G',
  env: { ...envVars, ...CRITICAL, NODE_ENV: 'production', PORT: '3061' }
};

module.exports = { apps: [app] };
