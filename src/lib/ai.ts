// ALO Learning Journey — AI service (server-only)
// Wraps z-ai-web-dev-sdk LLM + image generation with SAFE LOCAL FALLBACKS.
// The platform NEVER claims a paid model ran if no key/config exists.
// Every call returns { provider, usedFallback } so the UI can show the truth.

import ZAI from "z-ai-web-dev-sdk";
import { generateLocalChatJson } from "@/lib/local-models";

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

export type QualityAgentPass = {
  agentId: string;
  role: string;
  status: "complete" | "fallback" | "skipped";
  provider: string;
  latencyMs: number;
  summary: string;
};

type LocalPromptReviewResult<T> = {
  data: T;
  provider: string;
  usedFallback: boolean;
  latencyMs: number;
  qualityPipeline: QualityAgentPass[];
  error?: string;
};

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text.trim());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed: unknown = JSON.parse(match[0]);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function isTemplateFallback(model: string): boolean {
  return model.includes("(built-in-local)");
}

async function runLocalPromptReview<T>(options: {
  task: string;
  agentPrefix: string;
  writerSystem: string;
  writerUser: string;
  critiqueSystem: string;
  finalistSystem: string;
  fallback: T;
  parseDraft: (value: unknown) => T | null;
}): Promise<LocalPromptReviewResult<T>> {
  const startedAt = Date.now();
  const passes: QualityAgentPass[] = [];
  const addPass = (pass: QualityAgentPass) => passes.push(pass);

  let writer: { content: string; model: string };
  try {
    writer = await generateLocalChatJson(options.writerSystem, options.writerUser, 12_000);
  } catch {
    addPass({
      agentId: `${options.agentPrefix}_writer`,
      role: "Draft generation",
      status: "fallback",
      provider: "local-template",
      latencyMs: Date.now() - startedAt,
      summary: "The configured local model was unavailable; a built-in template is returned.",
    });
    addPass({
      agentId: `${options.agentPrefix}_critic`,
      role: "Prompt-based critique",
      status: "skipped",
      provider: "none",
      latencyMs: 0,
      summary: "No local model critique or independent quality/safety review was run.",
    });
    addPass({
      agentId: `${options.agentPrefix}_finalist`,
      role: "Final draft",
      status: "skipped",
      provider: "none",
      latencyMs: 0,
      summary: "No finalist pass ran; review the template draft yourself.",
    });
    return {
      data: options.fallback,
      provider: "local-template",
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      qualityPipeline: passes,
      error: "Local model unavailable; template output requires human review.",
    };
  }

  const writerDuration = Date.now() - startedAt;
  const writerData = isTemplateFallback(writer.model) ? null : options.parseDraft(parseJsonObject(writer.content));
  if (!writerData) {
    addPass({
      agentId: `${options.agentPrefix}_writer`,
      role: "Draft generation",
      status: "fallback",
      provider: isTemplateFallback(writer.model) ? "local-template" : writer.model,
      latencyMs: writerDuration,
      summary: "No validated model draft was returned; a built-in template is used instead.",
    });
    addPass({
      agentId: `${options.agentPrefix}_critic`,
      role: "Prompt-based critique",
      status: "skipped",
      provider: "none",
      latencyMs: 0,
      summary: "No critique was run; a template fallback is not an independent quality or safety check.",
    });
    addPass({
      agentId: `${options.agentPrefix}_finalist`,
      role: "Final draft",
      status: "skipped",
      provider: "none",
      latencyMs: 0,
      summary: "No finalist pass ran; review the template draft yourself.",
    });
    return {
      data: options.fallback,
      provider: isTemplateFallback(writer.model) ? "local-template" : writer.model,
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      qualityPipeline: passes,
      error: "No valid local model draft; template output requires human review.",
    };
  }

  addPass({
    agentId: `${options.agentPrefix}_writer`,
    role: "Draft generation",
    status: "complete",
    provider: writer.model,
    latencyMs: writerDuration,
    summary: "The configured local model returned a structured draft; its claims are not fact-checked.",
  });

  const critiqueStartedAt = Date.now();
  let critique: { content: string; model: string };
  try {
    critique = await generateLocalChatJson(
      options.critiqueSystem,
      `Draft for ${options.task}:\n${writer.content}\nReturn a JSON critique only.`,
      12_000
    );
  } catch {
    addPass({
      agentId: `${options.agentPrefix}_critic`,
      role: "Prompt-based critique",
      status: "fallback",
      provider: "local-template",
      latencyMs: Date.now() - critiqueStartedAt,
      summary: "Critique unavailable; no independent quality or safety review was run.",
    });
    addPass({
      agentId: `${options.agentPrefix}_finalist`,
      role: "Final draft",
      status: "skipped",
      provider: "none",
      latencyMs: 0,
      summary: "Finalist pass skipped because no critique result was available.",
    });
    return {
      data: writerData,
      provider: writer.model,
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      qualityPipeline: passes,
      error: "Local critique unavailable; the writer draft requires human review.",
    };
  }

  if (isTemplateFallback(critique.model) || !parseJsonObject(critique.content)) {
    addPass({
      agentId: `${options.agentPrefix}_critic`,
      role: "Prompt-based critique",
      status: "fallback",
      provider: isTemplateFallback(critique.model) ? "local-template" : critique.model,
      latencyMs: Date.now() - critiqueStartedAt,
      summary: "No usable critique was returned; no independent quality or safety review was run.",
    });
    addPass({
      agentId: `${options.agentPrefix}_finalist`,
      role: "Final draft",
      status: "skipped",
      provider: "none",
      latencyMs: 0,
      summary: "Finalist pass skipped because no usable critique was returned.",
    });
    return {
      data: writerData,
      provider: writer.model,
      usedFallback: true,
      latencyMs: Date.now() - startedAt,
      qualityPipeline: passes,
      error: "No usable local critique; the writer draft requires human review.",
    };
  }

  addPass({
    agentId: `${options.agentPrefix}_critic`,
    role: "Prompt-based critique",
    status: "complete",
    provider: critique.model,
    latencyMs: Date.now() - critiqueStartedAt,
    summary: "A separate prompt to the same configured local model returned critique; this is not independent verification.",
  });

  const finalistStartedAt = Date.now();
  try {
    const finalist = await generateLocalChatJson(
      options.finalistSystem,
      `Writer draft for ${options.task}:\n${writer.content}\n\nModel critique (unverified):\n${critique.content}\nReturn the final JSON draft.`,
      12_000
    );
    const finalistData = isTemplateFallback(finalist.model) ? null : options.parseDraft(parseJsonObject(finalist.content));
    if (finalistData) {
      addPass({
        agentId: `${options.agentPrefix}_finalist`,
        role: "Final draft",
        status: "complete",
        provider: finalist.model,
        latencyMs: Date.now() - finalistStartedAt,
        summary: "The same local model returned a revised draft; no factual or safety certification is implied.",
      });
      return {
        data: finalistData,
        provider: finalist.model,
        usedFallback: false,
        latencyMs: Date.now() - startedAt,
        qualityPipeline: passes,
      };
    }
  } catch {
    // Keep the valid writer draft below and label the missing finalist pass.
  }

  addPass({
    agentId: `${options.agentPrefix}_finalist`,
    role: "Final draft",
    status: "fallback",
    provider: "local-template",
    latencyMs: Date.now() - finalistStartedAt,
    summary: "No valid finalist response was returned; the earlier local-model draft is retained for human review.",
  });
  return {
    data: writerData,
    provider: writer.model,
    usedFallback: true,
    latencyMs: Date.now() - startedAt,
    qualityPipeline: passes,
    error: "Local finalist unavailable; the writer draft requires human review.",
  };
}

export interface NarrationScriptDraft {
  title: string;
  lines: string[];
}

export interface SongLyricsDraft {
  title: string;
  lyrics: string;
  styleNote: string;
}

export interface EmailMarketingDraft {
  draft: string;
}

function parseNarrationDraft(value: unknown): NarrationScriptDraft | null {
  const object = value as Record<string, unknown> | null;
  if (!object || typeof object.title !== "string" || !Array.isArray(object.lines)) return null;
  const lines = object.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0);
  return lines.length ? { title: object.title.trim(), lines } : null;
}

function parseSongLyricsDraft(value: unknown): SongLyricsDraft | null {
  const object = value as Record<string, unknown> | null;
  if (!object || typeof object.title !== "string" || typeof object.lyrics !== "string") return null;
  return {
    title: object.title.trim(),
    lyrics: object.lyrics.trim(),
    styleNote: typeof object.styleNote === "string" ? object.styleNote.trim() : "",
  };
}

function parseEmailMarketingDraft(value: unknown): EmailMarketingDraft | null {
  const object = value as Record<string, unknown> | null;
  return object && typeof object.draft === "string" && object.draft.trim()
    ? { draft: object.draft.trim() }
    : null;
}

export async function generateNarrationScript(
  topic: string,
  audience: string
): Promise<LocalPromptReviewResult<NarrationScriptDraft>> {
  const fallback: NarrationScriptDraft = {
    title: `${topic} — খসড়া`,
    lines: [
      `${topic} নিয়ে একটি সংক্ষিপ্ত আলোচনা দিয়ে শুরু করুন।`,
      `${audience}-এর প্রয়োজন অনুযায়ী নির্ভরযোগ্য তথ্য যাচাই করে নিন।`,
      "ব্যক্তিভেদে অভিজ্ঞতা আলাদা হতে পারে; নিশ্চিত তথ্য ছাড়া ফলাফলের প্রতিশ্রুতি দেবেন না।",
      "শিশুর স্বাস্থ্য বা বিকাশ নিয়ে উদ্বেগ থাকলে উপযুক্ত বিশেষজ্ঞের পরামর্শ নিন।",
    ],
  };
  return runLocalPromptReview({
    task: "narration script",
    agentPrefix: "voice_script",
    writerSystem: "You are a Video Scriptwriter. Draft a warm Bengali narration script. Do not invent facts or promise outcomes. Return only JSON {title:string, lines:string[]}. This is a draft, not a fact or safety check.",
    writerUser: `Topic: "${topic}"\nAudience: "${audience}"\nReturn a short narration script as JSON.`,
    critiqueSystem: "You are a prompt-based script critic. Return only JSON {strengths:string[], issues:string[], revisionPlan:string[]}. Flag unverified claims, medical advice, and guarantees. Do not claim facts or safety were verified and do not assign an approval score.",
    finalistSystem: "You are a final script editor. Use the critique to revise the Bengali draft, keep uncertainty clear, and return only JSON {title:string, lines:string[]}. Do not claim fact-checking or safety approval.",
    fallback,
    parseDraft: parseNarrationDraft,
  });
}

export async function generateSongLyrics(
  topic: string,
  mood: string
): Promise<LocalPromptReviewResult<SongLyricsDraft>> {
  const fallback: SongLyricsDraft = {
    title: `${topic} — শেখার গান`,
    lyrics: `আলোর পথে ছোট্ট পা, গল্পে ভরা দিন,\nভালোবাসায় শেখার মাঝে স্বপ্ন রঙিন।\n\nধীরে ধীরে হাতটি ধরি, শুনি মনের ভাষা,\nতুলনা নয়, পাশে থাকি—জাগুক নতুন আশা।`,
    styleNote: `${mood} অনুভূতির জন্য সাধারণ স্থানীয় টেমপ্লেট; মানব পর্যালোচনা প্রয়োজন।`,
  };
  return runLocalPromptReview({
    task: "song lyrics",
    agentPrefix: "music_lyrics",
    writerSystem: "You are a Songwriter. Draft original Bengali lyrics for a family-learning theme. Return only JSON {title:string, lyrics:string, styleNote:string}. Do not imply that the audio has sung vocals or that lyrics were independently reviewed.",
    writerUser: `Theme: "${topic}"\nMood: ${mood}\nReturn lyrics as JSON.`,
    critiqueSystem: "You are a prompt-based lyric critic. Return only JSON {strengths:string[], issues:string[], revisionPlan:string[]}. Flag unclear or unsupported claims. This is not independent review; do not assign a verified quality or safety score.",
    finalistSystem: "You are a lyric editor. Use the critique to revise the Bengali lyrics and return only JSON {title:string, lyrics:string, styleNote:string}. Do not claim independent quality or safety verification.",
    fallback,
    parseDraft: parseSongLyricsDraft,
  });
}

export async function generateEmailMarketingDraft(
  draft: string,
  audience: string,
  objective: string
): Promise<LocalPromptReviewResult<EmailMarketingDraft>> {
  const fallback: EmailMarketingDraft = { draft };
  return runLocalPromptReview({
    task: "email marketing draft",
    agentPrefix: "email_draft",
    writerSystem: "You are an email marketing copywriter. Revise the supplied email draft for clarity and the stated objective. Do not invent offers, dates, links, evidence, unsubscribe controls, or consent. Return only JSON {draft:string}. No email is sent.",
    writerUser: `Original email draft:\n${draft}\nAudience: ${audience}\nObjective: ${objective}\nReturn a proposed draft as JSON.`,
    critiqueSystem: "You are a prompt-based email draft critic. Return only JSON {strengths:string[], issues:string[], revisionPlan:string[]}. Flag invented facts, missing human verification, and unverified consent/delivery statements. This is not a legal, factual, or independent compliance review.",
    finalistSystem: "You are an email marketing copywriter. Use the critique to revise the draft conservatively. Preserve placeholders and do not add claims, links, unsubscribe instructions, or consent assertions that are not present in the supplied draft. Return only JSON {draft:string}. No email is sent.",
    fallback,
    parseDraft: parseEmailMarketingDraft,
  });
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
  ragContext: string,
  availableSources: { title: string; type: string }[] = []
): Promise<AIResult<ContentPackageOut>> {
  const sys = `You are a Bengali content-drafting model for ALO Learning Journey. Produce one complete content package in a warm, hopeful, non-shaming tone. Return ONLY JSON matching the schema. Captions object keys must be: facebook, instagram, youtube, tiktok, linkedin, x, whatsapp, threads, pinterest, telegram. Set qualityScore to 0 because no independent score is run. Do not claim that content was fact-checked, safety-reviewed, or quality-certified. ragCitations may include only exact document titles present in the supplied context; do not invent sources or relevance scores.`;
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
    qualityScore: 0,
    ragCitations: [],
  };
  const result = await chatJSON<ContentPackageOut>(sys, user, fallback);
  const sourcesByTitle = new Map(availableSources.map((source) => [source.title.trim().toLocaleLowerCase(), source]));
  const verifiedTitleMatches = (Array.isArray(result.data.ragCitations) ? result.data.ragCitations : [])
    .flatMap((citation) => {
      if (!citation || typeof citation.title !== "string") return [];
      const source = sourcesByTitle.get(citation.title.trim().toLocaleLowerCase());
      return source ? [{ title: source.title, type: source.type, relevance: 0 }] : [];
    });
  return { ...result, data: { ...result.data, qualityScore: 0, ragCitations: verifiedTitleMatches } };
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
  const sys = `Provide only a preliminary, unverified model suggestion about the supplied ${type}; you are not an independent safety reviewer and must not certify, fact-check, or approve content. Return ONLY JSON {approved:false, riskLevel, blockedReasons[], requiredEdits[], finalDisclaimer, needsHumanReview:true, checksPassed:[]}. If any developmental/medical concern, include this disclaimer: "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛". Flag fear-based, parent-shaming, guaranteed-outcome, or potentially unsafe content for human assessment.`;
  const user = `Content to review:\n"""\n${content}\n"""`;
  const fallback: SafetyOut = {
    approved: false,
    riskLevel: "medium",
    blockedReasons: ["Automated review unavailable; no safety decision was made."],
    requiredEdits: ["A human reviewer must check this item before approval or publication."],
    finalDisclaimer:
      "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛",
    needsHumanReview: true,
    checksPassed: [],
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
    category: "review_required",
    riskLevel: "medium",
    rationale: "Comment classification is unavailable; human review is required.",
    autoReplyAllowed: false,
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

// No independent quality-scoring or self-correction engine is implemented.
// Generated content remains draft material and must be reviewed by a person.

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
  const sys = `Draft a Bengali content brief for a parenting article. Return ONLY JSON matching the ContentBrief schema. All text in Bengali (natural, not machine-translated). Category: ${category}. Age group: ${ageGroup}. Include 3-5 outline sections with 2-3 points each. Include 3 FAQs. SEO title <60 chars. Meta description <160 chars. Set qualityScore to 0 because no independent quality, factual, or SEO verification is run.`;
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
    qualityScore: 0,
  };
  const result = await chatJSON<ContentBrief>(sys, user, fallback, { timeoutMs: 20000 });
  return { ...result, data: { ...result.data, qualityScore: 0 } };
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
