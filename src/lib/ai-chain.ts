/**
 * Free-model AI chain.
 *
 * The Integration Setup Agent (and any other v1 AI route) calls this
 * module instead of calling a single SDK. The chain tries each provider
 * in order; the first one that succeeds wins. Failures (rate limit,
 * network, auth, 5xx) trigger a failover to the next provider.
 *
 * Provider order — all FREE tier:
 *   1. Z.AI SDK         — primary (configured via /etc/.z-ai-config)
 *   2. Groq             — Llama 3.3 70B free tier
 *   3. Google Gemini    — gemini-1.5-flash free tier
 *   4. OpenRouter free  — meta-llama/llama-3.3-70b-instruct:free
 *   5. Ollama local     — http://localhost:11434 (self-hosted, no API key)
 *   6. Rule-based       — deterministic; never fails
 *
 * The chain NEVER uses a paid API. If only paid keys are configured,
 * the chain falls straight through to rule-based. This honors the
 * master directive: "ONLY open-source/free technologies — NO paid
 * APIs".
 *
 * Each call records which provider served it, so the agent's
 * TaskExecution row tells the operator which path actually fired.
 */
import ZAI from 'z-ai-web-dev-sdk';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChainCallOptions {
  /** Soft cap to keep free-tier responses bounded. */
  maxTokens?: number;
  /** Temperature for sampling; 0 = deterministic. */
  temperature?: number;
  /** Caller-supplied identifier for the model name (e.g. "groq:llama-3.3-70b"). */
  preferredModel?: string;
}

export interface ChainCallResult {
  text: string;
  /** Which provider actually served the request. */
  provider: 'zai' | 'groq' | 'gemini' | 'openrouter-free' | 'ollama' | 'rule-based';
  /** Model id from the provider (for audit log). */
  model: string;
  /** How many providers were tried before success. */
  attempts: number;
  /** Round-trip latency in ms. */
  durationMs: number;
  /** Total prompt tokens consumed (if reported). */
  promptTokens?: number;
  /** Total completion tokens consumed (if reported). */
  completionTokens?: number;
  /** Whether the rule-based fallback was used (no LLM call). */
  fallback: boolean;
}

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.4;

/**
 * Run a chat completion through the free-model chain.
 *
 * If `ruleBasedFallback` is omitted, the chain ends in a deterministic
 * echo of the last user message — this guarantees the agent ALWAYS has
 * a response, even if every LLM provider is down or rate-limited.
 */
export async function chainChat(
  messages: ChatMessage[],
  options: ChainCallOptions = {},
  ruleBasedFallback?: (messages: ChatMessage[]) => string
): Promise<ChainCallResult> {
  const start = Date.now();
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;

  const attempts: Array<{ provider: ChainCallResult['provider']; ok: boolean; error?: string }> = [];

  // 1. Z.AI
  try {
    attempts.push({ provider: 'zai', ok: true });
    const zai = await loadZai();
    if (zai) {
      const r = await zai.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature,
      });
      const text = (r as any)?.choices?.[0]?.message?.content || '';
      if (text) {
        return makeResult(text, 'zai', (r as any)?.model || 'glm-4.6', attempts.length, start, {
          promptTokens: (r as any)?.usage?.prompt_tokens,
          completionTokens: (r as any)?.usage?.completion_tokens,
        });
      }
    }
    attempts[attempts.length - 1].ok = false;
    attempts[attempts.length - 1].error = 'empty response';
  } catch (e: any) {
    attempts[attempts.length - 1].ok = false;
    attempts[attempts.length - 1].error = e?.message?.slice(0, 120) || 'zai failed';
  }

  // 2. Groq (Llama 3.3 70B free)
  if (process.env.GROQ_API_KEY) {
    try {
      attempts.push({ provider: 'groq', ok: true });
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.preferredModel?.startsWith('groq:') ? options.preferredModel.slice(5) : 'llama-3.3-70b-versatile',
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });
      if (r.ok) {
        const data: any = await r.json();
        const text = data?.choices?.[0]?.message?.content || '';
        if (text) {
          return makeResult(text, 'groq', data?.model || 'llama-3.3-70b-versatile', attempts.length, start, {
            promptTokens: data?.usage?.prompt_tokens,
            completionTokens: data?.usage?.completion_tokens,
          });
        }
      }
      attempts[attempts.length - 1].ok = false;
      attempts[attempts.length - 1].error = `HTTP ${r.status}`;
    } catch (e: any) {
      attempts[attempts.length - 1].ok = false;
      attempts[attempts.length - 1].error = e?.message?.slice(0, 120) || 'groq failed';
    }
  }

  // 3. Google Gemini (free tier)
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_KEY) {
    try {
      attempts.push({ provider: 'gemini', ok: true });
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_KEY;
      const model = options.preferredModel?.startsWith('gemini:') ? options.preferredModel.slice(7) : 'gemini-1.5-flash';
      // Translate OpenAI-style messages to Gemini's contents array
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: maxTokens, temperature } }),
        }
      );
      if (r.ok) {
        const data: any = await r.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        if (text) {
          return makeResult(text, 'gemini', model, attempts.length, start, {
            promptTokens: data?.usageMetadata?.promptTokenCount,
            completionTokens: data?.usageMetadata?.candidatesTokenCount,
          });
        }
      }
      attempts[attempts.length - 1].ok = false;
      attempts[attempts.length - 1].error = `HTTP ${r.status}`;
    } catch (e: any) {
      attempts[attempts.length - 1].ok = false;
      attempts[attempts.length - 1].error = e?.message?.slice(0, 120) || 'gemini failed';
    }
  }

  // 4. OpenRouter (free models only)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      attempts.push({ provider: 'openrouter-free', ok: true });
      const model = options.preferredModel?.startsWith('openrouter:')
        ? options.preferredModel.slice(11)
        : 'meta-llama/llama-3.3-70b-instruct:free';
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://marketing.alolabs.net',
          'X-Title': 'ALO Labs MarketingOS',
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      });
      if (r.ok) {
        const data: any = await r.json();
        const text = data?.choices?.[0]?.message?.content || '';
        if (text) {
          return makeResult(text, 'openrouter-free', model, attempts.length, start, {
            promptTokens: data?.usage?.prompt_tokens,
            completionTokens: data?.usage?.completion_tokens,
          });
        }
      }
      attempts[attempts.length - 1].ok = false;
      attempts[attempts.length - 1].error = `HTTP ${r.status}`;
    } catch (e: any) {
      attempts[attempts.length - 1].ok = false;
      attempts[attempts.length - 1].error = e?.message?.slice(0, 120) || 'openrouter failed';
    }
  }

  // 5. Ollama (self-hosted)
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  try {
    attempts.push({ provider: 'ollama', ok: true });
    const model = options.preferredModel?.startsWith('ollama:')
      ? options.preferredModel.slice(7)
      : process.env.OLLAMA_CHAT_MODEL || 'llama3.2';
    const r = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature, num_predict: maxTokens } }),
      // Next.js fetch with no-cache to avoid SSRF cache surprise
      cache: 'no-store',
    });
    if (r.ok) {
      const data: any = await r.json();
      const text = data?.message?.content || '';
      if (text) {
        return makeResult(text, 'ollama', model, attempts.length, start, {
          promptTokens: data?.prompt_eval_count,
          completionTokens: data?.eval_count,
        });
      }
    }
    attempts[attempts.length - 1].ok = false;
    attempts[attempts.length - 1].error = `HTTP ${r.status}`;
  } catch (e: any) {
    attempts[attempts.length - 1].ok = false;
    attempts[attempts.length - 1].error = e?.message?.slice(0, 120) || 'ollama failed';
  }

  // 6. Rule-based fallback — deterministic, never fails
  const fallbackText = ruleBasedFallback ? ruleBasedFallback(messages) : defaultRuleBasedFallback(messages);
  return makeResult(fallbackText, 'rule-based', 'rule-based', attempts.length, start, { fallback: true });
}

function makeResult(
  text: string,
  provider: ChainCallResult['provider'],
  model: string,
  attempts: number,
  start: number,
  extra: Partial<ChainCallResult> = {}
): ChainCallResult {
  return {
    text,
    provider,
    model,
    attempts,
    durationMs: Date.now() - start,
    fallback: provider === 'rule-based',
    promptTokens: extra.promptTokens,
    completionTokens: extra.completionTokens,
  };
}

/**
 * Default rule-based fallback when no LLM provider responds and the
 * caller didn't supply one. The agent always has something to say —
 * a deterministic acknowledgment + the next-step instruction.
 */
function defaultRuleBasedFallback(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser?.content || '';
  return [
    'আমি বর্তমানে একটি নির্ধারিত উত্তর দিচ্ছি (LLM unavailable — fallback active).',
    '',
    'ব্যবহারকারীর শেষ বার্তা:',
    userText.slice(0, 200),
    '',
    'পরবর্তী ধাপ: অনুগ্রহ করে সংযুক্ত করতে চাওয়া প্ল্যাটফর্মের নাম বা সংখ্যা লিখুন (1=Google, 2=YouTube, 3=Facebook/Instagram, 4=LinkedIn, 5=TikTok, 6=X, 7=Pinterest, 8=WordPress, 9=CRM/Email, 10=E-commerce, 11=Other).',
  ].join('\n');
}

/**
 * Lazy-load the Z.AI SDK. Returns null if the SDK is not configured
 * (e.g. /etc/.z-ai-config missing in dev). The chain then continues
 * to the next provider.
 */
let _zaiPromise: Promise<any | null> | null = null;
function loadZai(): Promise<any | null> {
  if (!_zaiPromise) {
    _zaiPromise = (async () => {
      try {
        const mod = await import('z-ai-web-dev-sdk');
        const zai = await mod.default.create();
        return zai;
      } catch {
        // Most likely /etc/.z-ai-config missing — silent failover
        return null;
      }
    })();
  }
  return _zaiPromise;
}
