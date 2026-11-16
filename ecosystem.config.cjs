const fs = require('node:fs');
const path = require('node:path');

// Parse .env and .env.config literally (no `$` interpolation, which would
// corrupt `scrypt$<salt>$<hash>` values when Next.js runs dotenv-expand).
// Values in .env.config take precedence over .env.
const envVars = {};
for (const filename of ['.env', '.env.config']) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[m[1]] = val;
  }
}

const releaseFile = path.join(__dirname, 'RELEASE_SHA');
const releaseSha =
  envVars.RELEASE_SHA ||
  process.env.RELEASE_SHA ||
  (fs.existsSync(releaseFile) ? fs.readFileSync(releaseFile, 'utf8').trim() : 'unknown');

const port = String(envVars.PORT || process.env.PORT || '3061');
const runtimeEnv = {
  ...envVars,
  NODE_ENV: 'production',
  PORT: port,
  NEXTAUTH_URL: envVars.NEXTAUTH_URL || process.env.NEXTAUTH_URL || 'https://learn.alolabs.net',
  ADMIN_OTP_REQUIRED: envVars.ADMIN_OTP_REQUIRED ?? process.env.ADMIN_OTP_REQUIRED ?? 'false',
  RELEASE_SHA: releaseSha,
};

for (const key of [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'JWT_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD_HASH',
  'ALO_ADMIN_PASSWORD_HASH',
  'VAULT_MASTER_KEY',
  'CRON_SECRET',
]) {
  const resolved = envVars[key] || process.env[key];
  if (resolved) runtimeEnv[key] = resolved;
}

const standalone = path.join(__dirname, '.next', 'standalone');
const useStandalone = fs.existsSync(path.join(standalone, 'server.js'));

const app = useStandalone
  ? {
      name: 'alo-learning-journey-prod',
      cwd: __dirname,
      script: path.join(standalone, 'server.js'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: { ...runtimeEnv, HOSTNAME: envVars.HOSTNAME || '127.0.0.1' },
    }
  : {
      name: 'alo-learning-journey-prod',
      cwd: __dirname,
      script: 'node_modules/.bin/next',
      args: `start -p ${port}`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: runtimeEnv,
    };

module.exports = { apps: [app] };
