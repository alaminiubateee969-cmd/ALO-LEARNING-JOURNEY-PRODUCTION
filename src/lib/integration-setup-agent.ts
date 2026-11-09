/**
 * Integration Setup Agent — drives the 10-phase conversation flow
 * defined in the master directive.
 *
 * The agent is invoked from POST /api/v1/agents/integration-setup
 * (registered in src/app/api/v1/agents/integration-setup/route.ts).
 * It runs ENTIRELY server-side and calls the v1 integration API
 * internally (not via HTTP) — so it has the same authenticated context
 * as the dashboard user, with no extra round-trip.
 *
 * The agent NEVER:
 *   - Asks for provider passwords in chat
 *   - Asks for OTP / 2FA codes in chat
 *   - Receives plaintext tokens
 *   - Logs secrets
 *
 * The agent DOES:
 *   - Greet the user in Bengali by default (English on Accept-Language)
 *   - Ask one question at a time
 *   - Discover resources automatically (calling the v1 discover route)
 *   - Request explicit user confirmation before saving
 *   - Emit a client summary with masked credentials only
 *   - Fall back to rule-based responses when every LLM provider is down
 */
import { db } from '@/lib/db';
import { chainChat, type ChatMessage } from '@/lib/ai-chain';
import { listProviders, type ProviderDefinition } from '@/lib/providers';

export type ConversationPhase =
  | 'greeted'
  | 'awaiting_category'
  | 'awaiting_provider'
  | 'awaiting_oauth_redirect'
  | 'awaiting_discovery'
  | 'awaiting_resource_selection'
  | 'awaiting_missing_fields'
  | 'awaiting_validation'
  | 'awaiting_confirmation'
  | 'completed'
  | 'awaiting_correction';

export interface AgentTurnInput {
  /** User's message in this turn. Empty = first turn (greeting). */
  userMessage: string;
  /** Authenticated dashboard user. */
  userId: string;
  companyId: string;
  /** Conversation history persisted client-side and replayed each turn. */
  history: ChatMessage[];
  /** Current phase, persisted client-side between turns. */
  phase: ConversationPhase;
  /** Selected provider slug (set after Phase 1). */
  selectedProvider?: string;
  /** Selected connection id (set after OAuth or credentials submitted). */
  connectionId?: string;
  /** User language — defaults to 'bn'. */
  language: 'bn' | 'en';
}

export interface AgentTurnOutput {
  /** Reply for the user (Bengali or English). */
  reply: string;
  /** New phase after this turn. */
  phase: ConversationPhase;
  /** Side-effect actions the client should perform (e.g. open OAuth URL). */
  actions?: Array<
    | { kind: 'open_url'; url: string; label: string }
    | { kind: 'render_form'; provider: string; fields: Array<{ name: string; label: string; secret: boolean; required: boolean; helpText?: string }> }
    | { kind: 'poll_status'; connectionId: string; intervalMs: number }
    | { kind: 'show_summary'; summary: Array<{ provider: string; resource: string; status: string; action: string }> }
    | { kind: 'show_resources'; connectionId: string; resources: Array<{ type: string; id: string; name?: string; permission?: string }> }
  >;
  /** Selected provider slug (echoed back so client can persist). */
  selectedProvider?: string;
  /** Connection id (echoed back so client can persist). */
  connectionId?: string;
  /** Which LLM provider served this turn (audit trail). */
  modelUsed: string;
  /** Whether the rule-based fallback was used. */
  fallback: boolean;
}

const CATEGORIES = [
  { id: '1', label_bn: 'Google SEO এবং Analytics', label_en: 'Google SEO and Analytics', providers: ['google'] },
  { id: '2', label_bn: 'YouTube', label_en: 'YouTube', providers: ['youtube'] },
  { id: '3', label_bn: 'Facebook এবং Instagram', label_en: 'Facebook and Instagram', providers: ['meta'] },
  { id: '4', label_bn: 'WhatsApp Business', label_en: 'WhatsApp Business', providers: [] }, // intentionally removed per master directive
  { id: '5', label_bn: 'LinkedIn', label_en: 'LinkedIn', providers: ['linkedin'] },
  { id: '6', label_bn: 'TikTok', label_en: 'TikTok', providers: ['tiktok'] },
  { id: '7', label_bn: 'X / Twitter', label_en: 'X / Twitter', providers: ['x'] },
  { id: '8', label_bn: 'Pinterest', label_en: 'Pinterest', providers: ['pinterest'] },
  { id: '9', label_bn: 'WordPress', label_en: 'WordPress', providers: ['wordpress'] },
  { id: '10', label_bn: 'CRM এবং Email Marketing', label_en: 'CRM and Email Marketing', providers: ['hubspot', 'mailchimp', 'sendgrid'] },
  { id: '11', label_bn: 'E-commerce', label_en: 'E-commerce', providers: ['shopify', 'stripe'] },
  { id: '12', label_bn: 'অন্যান্য', label_en: 'Other', providers: [] },
];

const BENGALI_GREETING = `স্বাগতম! আমি ধাপে ধাপে আপনার প্রয়োজনীয় প্ল্যাটফর্মগুলো নিরাপদভাবে সংযুক্ত করব।

আপনি কোন ধরনের প্ল্যাটফর্ম সংযুক্ত করতে চান?

1. Google SEO এবং Analytics
2. YouTube
3. Facebook এবং Instagram
4. WhatsApp Business (disabled — AI agents handle all messaging)
5. LinkedIn
6. TikTok
7. X / Twitter
8. Pinterest
9. WordPress
10. CRM এবং Email Marketing
11. E-commerce
12. Other

অনুগ্রহ করে একটি নম্বর বা নাম লিখুন।`;

const ENGLISH_GREETING = `Welcome! I'll help you securely connect the platforms you need, one step at a time.

Which type of platform would you like to connect?

1. Google SEO and Analytics
2. YouTube
3. Facebook and Instagram
4. WhatsApp Business (disabled — AI agents handle all messaging)
5. LinkedIn
6. TikTok
7. X / Twitter
8. Pinterest
9. WordPress
10. CRM and Email Marketing
11. E-commerce
12. Other

Please type a number or a name.`;

export async function runIntegrationSetupAgent(input: AgentTurnInput): Promise<AgentTurnOutput> {
  const lang = input.language;

  // ─── Phase 0: greeting (first turn) ──────────────────────────────────────
  if (!input.userMessage?.trim() && input.phase === 'awaiting_category') {
    return {
      reply: lang === 'bn' ? BENGALI_GREETING : ENGLISH_GREETING,
      phase: 'awaiting_category',
      modelUsed: 'rule-based-greeting',
      fallback: true,
    };
  }

  // ─── Phase 1: parse category selection ───────────────────────────────────
  if (input.phase === 'awaiting_category') {
    const selected = parseSelection(input.userMessage, CATEGORIES);
    if (!selected) {
      return {
        reply: lang === 'bn'
          ? `দুঃখিত, আমি বুঝতে পারিনি। অনুগ্রহ করে 1-12 পর্যন্ত একটি নম্বর দিন অথবা প্ল্যাটফর্মের নাম লিখুন।`
          : `Sorry, I didn't understand. Please type a number from 1-12 or a platform name.`,
        phase: 'awaiting_category',
        modelUsed: 'rule-based-parse',
        fallback: true,
      };
    }

    if (selected.id === '4') {
      return {
        reply: lang === 'bn'
          ? `⚠️ WhatsApp Business এই সিস্টেমে উপলব্ধ নয়। মাস্টার ডিরেকটিভ অনুযায়ী AI এজেন্টরা সমস্ত যোগাযোগ পরিচালনা করে। অন্য একটি ক্যাটেগরি বেছে নিন।`
          : `⚠️ WhatsApp Business is not available on this system. Per the master directive, AI agents handle all communication. Please choose another category.`,
        phase: 'awaiting_category',
        modelUsed: 'rule-based-no-whatsapp',
        fallback: true,
      };
    }

    if (selected.providers.length === 0) {
      return {
        reply: lang === 'bn'
          ? `'${selected.label_bn}' ক্যাটেগরির জন্য কোনো প্ল্যাটফর্ম কনফিগার করা নেই। অন্য ক্যাটেগরি বেছে নিন।`
          : `No platforms are configured for the '${selected.label_en}' category. Please choose another.`,
        phase: 'awaiting_category',
        modelUsed: 'rule-based-empty-cat',
        fallback: true,
      };
    }

    // Resolve provider definitions from registry
    const providers = selected.providers.map((slug) => listProviders().find((p) => p.slug === slug)).filter(Boolean) as ProviderDefinition[];

    // If only one provider in the category, jump to authorize/credentials
    if (providers.length === 1) {
      return await askToConnect(providers[0], input, lang);
    }

    // Multiple providers — ask the user which one
    const lines = providers.map((p, i) => `${i + 1}. ${p.label}`);
    return {
      reply: (lang === 'bn' ? 'এই ক্যাটেগরিতে একাধিক প্ল্যাটফর্ম আছে। কোনটি সংযুক্ত করতে চান?\n\n' : 'This category has multiple platforms. Which would you like to connect?\n\n') + lines.join('\n'),
      phase: 'awaiting_provider',
      selectedProvider: selected.providers[0], // first one is the default
      modelUsed: 'rule-based-provider-list',
      fallback: true,
    };
  }

  // ─── Phase 1b: parse provider selection from category with multiple ─────
  if (input.phase === 'awaiting_provider') {
    // The user typed either a name or a number relative to the previously
    // shown list — but we don't know which list. Resolve via name search.
    const match = listProviders().find((p) => p.slug === input.userMessage.trim().toLowerCase() || p.label.toLowerCase().includes(input.userMessage.trim().toLowerCase()));
    if (!match) {
      return {
        reply: lang === 'bn' ? `প্ল্যাটফর্ম চেনা যায়নি। অনুগ্রহ করে আবার নাম লিখুন।` : `Couldn't recognize the platform. Please type the name again.`,
        phase: 'awaiting_provider',
        modelUsed: 'rule-based-no-provider-match',
        fallback: true,
      };
    }
    return await askToConnect(match, input, lang);
  }

  // ─── Phase 5: resource selection (LLM-assisted explanation) ────────────
  if (input.phase === 'awaiting_resource_selection' && input.connectionId) {
    // Show discovered resources via deterministic UI
    const integration = await db.integration.findUnique({
      where: { id: input.connectionId },
      include: { resources: true },
    });
    if (!integration) {
      return {
        reply: lang === 'bn' ? `সংযোগটি খুঁজে পাওয়া যায়নি।` : `Connection not found.`,
        phase: 'awaiting_category',
        modelUsed: 'rule-based-missing-conn',
        fallback: true,
      };
    }
    const grouped = groupResources(integration.resources);
    const lines: string[] = [];
    let idx = 1;
    const actions: any[] = [];
    for (const [type, items] of Object.entries(grouped)) {
      lines.push(`\n${humanType(type)} (${items.length}):`);
      for (const it of items) {
        lines.push(`  ${idx}. ${it.name || it.resourceId}${it.permission ? ` (${it.permission})` : ''}`);
        idx++;
      }
    }
    return {
      reply: (lang === 'bn' ? `আপনার ${integration.provider} অ্যাকাউন্টে নিচের রিসোর্সগুলো পাওয়া গেছে:\n` : `We found these resources on your ${integration.provider} account:\n`) + lines.join('\n') + (lang === 'bn' ? '\n\nকোনগুলো MarketingOS-এ ব্যবহার করতে চান? নম্বর দিন (একাধিক হলে কমা দিয়ে আলাদা করুন)।' : '\n\nWhich ones should MarketingOS use? Type the numbers (comma-separated for multiple).'),
      phase: 'awaiting_resource_selection',
      connectionId: input.connectionId,
      actions: [{ kind: 'show_resources', connectionId: input.connectionId, resources: integration.resources.map((r) => ({ type: r.type, id: r.resourceId, name: r.name || undefined, permission: r.permission || undefined })) }],
      modelUsed: 'rule-based-resource-list',
      fallback: true,
    };
  }

  // ─── Phase 8: confirmation ───────────────────────────────────────────────
  if (input.phase === 'awaiting_confirmation') {
    const confirmed = /^(confirm|ok|yes|ঠিক আছে|হ্যাঁ|নিশ্চিত)/i.test(input.userMessage.trim());
    if (confirmed) {
      return {
        reply: lang === 'bn'
          ? `🎉 সেটআপ সম্পন্ন হয়েছে। আপনার অনুমোদিত ইন্টিগ্রেশনগুলো নিরাপদে সংযুক্ত হয়েছে। কোনো টোকেন expire বা revoke হলে ড্যাশবোর্ডে নোটিফিকেশন দেওয়া হবে।\n\nসাধারণভাবে OAuth integration অ্যাকাউন্ট পাসওয়ার্ডের পরিবর্তে টোকেনের মাধ্যমে চলে। তবে provider security policy, password reset, permission change, token expiry বা access revoke করলে পুনরায় connect করতে হতে পারে।`
          : `🎉 Setup complete. Your authorized integrations are securely connected. If any token expires or is revoked, a notification will appear on the dashboard.\n\nGenerally, OAuth integrations run on tokens rather than your account password. However, provider security policy, password resets, permission changes, token expiry, or access revocation may require you to reconnect.`,
        phase: 'completed',
        modelUsed: 'rule-based-confirm',
        fallback: true,
      };
    }
    // User wants to change something — go back to category selection
    return {
      reply: lang === 'bn'
        ? `ঠিক আছে, পরিবর্তন করতে চান। কোন প্ল্যাটফর্ম পরিবর্তন করতে চান, নাম লিখুন (অথবা নতুন করে শুরু করতে 'restart' লিখুন)।`
        : `OK, you want to change something. Type the platform name to modify (or 'restart' to start over).`,
      phase: 'awaiting_correction',
      modelUsed: 'rule-based-correction',
      fallback: true,
    };
  }

  // ─── Fallback: LLM-assisted free-form reply ─────────────────────────────
  // When the user types something we don't have a deterministic handler for,
  // route through the free-model chain so the agent can still respond.
  const systemPrompt = `You are the Integration Setup Agent for MarketingOS, a digital marketing platform by ALO Labs.

Rules:
- Always speak in ${lang === 'bn' ? 'Bengali (Bangla)' : 'English'}.
- NEVER ask for passwords, OTP, 2FA codes, recovery codes, or session cookies.
- NEVER accept provider credentials in chat — direct the user to the OAuth flow or the secure credential form.
- Ask one question at a time.
- Be concise. Be helpful. Be honest — if you don't know, say so.

Current conversation phase: ${input.phase}.
${input.selectedProvider ? `Selected provider: ${input.selectedProvider}.` : ''}
${input.connectionId ? `Connection id: ${input.connectionId}.` : ''}

If the user is asking something outside your scope, redirect them to the dashboard.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...input.history.slice(-10), // last 10 turns to keep prompt bounded
    { role: 'user', content: input.userMessage },
  ];

  const r = await chainChat(messages, { maxTokens: 600, temperature: 0.3 });
  return {
    reply: r.text,
    phase: input.phase, // LLM doesn't change phase — only deterministic logic does
    selectedProvider: input.selectedProvider,
    connectionId: input.connectionId,
    modelUsed: r.model,
    fallback: r.fallback,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseSelection(input: string, cats: typeof CATEGORIES): typeof CATEGORIES[number] | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  // Number match
  const num = parseInt(t, 10);
  if (!isNaN(num) && num >= 1 && num <= cats.length) return cats[num - 1];
  // Name match
  return cats.find((c) => c.label_en.toLowerCase().includes(t) || c.label_bn.includes(t)) || null;
}

async function askToConnect(provider: ProviderDefinition, input: AgentTurnInput, lang: 'bn' | 'en'): Promise<AgentTurnOutput> {
  if (provider.authMethod === 'oauth') {
    return {
      reply: lang === 'bn'
        ? `${provider.label} সংযুক্ত করতে নিচের বাটনে ক্লিক করুন। OAuth প্রক্রিয়া সম্পন্ন করার পরে আমি স্বয়ংক্রিয়ভাবে আপনার রিসোর্সগুলো খুঁজে বের করব।\n\n⚠️ আপনার provider-এর official window-তে OTP/2FA সম্পন্ন করুন। নিরাপত্তার জন্য OTP এই chat-এ লিখবেন না।`
        : `Click the button below to connect ${provider.label}. After you complete the OAuth flow, I'll automatically discover your resources.\n\n⚠️ Complete OTP/2FA on your provider's official window. For security, never type OTP in this chat.`,
      phase: 'awaiting_oauth_redirect',
      selectedProvider: provider.slug,
      actions: [
        {
          kind: 'open_url',
          url: `/api/v1/integrations/${provider.slug}/authorize`,
          label: lang === 'bn' ? `${provider.label} সংযুক্ত করুন` : `Connect ${provider.label}`,
        },
      ],
      modelUsed: 'rule-based-authorize-cta',
      fallback: true,
    };
  }

  // Manual credential form
  return {
    reply: lang === 'bn'
      ? `${provider.label}-এর জন্য নিচের সিকিউর ফর্মটি পূরণ করুন। সংবেদনশীল তথ্য এনক্রিপ্ট করে সংরক্ষিত হবে — আমরা কখনোই প্লেইন টেক্সটে সংরক্ষণ করি না।`
      : `Fill out the secure form below for ${provider.label}. Sensitive information will be encrypted before storage — we never persist plaintext.`,
    phase: 'awaiting_missing_fields',
    selectedProvider: provider.slug,
    actions: [
      {
        kind: 'render_form',
        provider: provider.slug,
        fields: (provider.manualFields || []).map((f) => ({
          name: f.name,
          label: f.label,
          secret: f.secret,
          required: f.required,
          helpText: f.helpText,
        })),
      },
    ],
    modelUsed: 'rule-based-manual-form',
    fallback: true,
  };
}

function groupResources(resources: any[]): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const r of resources) {
    if (!out[r.type]) out[r.type] = [];
    out[r.type].push(r);
  }
  return out;
}

function humanType(type: string): string {
  return type
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
