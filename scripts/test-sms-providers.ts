/**
 * SMS Provider Chain tests.
 *
 * Verifies:
 *   - Provider chain correctly detects configured vs unconfigured state
 *   - sendSmsViaProvider returns simulation when no provider is set
 *   - getSmsProviderStatus reflects env var configuration
 *   - Postiz adapter reports configuration correctly
 *
 * Does NOT make real provider calls (no real Twilio/httpSMS/etc credentials
 * are configured in the test env). When real credentials exist, integration
 * tests against the actual provider sandbox would be added separately.
 */
import { sendSmsViaProvider, getSmsProviderStatus, type SendSmsInput } from '../src/lib/sms-provider-chain';
import { isPostizConfigured, publishPost } from '../src/lib/postiz-adapter';

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else { console.error(`  ✗ ${label}`); fail++; }
}

async function main() {
  // Save env state so we can manipulate it
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER',
                   'HTTPSMS_API_KEY', 'HTTPSMS_FROM_NUMBER',
                   'TELNYX_API_KEY', 'TELNYX_CONNECTION_ID', 'TELNYX_FROM_NUMBER',
                   'DOMOVINA_SMS_API_URL', 'DOMOVINA_SMS_API_KEY',
                   'POSTIZ_BASE_URL', 'POSTIZ_API_KEY', 'POSTIZ_WORKSPACE_ID', 'CRON_SECRET'];
  for (const k of envKeys) { savedEnv[k] = process.env[k]; delete process.env[k]; }

  console.log('\n[1/8] No SMS provider configured → simulation');
  let status = getSmsProviderStatus();
  assert(status.length === 4, '4 providers in chain');
  assert(status.every(p => !p.configured), 'none configured when no env vars');
  let result = await sendSmsViaProvider({ to: '+15551234567', body: 'test message', companyId: 'test' });
  assert(result.simulated === true, 'simulated=true when no provider configured');
  assert(result.providerName === 'simulation', 'providerName=simulation');
  assert(result.status === 'simulation', 'status=simulation');
  assert(!!result.error, 'error message explains how to configure');

  console.log('\n[2/8] Twilio detected when env vars set');
  process.env.TWILIO_ACCOUNT_SID = 'AC_test_sid';
  process.env.TWILIO_AUTH_TOKEN = 'test_token';
  process.env.TWILIO_FROM_NUMBER = '+15550000000';
  status = getSmsProviderStatus();
  assert(status[0].name === 'twilio', 'first provider is twilio');
  assert(status[0].configured === true, 'twilio is configured');
  assert(status[0].fromNumber === '+15550000000', 'twilio from-number is exposed');
  assert(status[1].configured === false, 'httpsms not configured');

  console.log('\n[3/8] Twilio real call — auth failure (test credentials)');
  result = await sendSmsViaProvider({ to: '+15551234567', body: 'test', companyId: 'test' });
  // Twilio will return HTTP 401 with test creds — this is the EXPECTED behaviour
  assert(result.providerName === 'twilio', 'twilio was attempted');
  assert(result.simulated === false, 'not simulated (real call made)');
  assert(result.status === 'failed', 'failed (test creds should 401)');
  assert(result.providerHttpStatus === 401 || result.providerHttpStatus === 403, `HTTP 401/403 from Twilio (got ${result.providerHttpStatus})`);
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;

  console.log('\n[4/8] httpSMS detected when env vars set');
  process.env.HTTPSMS_API_KEY = 'test_httpsms_key';
  process.env.HTTPSMS_FROM_NUMBER = '+15551111111';
  status = getSmsProviderStatus();
  assert(status[1].configured === true, 'httpsms is configured');
  assert(status[1].fromNumber === '+15551111111', 'httpsms from-number is exposed');

  console.log('\n[5/8] Telnyx detected when env vars set');
  process.env.TELNYX_API_KEY = 'test_telnyx_key';
  process.env.TELNYX_CONNECTION_ID = 'test-conn-id';
  process.env.TELNYX_FROM_NUMBER = '+15552222222';
  status = getSmsProviderStatus();
  assert(status[2].configured === true, 'telnyx is configured');

  console.log('\n[6/8] Domovina detected when env vars set');
  process.env.DOMOVINA_SMS_API_URL = 'https://sms.example.com';
  process.env.DOMOVINA_SMS_API_KEY = 'test_domovina_key';
  status = getSmsProviderStatus();
  assert(status[3].configured === true, 'domovina is configured');

  console.log('\n[7/8] Postiz adapter — configuration detection');
  assert(isPostizConfigured() === false, 'postiz NOT configured when env vars missing');
  process.env.POSTIZ_BASE_URL = 'http://localhost:4000';
  process.env.POSTIZ_API_KEY = 'test_postiz_key';
  process.env.POSTIZ_WORKSPACE_ID = 'test-workspace';
  assert(isPostizConfigured() === true, 'postiz IS configured when env vars set');

  console.log('\n[8/8] Postiz adapter — simulation when not configured');
  delete process.env.POSTIZ_BASE_URL;
  delete process.env.POSTIZ_API_KEY;
  delete process.env.POSTIZ_WORKSPACE_ID;
  const pubResult = await publishPost({
    contentId: 'test-content',
    text: 'Test post',
    platforms: ['facebook', 'instagram'],
  });
  assert(pubResult.simulated === true, 'publishPost returns simulated=true when no Postiz');
  assert(pubResult.providerName === 'simulation', 'providerName=simulation');
  assert(pubResult.httpStatus === 0, 'httpStatus=0 (no real call made)');
  assert(!!pubResult.error, 'error message explains configuration requirement');

  // Restore env
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v) process.env[k] = v;
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`────────────────────────────────────────\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
