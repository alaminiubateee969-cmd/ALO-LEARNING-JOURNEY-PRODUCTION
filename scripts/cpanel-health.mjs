#!/usr/bin/env node
// Quick health probe for cPanel - run via: npm run cpanel:health
// Works both locally and in cPanel container (respects PORT/HOSTNAME)
const port = process.env.PORT || process.env.APP_PORT || "3000";
const host = process.env.HOSTNAME || "127.0.0.1";
const url = `http://${host}:${port}/api/health`;
console.log(`[health] probing ${url} ...`);
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  console.log(`[health] http ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  if (res.ok) console.log("[health] OK - app is responding");
  else console.error("[health] UNHEALTHY - check logs and DATABASE_URL");
  process.exit(res.ok ? 0 : 1);
} catch (e) {
  console.error(`[health] failed to reach ${url}: ${e.message}`);
  console.error("[health] Is the Node app Running? Check cPanel > Application Manager > Logs");
  process.exit(1);
}
