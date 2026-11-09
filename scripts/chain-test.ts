import { chainChat } from '../src/lib/ai-chain';
(async () => {
  const r = await chainChat(
    [{ role: 'user', content: 'Reply with one word: READY' }],
    { maxTokens: 20, temperature: 0 }
  );
  console.log('Provider:', r.provider);
  console.log('Model:', r.model);
  console.log('Attempts:', r.attempts);
  console.log('Latency:', r.durationMs + 'ms');
  console.log('Fallback used:', r.fallback);
  console.log('Response:', r.text.slice(0, 100));
})();
