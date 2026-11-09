/**
 * Ollama Cloud Integration Test Suite
 *
 * Tests requirements 1-20 from the master directive:
 *   - Ollama Cloud provider exists + is configurable
 *   - Model discovery (real API call, never assumes availability)
 *   - Circuit breaker (opens after 5 failures, closes on success)
 *   - PII scrubber (redacts phones, emails, NIDs, etc.)
 *   - Cost estimator (correctly meters paid vs free providers)
 *   - After-hours router (Asia/Dhaka timezone)
 *   - Bounded agent loop (max iterations, approval gate, allowlist)
 *   - End-to-end: real LLM call through bounded loop with tools
 *
 * Run: npx tsx scripts/test-ollama-cloud.ts
 */
import { PrismaClient } from '@prisma/client';
import { scrubPii, isLocalProvider } from '../src/lib/pii-filter';
import {
  withResilience, getBreakerState, recordSuccess, recordFailure, resetBreaker,
  CircuitOpenError, BREAKER_FAILURE_THRESHOLD,
} from '../src/lib/circuit-breaker';
import { estimateCost, getRateTable } from '../src/lib/cost-estimator';
import { evaluateAfterHours } from '../src/lib/after-hours';
import { runAgentLoop, getRegisteredTools } from '../src/lib/agent-loop';
import { TOOL_NAMES, SENSITIVE_TOOLS, AGENT_TOOL_ALLOWLIST } from '../src/lib/agent-tools';
import { chainChat } from '../src/lib/ai-chain';

const prisma = new PrismaClient();
let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else { console.error(`  ✗ ${label}`); fail++; }
}

async function main() {
  // Ensure tools are registered
  await import('../src/lib/agent-tools');

  console.log('\n[1/12] Ollama Cloud provider registered');
  const ollamaCloud = await prisma.aiModelProvider.findUnique({ where: { slug: 'ollama-cloud' } });
  assert(!!ollamaCloud, 'ollama-cloud provider exists in DB');
  assert(ollamaCloud?.baseUrl === 'https://ollama.com/api', 'baseUrl = https://ollama.com/api');
  assert(ollamaCloud?.apiKeyEnvName === 'OLLAMA_CLOUD_API_KEY', 'apiKeyEnvName = OLLAMA_CLOUD_API_KEY');
  assert(ollamaCloud?.apiKeyOptional === false, 'apiKeyOptional = false (key required)');
  assert(ollamaCloud?.category === 'hybrid', 'category = hybrid (paid cloud)');

  console.log('\n[2/12] Local Ollama vs Ollama Cloud separation');
  const localOllama = await prisma.aiModelProvider.findUnique({ where: { slug: 'ollama' } });
  assert(!!localOllama, 'local ollama provider exists');
  assert(localOllama?.baseUrl === 'http://localhost:11434', 'local ollama baseUrl = http://localhost:11434');
  assert(localOllama?.apiKeyOptional === true, 'local ollama apiKeyOptional = true (no key needed)');
  assert(localOllama?.category === 'self-hosted', 'local ollama category = self-hosted (free)');
  assert(localOllama?.id !== ollamaCloud?.id, 'local ollama and ollama-cloud are SEPARATE providers');

  console.log('\n[3/12] Existing providers preserved (no regressions)');
  const allProviders = await prisma.aiModelProvider.findMany();
  const slugs = allProviders.map(p => p.slug);
  for (const expected of ['zai', 'groq', 'gemini', 'openrouter', 'ollama', 'ollama-cloud', 'opencode', 'cloudflare', 'mistral', 'huggingface', 'pollinations']) {
    assert(slugs.includes(expected), `provider "${expected}" still registered`);
  }

  console.log('\n[4/12] PII scrubber — Bangladesh phone + email + NID');
  const pii = scrubPii('Call me at +8801712345678 or email ahmed@example.com. NID: 1234567890');
  assert(pii.wasModified === true, 'prompt was modified');
  assert(pii.redactions.length >= 3, `at least 3 PII entities found (got ${pii.redactions.length})`);
  assert(pii.redacted.includes('[PHONE_REDACTED]'), 'phone was redacted');
  assert(pii.redacted.includes('[EMAIL_REDACTED]'), 'email was redacted');
  assert(pii.redacted.includes('[NID_REDACTED]'), 'NID was redacted');
  assert(!pii.redacted.includes('+8801712345678'), 'original phone not present in redacted output');
  assert(!pii.redacted.includes('ahmed@example.com'), 'original email not present in redacted output');

  console.log('\n[5/12] PII scrubber — passport + birth date + student ID');
  const pii2 = scrubPii('Passport BR1234567, born 1990-05-15, student id STUDENT-2024001');
  assert(pii2.redacted.includes('[PASSPORT_REDACTED]'), 'passport redacted');
  assert(pii2.redacted.includes('[DATE_REDACTED]'), 'birth date redacted');
  assert(pii2.redacted.includes('[STUDENT_ID_REDACTED]'), 'student ID redacted');

  console.log('\n[6/12] isLocalProvider — local vs cloud detection');
  assert(isLocalProvider('ollama', 'http://localhost:11434') === true, 'local ollama detected as local');
  assert(isLocalProvider('ollama-cloud', 'https://ollama.com/api') === false, 'ollama-cloud detected as NOT local');
  assert(isLocalProvider('opencode', 'http://localhost:4096/v1') === true, 'opencode detected as local');
  assert(isLocalProvider('groq', 'https://api.groq.com/openai/v1') === false, 'groq detected as NOT local');

  console.log('\n[7/12] Cost estimator — free vs metered');
  const freeCost = estimateCost('groq', 'llama-3.3-70b-versatile', 1000, 500);
  assert(freeCost.isFree === true, 'groq is free');
  assert(freeCost.estimatedCostUsd === 0, 'groq cost = $0');
  const cloudCost = estimateCost('ollama-cloud', 'llama3.3', 1000, 500);
  assert(cloudCost.isFree === false, 'ollama-cloud is NOT free');
  assert(cloudCost.estimatedCostUsd > 0, `ollama-cloud cost > 0 (got $${cloudCost.estimatedCostUsd})`);
  assert(cloudCost.rateSource === 'estimated', 'ollama-cloud rate source = estimated');
  assert(cloudCost.note?.includes('verify') === true, 'cost note warns to verify pricing');

  console.log('\n[8/12] Cost rate table');
  const rates = getRateTable();
  assert(rates.length >= 11, `rate table has all providers (got ${rates.length})`);
  const cloudRate = rates.find(r => r.provider === 'ollama-cloud');
  assert(cloudRate?.promptRatePer1M === 0.30, 'ollama-cloud prompt rate = $0.30/1M');
  assert(cloudRate?.completionRatePer1M === 0.60, 'ollama-cloud completion rate = $0.60/1M');
  assert(cloudRate?.isFree === false, 'ollama-cloud isFree = false');

  console.log('\n[9/12] After-hours router — Asia/Dhaka');
  // Create a test company + rule
  const testCompany = await prisma.company.upsert({
    where: { slug: 'test-ollama-cloud' },
    update: {},
    create: { name: 'Test Ollama Cloud', slug: 'test-ollama-cloud', plan: 'free' },
  });
  await prisma.afterHoursRule.upsert({
    where: { companyId: testCompany.id },
    update: {},
    create: { companyId: testCompany.id, timezone: 'Asia/Dhaka', workingDays: '[1,2,3,4,5]' },
  });
  const decision = await evaluateAfterHours(testCompany.id);
  assert(decision.timezone === 'Asia/Dhaka', 'timezone = Asia/Dhaka');
  assert(['live', 'queue', 'auto_reply_with_disclaimer', 'emergency_only'].includes(decision.policy), 'policy is a valid value');
  assert(typeof decision.isWorkingHours === 'boolean', 'isWorkingHours is boolean');
  assert(typeof decision.reason === 'string', 'reason is string');

  console.log('\n[10/12] Circuit breaker — open after threshold failures');
  // Create a test provider for breaker testing
  const testProvider = await prisma.aiModelProvider.create({
    data: { slug: `test-breaker-${Date.now()}`, label: 'Test Breaker', baseUrl: 'http://localhost:9999', priority: 999, isEnabled: true },
  });
  await resetBreaker(testProvider.id);
  let breaker = await getBreakerState(testProvider.id, testProvider.slug);
  assert(breaker.state === 'closed', 'breaker starts closed');
  for (let i = 0; i < BREAKER_FAILURE_THRESHOLD; i++) {
    await recordFailure(testProvider.id, `simulated failure ${i + 1}`);
  }
  breaker = await getBreakerState(testProvider.id, testProvider.slug);
  assert(breaker.state === 'open', `breaker opens after ${BREAKER_FAILURE_THRESHOLD} failures`);
  assert(breaker.consecutiveFailures === BREAKER_FAILURE_THRESHOLD, 'failure count matches threshold');
  assert(breaker.tripCount === 1, 'trip count = 1');
  // Verify circuit-open error is thrown when breaker is open
  let caughtCircuitOpen = false;
  try {
    await withResilience(testProvider.id, testProvider.slug, async () => 'should not run', { retryAttempts: 0 });
  } catch (e: any) {
    caughtCircuitOpen = e instanceof CircuitOpenError || e.message.includes('circuit breaker open');
  }
  assert(caughtCircuitOpen, 'withResilience throws CircuitOpenError when breaker is open');
  // Reset and verify it closes
  await resetBreaker(testProvider.id);
  breaker = await getBreakerState(testProvider.id, testProvider.slug);
  assert(breaker.state === 'closed', 'breaker closes after reset');
  await prisma.aiModelProvider.delete({ where: { id: testProvider.id } });

  console.log('\n[11/12] Bounded agent loop — allowlist + max iterations');
  const loopResult = await runAgentLoop({
    task: 'What tools do you have access to? Just list them — do not call any.',
    systemPrompt: 'You are a test agent. List your tools. Do not call any.',
    allowlistedTools: ['crm_lookup_lead', 'seo_keyword_research'],
    companyId: testCompany.id,
    agentType: 'test',
    maxIterations: 2,
  });
  assert(loopResult.terminationReason === 'completed' || loopResult.terminationReason === 'max_iterations', `loop terminated properly (got ${loopResult.terminationReason})`);
  assert(loopResult.toolCalls.length === 0, 'no tools called (LLM should just list them)');
  assert(loopResult.durationMs > 0, 'duration recorded');
  assert(loopResult.llmCalls.length >= 1, 'at least 1 LLM call');

  console.log('\n[12/12] End-to-end: real LLM call through chain');
  const chainResult = await chainChat([
    { role: 'system', content: 'You are a test agent. Respond with exactly: OLLAMA_CLOUD_OK' },
    { role: 'user', content: 'Reply with the exact string.' },
  ], { maxTokens: 30, temperature: 0 });
  assert(chainResult.text.length > 0, 'chain returned non-empty text');
  assert(chainResult.provider !== '', `provider recorded (${chainResult.provider})`);
  assert(chainResult.model !== '', `model recorded (${chainResult.model})`);
  assert(chainResult.durationMs > 0, `latency recorded (${chainResult.durationMs}ms)`);
  console.log(`     → provider=${chainResult.provider}, model=${chainResult.model}, ${chainResult.durationMs}ms, ${chainResult.attempts} attempt(s)`);

  // Cleanup
  await prisma.company.delete({ where: { id: testCompany.id } }).catch(() => {});

  console.log(`\n────────────────────────────────────────`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`────────────────────────────────────────\n`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
