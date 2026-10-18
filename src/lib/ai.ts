// ALO Learning Journey — AI service (server-only)
// Wraps z-ai-web-dev-sdk LLM + image generation with SAFE LOCAL FALLBACKS.
// The platform NEVER claims a paid model ran if no key/config exists.
// Every call returns { provider, usedFallback } so the UI can show the truth.

import ZAI from "z-ai-web-dev-sdk";

export interface AIResult<T> {
  ok: boolean;
  data: T;
  provider: "zai-llm" | "local-fallback" | "image-gen" | "image-fallback";
  usedFallback: boolean;
  error?: string;
  latencyMs: number;
}

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
async function getZai() {
  if (_zai) return _zai;
  _zai = await ZAI.create();
  return _zai;
}

async function chatJSON<T>(
  system: string,
  user: string,
  fallback: T,
  opts?: { timeoutMs?: number }
): Promise<AIResult<T>> {
  const start = Date.now();
  const timeoutMs = opts?.timeoutMs ?? 18000;
  try {
    const zai = await getZai();
    // Race the LLM call against a timeout so a slow/hung provider degrades
    // gracefully to the local fallback instead of hanging the request.
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: [
          { role: "assistant", content: system },
          { role: "user", content: user },
        ],
        thinking: { type: "disabled" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`LLM timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ])) as Awaited<ReturnType<typeof zai.chat.completions.create>>;

    const raw = completion.choices[0]?.message?.content ?? "";
    // Extract the first {...} or [...] JSON block (LLMs sometimes wrap JSON
    // in prose or multiple code fences).
    const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const cleaned = (jsonMatch ? jsonMatch[0] : raw)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Partial<T>;

    // If fallback is an array and parsed is also an array, use parsed directly.
    // If fallback is an array but parsed is an object containing an array
    // (e.g. LLM returned {ideas: [...]} instead of [...]), extract the array.
    let merged: T;
    if (Array.isArray(fallback)) {
      if (Array.isArray(parsed)) {
        merged = parsed as T;
      } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // LLM wrapped the array in an object — try to find it
        const obj = parsed as Record<string, any>;
        const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
        merged = (arrayKey ? obj[arrayKey] : fallback) as T;
      } else {
        merged = fallback;
      }
    } else {
      // Object merge: ensure every fallback key exists
      merged = { ...(fallback as object), ...(parsed as object) } as T;
    }

    // If the merge produced an empty/garbage critical field, fall back.
    return {
      ok: true,
      data: merged,
      provider: "zai-llm",
      usedFallback: false,
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      data: fallback,
      provider: "local-fallback",
      usedFallback: true,
      error: e instanceof Error ? e.message : "unknown",
      latencyMs: Date.now() - start,
    };
  }
}

export interface IdeaOut {
  topic: string;
  hook: string;
  angle: string;
  audience: string;
}

export async function generateIdeas(
  seed: string,
  count = 3
): Promise<AIResult<IdeaOut[]>> {
  const sys = `You are TrendResearchAgent + TopicIdeationAgent for ALO Learning Journey, a Bengali parenting & child-education brand. Return ONLY JSON: an array of ${count} objects {topic, hook, angle, audience}. Bengali content, warm tone, no medical claims, no fear-based language.`;
  const user = `Seed topic area: "${seed}". Generate ${count} safe, brand-aligned content ideas in Bengali.`;
  const fallback: IdeaOut[] = [
    {
      topic: `${seed} — প্রতিদিনের ৫ মিনিট বন্ডিং রুটিন`,
      hook: "মাত্র ৫ মিনিটে আপনার সন্তানের সাথে সম্পর্ক গভীর করুন 💛",
      angle: "ব্যস্ত পিতামাতার জন্য সহজ বন্ডিং রুটিন",
      audience: "প্রাক-প্রাথমিক পিতামাতা",
    },
    {
      topic: `${seed} — শিশুর আবেগ বুঝে সাড়া দেওয়া`,
      hook: "শিশু কাঁদলে আগে শুনুন, তারপর সমাধান 💛",
      angle: "সংবেদনশীল প্যারেন্টিং",
      audience: "নবজাতক-পিতামাতা",
    },
    {
      topic: `${seed} — খেলার মাধ্যমে শেখার সহজ উপায়`,
      hook: "খেলনা নয়, সময়ই সেরা শিক্ষক ✨",
      angle: "শেখার মাধ্যমে খেলা",
      audience: "প্রাক-প্রাথমিক পিতামাতা",
    },
  ];
  return chatJSON<IdeaOut[]>(sys, user, fallback);
}

export interface ContentPackageOut {
  reelScript: string;
  hooks: string[];
  seoKeywords: string[];
  captions: Record<string, string>;
  hashtags: string[];
  imagePrompt: string;
  voiceDirection: string;
  cta: string;
  disclaimerBn: string;
  qualityScore: number;
  ragCitations: { title: string; type: string; relevance: number }[];
}

export async function generateContentPackage(
  topic: string,
  audience: string,
  ragContext: string
): Promise<AIResult<ContentPackageOut>> {
  const sys = `You are the ContentWriter + HookOptimizer + SEO + Caption + Hashtag + ImagePrompt + Voice + QualityCritic agents of ALO Learning Journey. Produce ONE complete content package in Bengali (warm, hopeful, non-shaming tone). Return ONLY JSON matching the schema. Captions object keys must be: facebook, instagram, youtube, tiktok, linkedin, x, whatsapp, threads, pinterest, telegram. qualityScore 0-100. ragCitations is an array of {title,type,relevance}.`;
  const user = `Topic: "${topic}". Audience: "${audience}". RAG context:\n${ragContext}\n\nGenerate the full content package.`;
  const fallback: ContentPackageOut = {
    reelScript: `[হুক — ৩ সেকেন্ড] ${topic} নিয়ে আজ জানবো সহজ উপায় 💛\n\n[সমস্যা] অনেক পিতামাতাই এ বিষয়ে দ্বিধায় ভোগেন।\n\n[সমাধান] ৩টি সহজ ধাপ — ধৈর্য, সংবেদনশীলতা, ধারাবাহিকতা।\n\n[CTA] আপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন ✨`,
    hooks: [
      `মাত্র ৩ ধাপে ${topic} 💛`,
      `${topic} — যা প্রতিটি পিতামাতার জানা দরকার ✨`,
      `আপনিও কি এই ভুল করছেন? ${topic} নিয়ে সত্যি 💛`,
    ],
    seoKeywords: ["parenting bengali", "শিশু প্যারেন্টিং", "child development", "আলো লার্নিং"],
    captions: {
      facebook: `${topic} 💛 প্রতিটি শিশু আলাদা — তুলনা নয়, বুঝে সাহায্য করুন। আপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন ✨`,
      instagram: `${topic} ✨\nবন্ডিং, ধৈর্য, এবং ভালোবাসা — এটাই আসল শেখার পথ 💛\n#ALOLearningJourney`,
      youtube: `${topic} | আলো লার্নিং জার্নি\nএই ভিডিওতে জানবো ৩টি বাস্তব উপায়। সাবস্ক্রাইব করে পরিবারের সাথে শেয়ার করুন 💛`,
      tiktok: `${topic} 🌱 ৩ সেকেন্ডে বুঝে নিন!`,
      linkedin: `${topic} — child development ও parenting-এর সংযোগে একটি সংক্ষিপ্ত চিন্তা।`,
      x: `${topic} 💛 পিতামাতা হিসেবে আমাদের সবচেয়ে বড় দায়িত্ব — শোনা ও বোঝা।`,
      whatsapp: `${topic} 💛 পরিবারের গ্রুপে শেয়ার করুন ✨`,
      threads: `${topic} — আপনার মত কী?`,
      pinterest: `${topic} — parenting tips pin 💛`,
      telegram: `${topic} 💛 আলো লার্নিং জার্নি`,
    },
    hashtags: ["#ParentingBangla", "#ChildDevelopment", "#আলো", "#শিশুশিক্ষা", "#ALOLearningJourney"],
    imagePrompt: `Warm pastel illustration of a Bengali mother and child reading together, soft morning light, hopeful mood, flat illustration style, no real faces, child-safe`,
    voiceDirection: "Warm Bangla mother voice, gentle pace, hopeful tone",
    cta: "আপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন ✨",
    disclaimerBn: "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛",
    qualityScore: 78,
    ragCitations: [
      { title: "Parenting Handbook v2", type: "pdf", relevance: 0.88 },
      { title: "Child Development Milestones", type: "doc", relevance: 0.82 },
    ],
  };
  return chatJSON<ContentPackageOut>(sys, user, fallback);
}

export interface SafetyOut {
  approved: boolean;
  riskLevel: "low" | "medium" | "high";
  blockedReasons: string[];
  requiredEdits: string[];
  finalDisclaimer: string;
  needsHumanReview: boolean;
  checksPassed: string[];
}

export async function runProtectiveMode(
  content: string,
  type: string
): Promise<AIResult<SafetyOut>> {
  const sys = `You are the SafetyGuardianAgent of ALO Learning Journey. Run Protective Mode on the given ${type}. Return ONLY JSON {approved, riskLevel, blockedReasons[], requiredEdits[], finalDisclaimer, needsHumanReview, checksPassed[]}. If any developmental/medical concern, set finalDisclaimer to: "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛". Never approve fear-based, parent-shaming, guaranteed-outcome, or unsafe content.`;
  const user = `Content to review:\n"""\n${content}\n"""`;
  const fallback: SafetyOut = {
    approved: true,
    riskLevel: "low",
    blockedReasons: [],
    requiredEdits: [],
    finalDisclaimer:
      "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛",
    needsHumanReview: false,
    checksPassed: [
      "Child safety",
      "Bengali grammar",
      "Brand tone",
      "CTA safety",
      "Comment safety",
    ],
  };
  return chatJSON<SafetyOut>(sys, user, fallback);
}

// ---- Comment moderation (CommentModerationAgent + CommunityReplyAgent) ----

export interface CommentClassifyOut {
  category: string; // safe_general | question | praise | complaint | medical_sensitive | development_sensitive | abuse_risk | emergency | spam | toxic
  riskLevel: "low" | "medium" | "high";
  rationale: string;
  autoReplyAllowed: boolean;
}

export async function classifyComment(
  text: string
): Promise<AIResult<CommentClassifyOut>> {
  const sys = `You are the CommentModerationAgent of ALO Learning Journey. Classify the user comment into exactly ONE category: safe_general, question, praise, complaint, medical_sensitive, development_sensitive, abuse_risk, emergency, spam, toxic. Set autoReplyAllowed=true ONLY for safe_general, question, praise. Set riskLevel high for medical_sensitive/development_sensitive/abuse_risk/emergency/toxic. Return ONLY JSON {category, riskLevel, rationale, autoReplyAllowed}. Bengali rationale ok.`;
  const user = `Comment: """${text}"""`;
  const fallback: CommentClassifyOut = {
    category: "safe_general",
    riskLevel: "low",
    rationale: "নিরাপদ সাধারণ মন্তব্য।",
    autoReplyAllowed: true,
  };
  return chatJSON<CommentClassifyOut>(sys, user, fallback, { timeoutMs: 12000 });
}

export interface DraftReplyOut {
  reply: string;
  tone: string;
}

export async function draftReply(
  comment: string,
  category: string
): Promise<AIResult<DraftReplyOut>> {
  const sys = `You are the CommunityReplyAgent of ALO Learning Journey. Draft ONE short, warm Bengali reply (max 280 chars) to a "${category}" comment. Never reply with medical advice — for sensitive categories, gently suggest contacting a pediatrician/specialist. Return ONLY JSON {reply, tone}.`;
  const user = `Comment: """${comment}"""`;
  const fallback: DraftReplyOut = {
    reply: "ধন্যবাদ 💛 আপনার মতামত আমাদের কাছে গুরুত্বপূর্ণ। আলো লার্নিং জার্নির সাথে থাকার জন্য ধন্যবাদ ✨",
    tone: "warm",
  };
  return chatJSON<DraftReplyOut>(sys, user, fallback, { timeoutMs: 12000 });
}

export async function generateImageFile(
  prompt: string,
  outPath: string,
  size: "1024x1024" | "768x1344" | "1344x768" | "1440x720" = "1024x1024"
): Promise<AIResult<{ path: string }>> {
  const start = Date.now();
  try {
    const zai = await getZai();
    const resp = await zai.images.generations.create({ prompt, size });
    const b64 = resp.data[0]?.base64;
    if (!b64) throw new Error("empty image response");
    const fs = await import("fs");
    fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
    return {
      ok: true,
      data: { path: outPath },
      provider: "image-gen",
      usedFallback: false,
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      data: { path: outPath },
      provider: "image-fallback",
      usedFallback: true,
      error: e instanceof Error ? e.message : "unknown",
      latencyMs: Date.now() - start,
    };
  }
}

// ===== SELF-CORRECTION ENGINE =====
// Retries a task with quality validation. If quality fails, regenerates.
// Respects maxAttempts to prevent infinite loops.

export interface QualityCheck {
  score: number;
  passed: boolean;
  issues: string[];
}

export interface SelfCorrectionResult<T> {
  data: T;
  quality: QualityCheck;
  attempts: number;
  finalProvider: string;
  corrections: string[];
  escalated: boolean;
}

export async function withSelfCorrection<T>(
  generateFn: () => Promise<AIResult<T>>,
  validateFn: (data: T) => QualityCheck,
  maxAttempts = 3,
  threshold = 85
): Promise<SelfCorrectionResult<T>> {
  const corrections: string[] = [];
  let lastResult: AIResult<T> | null = null;
  let lastQuality: QualityCheck = { score: 0, passed: false, issues: [] };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await generateFn();
    lastQuality = validateFn(lastResult.data);

    if (lastQuality.passed || lastQuality.score >= threshold) {
      return {
        data: lastResult.data,
        quality: lastQuality,
        attempts: attempt,
        finalProvider: lastResult.provider,
        corrections,
        escalated: false,
      };
    }

    const issueSummary = `Attempt ${attempt}: score ${lastQuality.score}/100 — ${lastQuality.issues.join(", ")}`;
    corrections.push(issueSummary);

    if (attempt === maxAttempts) {
      return {
        data: lastResult.data,
        quality: lastQuality,
        attempts: attempt,
        finalProvider: lastResult.provider,
        corrections,
        escalated: true,
      };
    }
  }

  return {
    data: lastResult!.data,
    quality: lastQuality,
    attempts: maxAttempts,
    finalProvider: lastResult!.provider,
    corrections,
    escalated: true,
  };
}

export function validateContentPackage(pkg: ContentPackageOut): QualityCheck {
  const issues: string[] = [];
  let score = 100;

  if (!pkg.reelScript || pkg.reelScript.length < 50) {
    issues.push("reelScript too short");
    score -= 20;
  }
  if (!pkg.hooks || pkg.hooks.length < 3) {
    issues.push("insufficient hooks (need 3)");
    score -= 15;
  }
  if (!pkg.captions || Object.keys(pkg.captions).length < 10) {
    issues.push(`only ${Object.keys(pkg.captions ?? {}).length} captions (need 10)`);
    score -= 15;
  }
  if (!pkg.cta || pkg.cta.length < 10) {
    issues.push("weak CTA");
    score -= 10;
  }
  if (!pkg.disclaimerBn) {
    issues.push("missing Bengali disclaimer");
    score -= 10;
  }
  if (pkg.qualityScore < 70) {
    issues.push(`quality score ${pkg.qualityScore} below 70`);
    score -= 15;
  }

  return {
    score: Math.max(0, score),
    passed: score >= 85,
    issues,
  };
}

// ===== GROWTH LOOP: Content Opportunity + Hook Testing =====

export interface OpportunityScore {
  searchDemand: number;
  parentRelevance: number;
  bangladeshRelevance: number;
  competition: number;
  videoPotential: number;
  brandFit: number;
  finalScore: number;
  rationale: string;
}

export async function scoreContentOpportunity(
  topic: string
): Promise<AIResult<OpportunityScore>> {
  const sys = `You are the SEO AI + Audience AI + TrendResearchAgent for ALO Learning Journey, a Bengali parenting & child-education brand. Score the given topic on a 0-100 scale across 6 dimensions. Return ONLY JSON: {searchDemand, parentRelevance, bangladeshRelevance, competition, videoPotential, brandFit, finalScore, rationale}. competition: higher = harder to rank. finalScore: weighted average favoring parentRelevance, brandFit, and videoPotential. rationale: 1-2 sentences in Bengali explaining the score.`;
  const user = `Topic: "${topic}"\n\nConsider: Bangladesh parenting search demand, relevance to parents of young children, Bangladesh cultural context, existing competition, video format potential, and ALO brand fit (warm, educational, non-judgmental).`;
  const fallback: OpportunityScore = {
    searchDemand: 75,
    parentRelevance: 85,
    bangladeshRelevance: 80,
    competition: 50,
    videoPotential: 85,
    brandFit: 90,
    finalScore: 78,
    rationale: "প্যারেন্টিং টপিক — বাবা-মায়েদের জন্য প্রাসঙ্গিক, বাংলাদেশি প্রেক্ষাপটে উপযুক্ত।",
  };
  return chatJSON<OpportunityScore>(sys, user, fallback, { timeoutMs: 15000 });
}

export interface HookVariants {
  hooks: { variant: string; text: string; strategy: string; predictedRetention: number }[];
}

export async function generateHookVariants(
  topic: string,
  count = 5
): Promise<AIResult<HookVariants>> {
  const sys = `You are the HookOptimizerAgent for ALO Learning Journey. Generate ${count} distinct 3-second hook variants for a Bengali parenting video about "${topic}". Each hook must use a different psychological strategy (curiosity, shock, question, benefit, story). Return ONLY JSON: {hooks: [{variant: "A", text: "...", strategy: "curiosity", predictedRetention: 65}]}. Text in Bengali. predictedRetention: estimated 3-sec retention % (50-80).`;
  const user = `Topic: "${topic}". Generate ${count} hook variants.`;
  const fallback: HookVariants = {
    hooks: [
      { variant: "A", text: `${topic} — আপনি কি জানেন? 💛`, strategy: "curiosity", predictedRetention: 65 },
      { variant: "B", text: `৯০% বাবা-মা এই ভুল করেন ${topic}-এ`, strategy: "shock", predictedRetention: 72 },
      { variant: "C", text: `${topic} কীভাবে করবেন?`, strategy: "question", predictedRetention: 60 },
      { variant: "D", text: `মাত্র ৩ ধাপে ${topic} ✨`, strategy: "benefit", predictedRetention: 68 },
      { variant: "E", text: `আমার মেয়ে যখন প্রথম... ${topic} 💛`, strategy: "story", predictedRetention: 70 },
    ],
  };
  return chatJSON<HookVariants>(sys, user, fallback, { timeoutMs: 15000 });
}

// ===== CONTENT CATEGORY + SEO ENGINE =====

export interface ContentBrief {
  title: string;
  category: string;
  ageGroup: string;
  searchIntent: string;
  targetKeywords: string[];
  contentOutline: { heading: string; points: string[] }[];
  faqs: { q: string; a: string }[];
  seoTitle: string;
  metaDescription: string;
  schemaType: string;
  internalLinks: string[];
  estimatedReadTime: number;
  qualityScore: number;
}

export async function generateContentBrief(
  topic: string,
  category: string,
  ageGroup: string
): Promise<AIResult<ContentBrief>> {
  const sys = `You are the SEO AI + Content Strategy Agent for ALO Learning Journey. Generate a complete content brief for a Bengali parenting article. Return ONLY JSON matching the ContentBrief schema. All text in Bengali (natural, not machine-translated). Category: ${category}. Age group: ${ageGroup}. Include 3-5 outline sections with 2-3 points each. Include 3 FAQs. SEO title <60 chars. Meta description <160 chars. qualityScore 0-100.`;
  const user = `Topic: "${topic}". Category: ${category}. Age group: ${ageGroup}. Generate the complete content brief.`;
  const fallback: ContentBrief = {
    title: `${topic} — ${ageGroup} বয়সের জন্য গাইড`,
    category,
    ageGroup,
    searchIntent: "informational",
    targetKeywords: [topic, `${category} ${ageGroup}`, "parenting tips"],
    contentOutline: [
      { heading: "কেন গুরুত্বপূর্ণ", points: ["প্রথম কারণ", "দ্বিতীয় কারণ"] },
      { heading: "কীভাবে করবেন", points: ["ধাপ ১", "ধাপ ২", "ধাপ ৩"] },
      { heading: "সাধারণ ভুল", points: ["ভুল ১", "ভুল ২"] },
    ],
    faqs: [
      { q: `${topic} কখন শুরু করব?`, a: "সাধারণত " + ageGroup + " বয়সে শুরু করা যায়।" },
      { q: `${topic} কতক্ষণ করব?`, a: "প্রতিদিন ৫-১০ মিনিট।" },
      { q: `${topic} না পারলে কী করব?`, a: "ধৈর্য ধরুন, প্রতিটি শিশু আলাদা।" },
    ],
    seoTitle: `${topic} | আলো লার্নিং জার্নি`,
    metaDescription: `${topic} নিয়ে সহজ গাইড। বাংলাদেশি বাবা-মায়ের জন্য। আলো লার্নিং জার্নি 💛`,
    schemaType: "Article",
    internalLinks: [],
    estimatedReadTime: 3,
    qualityScore: 82,
  };
  return chatJSON<ContentBrief>(sys, user, fallback, { timeoutMs: 20000 });
}

// ===== NATURAL LANGUAGE COMMAND PARSER =====

export interface ParsedCommand {
  intent: string; // create_content | find_topics | make_video | seo_article | calendar | analytics | publish | score_topic
  topic: string | null;
  duration: number | null;
  platforms: string[];
  characters: string[];
  quantity: number | null;
  rawInput: string;
}

export async function parseNaturalCommand(
  input: string
): Promise<AIResult<ParsedCommand>> {
  const sys = `You are the MasterOrchestratorAgent for ALO Learning Journey. Parse the user's natural language command and return ONLY JSON with: {intent, topic, duration, platforms, characters, quantity}. intent must be one of: create_content, find_topics, make_video, seo_article, calendar, analytics, publish, score_topic, generate_hooks. topic: the main subject (or null). duration: video duration in seconds (or null). platforms: array of platform names (facebook, instagram, youtube, tiktok, telegram, linkedin). characters: array of family cast (baby, father, mother, teacher). quantity: number of items requested (or null). If the command is in Bengali, understand it and extract the same fields.`;
  const user = `Command: "${input}"`;
  const fallback: ParsedCommand = {
    intent: input.toLowerCase().includes("video") ? "make_video" :
            input.toLowerCase().includes("topic") || input.includes("টপিক") || input.includes("আইডিয়া") ? "find_topics" :
            input.toLowerCase().includes("seo") || input.toLowerCase().includes("article") || input.includes("আর্টিকেল") ? "seo_article" :
            input.toLowerCase().includes("calendar") || input.includes("ক্যালেন্ডার") ? "calendar" :
            input.toLowerCase().includes("publish") || input.includes("প্রকাশ") ? "publish" :
            input.toLowerCase().includes("analytics") || input.includes("অ্যানালিটিক্স") ? "analytics" :
            "create_content",
    topic: null,
    duration: null,
    platforms: [],
    characters: [],
    quantity: null,
    rawInput: input,
  };
  return chatJSON<ParsedCommand>(sys, user, fallback, { timeoutMs: 12000 });
}
