// ALO Learning Journey — local-only AI service (server-only).
// Model inference is sent only to private Ollama/ComfyUI hosts configured by the operator.
// When a local model is unavailable, the result explicitly reports a deterministic fallback.

import { generateComfyUiImage, generateLocalChatJson } from "@/lib/local-models";

export type AIProvider = "ollama-local" | "local-fallback" | "comfyui-local" | "image-fallback";
export type QualityPassStatus = "complete" | "fallback" | "skipped";

export interface QualityAgentPass {
  agentId: string;
  role: string;
  status: QualityPassStatus;
  provider: AIProvider;
  latencyMs: number;
  scoreBefore?: number;
  scoreAfter?: number;
  summary: string;
}

export interface AIResult<T> {
  ok: boolean;
  data: T;
  provider: AIProvider;
  usedFallback: boolean;
  error?: string;
  latencyMs: number;
  qualityPipeline?: QualityAgentPass[];
}

async function chatJSON<T>(
  system: string,
  user: string,
  fallback: T,
  opts?: { timeoutMs?: number }
): Promise<AIResult<T>> {
  const start = Date.now();
  try {
    const completion = await generateLocalChatJson(system, user, opts?.timeoutMs ?? 18_000);
    if (completion.model.includes("(built-in-local)")) {
      return {
        ok: false,
        data: fallback,
        provider: "local-fallback",
        usedFallback: true,
        error: "Configured Ollama model was unavailable; deterministic built-in output was not treated as a model result.",
        latencyMs: Date.now() - start,
      };
    }
    const raw = completion.content;
    const jsonMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const cleaned = (jsonMatch ? jsonMatch[0] : raw)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Partial<T>;

    let merged: T;
    if (Array.isArray(fallback)) {
      if (Array.isArray(parsed)) {
        merged = parsed as T;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const arrayValue = Object.values(obj).find(Array.isArray);
        merged = (arrayValue ?? fallback) as T;
      } else {
        merged = fallback;
      }
    } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      merged = { ...(fallback as object), ...(parsed as object) } as T;
    } else {
      merged = fallback;
    }

    const usedFallback = completion.model.includes("(built-in-local)");
    return {
      ok: !usedFallback,
      data: merged,
      provider: usedFallback ? "local-fallback" : "ollama-local",
      usedFallback,
      error: usedFallback ? "Configured Ollama model was unavailable; deterministic built-in content is not a verified model result." : undefined,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      ok: false,
      data: fallback,
      provider: "local-fallback",
      usedFallback: true,
      error: error instanceof Error ? error.message : "Local inference failed",
      latencyMs: Date.now() - start,
    };
  }
}

interface CreativeCritique {
  score: number;
  strengths: string[];
  issues: string[];
  revisionPlan: string[];
  safetyFlags: string[];
}

interface ThreeAgentOptions<T> {
  writerAgentId: string;
  writerRole: string;
  writerSystem: string;
  writerUser: string;
  criticAgentId: string;
  criticRole: string;
  criticSystem: string;
  criticUser: (candidate: T) => string;
  finalistAgentId: string;
  finalistRole: string;
  finalistSystem: string;
  finalistUser: (candidate: T, critique: CreativeCritique) => string;
  fallback: T;
  normalize: (candidate: unknown) => T;
  score: (candidate: T) => number;
  timeoutMs?: number;
}

function clampQualityScore(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

function normalizeCritique(value: unknown, fallbackScore: number): CreativeCritique {
  const raw = value && typeof value === "object" ? value as Partial<CreativeCritique> : {};
  const cleanList = (list: unknown) => Array.isArray(list)
    ? list.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 240)).filter(Boolean).slice(0, 8)
    : [];
  return {
    score: clampQualityScore(raw.score, fallbackScore),
    strengths: cleanList(raw.strengths),
    issues: cleanList(raw.issues),
    revisionPlan: cleanList(raw.revisionPlan),
    safetyFlags: cleanList(raw.safetyFlags),
  };
}

function skippedPass(agentId: string, role: string, summary: string): QualityAgentPass {
  return { agentId, role, status: "skipped", provider: "local-fallback", latencyMs: 0, summary };
}

/**
 * Runs a real sequential writer → critic → finalist chain against the configured
 * local model. Every later pass receives the previous candidate. If a model
 * pass fails, the best available candidate is retained and the skipped/fallback
 * state is surfaced; the function never invents a completed agent run.
 */
async function runThreeAgentRefinement<T>(options: ThreeAgentOptions<T>): Promise<AIResult<T>> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 22_000;
  const passes: QualityAgentPass[] = [];
  const draftResult = await chatJSON<T>(options.writerSystem, options.writerUser, options.fallback, { timeoutMs });
  const draft = options.normalize(draftResult.data);
  const draftScore = clampQualityScore(options.score(draft), 0);
  passes.push({
    agentId: options.writerAgentId,
    role: options.writerRole,
    status: draftResult.usedFallback ? "fallback" : "complete",
    provider: draftResult.provider,
    latencyMs: draftResult.latencyMs,
    scoreAfter: draftScore,
    summary: draftResult.usedFallback ? "Local model unavailable; used the marked template fallback." : "Created the first candidate.",
  });
  if (!draftResult.ok || draftResult.usedFallback) {
    passes.push(skippedPass(options.criticAgentId, options.criticRole, "Skipped because the local writer did not produce a model draft."));
    passes.push(skippedPass(options.finalistAgentId, options.finalistRole, "Skipped because the local writer did not produce a model draft."));
    return { ...draftResult, data: draft, qualityPipeline: passes, latencyMs: Date.now() - startedAt };
  }

  const critiqueFallback: CreativeCritique = {
    score: draftScore,
    strengths: [],
    issues: ["Automated critic was unavailable; the draft still requires human review."],
    revisionPlan: [],
    safetyFlags: [],
  };
  const critiqueResult = await chatJSON<CreativeCritique>(
    options.criticSystem,
    options.criticUser(draft),
    critiqueFallback,
    { timeoutMs }
  );
  const critique = normalizeCritique(critiqueResult.data, draftScore);
  passes.push({
    agentId: options.criticAgentId,
    role: options.criticRole,
    status: critiqueResult.usedFallback ? "fallback" : "complete",
    provider: critiqueResult.provider,
    latencyMs: critiqueResult.latencyMs,
    scoreBefore: draftScore,
    scoreAfter: critique.score,
    summary: critiqueResult.usedFallback
      ? "Critic unavailable; no revision brief was fabricated."
      : [...critique.issues, ...critique.revisionPlan].slice(0, 3).join("; ") || "Reviewed the candidate; no structural issue found.",
  });
  if (!critiqueResult.ok || critiqueResult.usedFallback) {
    passes.push(skippedPass(options.finalistAgentId, options.finalistRole, "Skipped because the critic could not provide a usable review."));
    return {
      ok: false,
      data: draft,
      provider: "local-fallback",
      usedFallback: true,
      error: critiqueResult.error || "Local quality critic unavailable; kept the writer draft.",
      qualityPipeline: passes,
      latencyMs: Date.now() - startedAt,
    };
  }

  const finalistResult = await chatJSON<T>(
    options.finalistSystem,
    options.finalistUser(draft, critique),
    draft,
    { timeoutMs }
  );
  const finalistCandidate = options.normalize(finalistResult.data);
  const finalistScore = clampQualityScore(options.score(finalistCandidate), 0);
  const acceptFinalist = finalistScore >= draftScore;
  const finalData = acceptFinalist ? finalistCandidate : draft;
  passes.push({
    agentId: options.finalistAgentId,
    role: options.finalistRole,
    status: finalistResult.usedFallback ? "fallback" : "complete",
    provider: finalistResult.provider,
    latencyMs: finalistResult.latencyMs,
    scoreBefore: draftScore,
    scoreAfter: acceptFinalist ? finalistScore : draftScore,
    summary: finalistResult.usedFallback
      ? "Finalist unavailable; retained the writer draft."
      : acceptFinalist
        ? "Reviewed the critique, revised the candidate, and matched or improved the structural rubric score."
        : "Revised candidate scored lower; retained the writer draft.",
  });
  const usedFallback = finalistResult.usedFallback || !finalistResult.ok;
  return {
    ok: !usedFallback,
    data: finalData,
    provider: usedFallback ? "local-fallback" : "ollama-local",
    usedFallback,
    error: usedFallback ? finalistResult.error || "Local finalist unavailable; retained the best candidate." : undefined,
    qualityPipeline: passes,
    latencyMs: Date.now() - startedAt,
  };
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

export interface SongLyricsOut {
  title: string;
  lyrics: string;
  styleNote: string;
}

export async function generateSongLyrics(topic: string, mood: string): Promise<AIResult<SongLyricsOut>> {
  const fallback: SongLyricsOut = {
    title: `${topic} — ভালোবাসার গান`,
    lyrics: `ছোট্ট হাতে রঙিন সকাল, গল্প জাগে মনে,\nখেলার ছলে শেখা চলে আপনজনের সনে।\n\nআলো জ্বালো, পাশে থাকো, স্বপ্ন ডানা মেলে,\nভালোবাসা শেখার পথে হাতটা রেখো হেলে।\n\nহাসি, কথা, ছোট্ট চেষ্টা—প্রতিদিনের জয়,\nএকসাথে পথ চললে মন আনন্দময়।\n\nআলো জ্বালো, পাশে থাকো, স্বপ্ন ডানা মেলে,\nভালোবাসা শেখার পথে হাতটা রেখো হেলে।`,
    styleNote: "মৌলিক বাংলা লিরিক্স; আলাদা করে তৈরি স্থানীয় ইন্সট্রুমেন্টাল ট্র্যাকের সঙ্গে ব্যবহার করুন।",
  };
  const normalize = (value: unknown): SongLyricsOut => {
    const raw = value && typeof value === "object" ? value as Partial<SongLyricsOut> : {};
    return {
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 160) : fallback.title,
      lyrics: typeof raw.lyrics === "string" && raw.lyrics.trim().length >= 20 ? raw.lyrics.trim().slice(0, 6000) : fallback.lyrics,
      styleNote: typeof raw.styleNote === "string" ? raw.styleNote.trim().slice(0, 600) : fallback.styleNote,
    };
  };
  const score = (candidate: SongLyricsOut) => {
    let points = 0;
    if (candidate.title.trim().length >= 3) points += 15;
    if (candidate.lyrics.trim().length >= 160) points += 20;
    if (candidate.lyrics.split(/\n\s*\n/).filter(Boolean).length >= 3) points += 15;
    if ((candidate.lyrics.match(/[\u0980-\u09FF]/g) ?? []).length >= 40) points += 20;
    const lines = candidate.lyrics.split(/\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length >= 6 && new Set(lines).size >= 4) points += 15;
    if (candidate.styleNote.trim().length >= 12) points += 5;
    if (!/copyright|cover song|in the style of [a-z]|guaranteed/i.test(candidate.lyrics)) points += 10;
    return points;
  };
  return runThreeAgentRefinement<SongLyricsOut>({
    writerAgentId: "song_lyricist",
    writerRole: "Songwriter",
    writerSystem: `You are ALO's Bengali songwriter. Draft original, family-friendly lyrics; do not imitate or quote known songs. Return ONLY JSON {title, lyrics, styleNote}. Include a concise verse, memorable repeated chorus, and gentle closing. Do not claim the lyric is sung or invent factual promises.`,
    writerUser: `Theme: "${topic}". Mood: ${mood}. Write natural, simple Bengali lyrics for family listening. The output is a text draft only.`,
    criticAgentId: "quality_critic",
    criticRole: "Lyric critic",
    criticSystem: `You are a strict lyric critic. Review the supplied Bengali lyric for natural phrasing, repetition, singability, originality, family safety, and unsupported claims. Do not rewrite it. Return ONLY JSON {score:0-100,strengths:string[],issues:string[],revisionPlan:string[],safetyFlags:string[]}.`,
    criticUser: (candidate) => `Review this exact draft:\n${JSON.stringify(candidate)}\nUse the lyric rubric; point out specific lines, not generic praise.`,
    finalistAgentId: "song_finalist",
    finalistRole: "Final lyric editor",
    finalistSystem: `You are the final Bengali lyric editor. Improve the given exact candidate using the critique. Preserve originality, family safety, and natural language. Return ONLY JSON {title,lyrics,styleNote}; no commentary and no claim that audio vocals were generated.`,
    finalistUser: (candidate, critique) => `Theme: ${topic}. Mood: ${mood}.\nCandidate file:\n${JSON.stringify(candidate)}\nCritique and revision brief:\n${JSON.stringify(critique)}\nReturn a materially improved final lyric draft.`,
    fallback,
    normalize,
    score,
    timeoutMs: 25_000,
  });
}

export interface NarrationScriptOut {
  title: string;
  lines: string[];
}

export async function generateNarrationScript(topic: string, audience = "বাংলাদেশি পিতামাতা"): Promise<AIResult<NarrationScriptOut>> {
  const fallback: NarrationScriptOut = {
    title: topic,
    lines: [
      `${topic} নিয়ে ছোট্ট একটি কথা।`,
      "প্রতিটি শিশুর শেখার গতি আলাদা—তাই তুলনা নয়, পাশে থাকাই জরুরি।",
      "প্রতিদিন অল্প সময় গল্প, খেলা আর কথোপকথনে দিন।",
      "শিশুর আগ্রহ শুনুন এবং ছোট ছোট চেষ্টাকে স্বীকৃতি দিন।",
      "কঠিন লাগলে ধৈর্য ধরুন; ভালোবাসা দিয়ে শেখার সুযোগ তৈরি হয়।",
      "আজকের একটি সহজ অভ্যাস বেছে নিয়ে একসাথে চেষ্টা করুন।",
      "আপনার অভিজ্ঞতা আলো লার্নিং জার্নির সাথে শেয়ার করুন।",
    ],
  };
  const normalize = (value: unknown): NarrationScriptOut => {
    const raw = value && typeof value === "object" ? value as Partial<NarrationScriptOut> : {};
    const lines = Array.isArray(raw.lines)
      ? raw.lines.filter((line): line is string => typeof line === "string").map((line) => line.trim().slice(0, 500)).filter(Boolean).slice(0, 12)
      : [];
    return {
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 160) : fallback.title,
      lines: lines.length >= 4 ? lines : fallback.lines,
    };
  };
  const score = (candidate: NarrationScriptOut) => {
    const meaningful = candidate.lines.filter((line) => line.trim().length >= 12);
    let points = meaningful.length >= 6 ? 25 : meaningful.length >= 4 ? 15 : 0;
    if (meaningful.length <= 10) points += 10;
    if (candidate.title.trim()) points += 10;
    if (candidate.lines.join(" ").length >= 240) points += 15;
    if ((candidate.lines.join(" ").match(/[\u0980-\u09FF]/g) ?? []).length >= 40) points += 20;
    if (!/guarantee|cure|100%|নিশ্চিতভাবে|অবশ্যই সারবে/i.test(candidate.lines.join(" "))) points += 20;
    return points;
  };
  return runThreeAgentRefinement<NarrationScriptOut>({
    writerAgentId: "video_scriptwriter",
    writerRole: "Video scriptwriter",
    writerSystem: `You are ALO's local Bengali video scriptwriter. Return only JSON {title,lines}, with 6-10 concise spoken lines for a warm, practical educational video. Avoid fear, shaming, unsupported medical claims, guaranteed outcomes, and repetitive filler. Do not add stage directions to spoken lines.`,
    writerUser: `Topic: "${topic}". Audience: "${audience}". Write useful, natural Bengali narration, ending with one gentle call to action.`,
    criticAgentId: "quality_critic",
    criticRole: "Script critic",
    criticSystem: `You are a strict Bengali narration critic. Review factual restraint, clarity, audience fit, spoken rhythm, repetition, safety, and a non-coercive CTA. Do not rewrite the script. Return ONLY JSON {score:0-100,strengths:string[],issues:string[],revisionPlan:string[],safetyFlags:string[]}.`,
    criticUser: (candidate) => `Review this exact candidate for ${audience}:\n${JSON.stringify(candidate)}\nTopic: ${topic}. Identify specific improvements and unsupported claims.`,
    finalistAgentId: "video_script_finalist",
    finalistRole: "Final script editor",
    finalistSystem: `You are the final script editor for ALO. Use the independent critique to improve the exact candidate while preserving factual caution, warm Bengali voice, and 6-10 concise spoken lines. Do not invent research, statistics, medical advice, dates, or guarantees. Return ONLY JSON {title,lines}.`,
    finalistUser: (candidate, critique) => `Topic: ${topic}. Audience: ${audience}.\nCandidate file:\n${JSON.stringify(candidate)}\nCritique/revision brief:\n${JSON.stringify(critique)}\nReturn the complete final script.`,
    fallback,
    normalize,
    score,
    timeoutMs: 25_000,
  });
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
  ragCitations: ContentPackageOut["ragCitations"] = []
): Promise<AIResult<ContentPackageOut>> {
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
    imagePrompt: "Warm pastel illustration of a Bengali parent and child reading together, gentle morning light, hopeful mood, flat editorial illustration, no text, no identifiable real face, child-safe.",
    voiceDirection: "Warm Bengali narration, gentle pace, hopeful tone; use a consented synthetic voice.",
    cta: "আপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন ✨",
    disclaimerBn: "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛",
    qualityScore: 0,
    ragCitations,
  };
  const channels = Object.keys(fallback.captions);
  const normalize = (value: unknown): ContentPackageOut => {
    const raw = value && typeof value === "object" ? value as Partial<ContentPackageOut> : {};
    const rawCaptions = raw.captions && typeof raw.captions === "object" ? raw.captions as Record<string, unknown> : {};
    const captions = Object.fromEntries(channels.map((channel) => [
      channel,
      typeof rawCaptions[channel] === "string" && rawCaptions[channel].trim()
        ? rawCaptions[channel].trim().slice(0, 4000)
        : fallback.captions[channel],
    ])) as Record<string, string>;
    const cleanStrings = (items: unknown, safeFallback: string[], limit: number, itemLimit = 300) =>
      Array.isArray(items)
        ? items.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, itemLimit)).filter(Boolean).slice(0, limit)
        : safeFallback;
    const candidate: ContentPackageOut = {
      reelScript: typeof raw.reelScript === "string" && raw.reelScript.trim() ? raw.reelScript.trim().slice(0, 8000) : fallback.reelScript,
      hooks: cleanStrings(raw.hooks, fallback.hooks, 8),
      seoKeywords: cleanStrings(raw.seoKeywords, fallback.seoKeywords, 20),
      captions,
      hashtags: cleanStrings(raw.hashtags, fallback.hashtags, 30, 80),
      imagePrompt: typeof raw.imagePrompt === "string" && raw.imagePrompt.trim() ? raw.imagePrompt.trim().slice(0, 2000) : fallback.imagePrompt,
      voiceDirection: typeof raw.voiceDirection === "string" && raw.voiceDirection.trim() ? raw.voiceDirection.trim().slice(0, 500) : fallback.voiceDirection,
      cta: typeof raw.cta === "string" && raw.cta.trim() ? raw.cta.trim().slice(0, 500) : fallback.cta,
      disclaimerBn: typeof raw.disclaimerBn === "string" && raw.disclaimerBn.trim() ? raw.disclaimerBn.trim().slice(0, 800) : fallback.disclaimerBn,
      qualityScore: 0,
      // Never accept model-invented RAG sources or similarity scores.
      ragCitations: ragCitations.filter((source) => source && typeof source.title === "string" && typeof source.type === "string").slice(0, 5),
    };
    candidate.qualityScore = validateContentPackage(candidate).score;
    return candidate;
  };
  const writerSystem = `You are ALO Learning Journey's Bengali content writer. Create one complete, useful and human-reviewable content package. Use a warm, hopeful, non-shaming tone; no fear hooks, fabricated facts, medical/legal advice, guarantees, invented citations, or claims unsupported by the supplied RAG context. Return ONLY JSON with reelScript, hooks, seoKeywords, captions (keys: facebook, instagram, youtube, tiktok, linkedin, x, whatsapp, threads, pinterest, telegram), hashtags, imagePrompt, voiceDirection, cta, disclaimerBn. Keep claims cautious and identify unverifiable dates/prices as placeholders.`;
  const writerUser = `Topic: "${topic}". Audience: "${audience}". Supplied reference context (may be empty):\n${ragContext.slice(0, 5_000)}\n\nDraft the complete package in natural Bengali, adapting length to each platform.`;
  const criticSystem = `You are the independent quality and safety critic for ALO's Bengali education marketing package. Assess practical usefulness, clarity, brand tone, platform fit, factual restraint, medical/legal risk, child safety, CTA pressure, image prompt safety, and completeness. Do not rewrite. Return ONLY JSON {score:0-100,strengths:string[],issues:string[],revisionPlan:string[],safetyFlags:string[]}. A model score is an editorial estimate, not a fact-check.`;
  const finalistSystem = `You are the finalist editor for ALO Learning Journey. You receive the exact writer draft and an independent critique. Revise the complete package to address valid critique while preserving natural Bengali, safe educational framing, and platform-specific fit. Do not invent external facts, sources, statistics, deadlines, testimonials, or outcome guarantees. Return ONLY the full JSON package schema from the brief. The app replaces citations with actual retrieved source records and calculates its own structural rubric score.`;
  return runThreeAgentRefinement<ContentPackageOut>({
    writerAgentId: "content_writer",
    writerRole: "Package writer",
    writerSystem,
    writerUser,
    criticAgentId: "quality_critic",
    criticRole: "Independent critic",
    criticSystem,
    criticUser: (candidate) => `Topic: ${topic}. Audience: ${audience}.\nReview this exact complete draft:\n${JSON.stringify(candidate)}\nOnly use the supplied context for factual claims: ${ragContext.slice(0, 3500) || "No verified reference text was supplied."}`,
    finalistAgentId: "content_finalist",
    finalistRole: "Finalist editor",
    finalistSystem,
    finalistUser: (candidate, critique) => `Topic: ${topic}. Audience: ${audience}.\nWriter's candidate file:\n${JSON.stringify(candidate)}\nIndependent critique and revision brief:\n${JSON.stringify(critique)}\nReference context:\n${ragContext.slice(0, 3500) || "No verified reference text was supplied."}\nReturn the complete revised package.`,
    fallback,
    normalize,
    score: (candidate) => validateContentPackage(candidate).score,
    timeoutMs: 25_000,
  });
}

export interface EmailMarketingDraftOut {
  draft: string;
}

export async function generateEmailMarketingDraft(
  draft: string,
  audience: string,
  objective: string
): Promise<AIResult<EmailMarketingDraftOut>> {
  const fallback = { draft: draft.slice(0, 8_000) };
  const unresolvedTokens = draft.match(/\{\{[^}]{1,80}\}\}|\[[^\]]{1,160}\]/g) ?? [];
  const normalize = (value: unknown): EmailMarketingDraftOut => {
    const raw = value && typeof value === "object" ? value as Partial<EmailMarketingDraftOut> : {};
    const candidate = typeof raw.draft === "string" ? raw.draft.trim().slice(0, 8_000) : fallback.draft;
    const preservesRequiredPlaceholders = unresolvedTokens.every((token) => candidate.includes(token));
    return { draft: candidate && preservesRequiredPlaceholders ? candidate : fallback.draft };
  };
  const score = (candidate: EmailMarketingDraftOut) => {
    const text = candidate.draft;
    let points = 0;
    if (/^subject\s*:/im.test(text)) points += 15;
    if (/^preheader\s*:/im.test(text)) points += 10;
    if (text.length >= 150 && text.length <= 5_000) points += 20;
    if (text.split(/\n\s*\n/).filter((part) => part.trim().length > 15).length >= 3) points += 15;
    if (/unsubscribe|preferences|opt[ -]out|reply\s+stop/i.test(text)) points += 15;
    if (unresolvedTokens.every((token) => text.includes(token))) points += 10;
    if (!/guaranteed admission|guaranteed visa|100% success|guaranteed outcome|নিশ্চিত ভর্তি|ভিসা নিশ্চিত/i.test(text)) points += 15;
    return points;
  };
  const writerSystem = `You are ALO's email marketing copywriter. Improve the supplied email draft for clarity, a truthful subject line, a concise preheader, helpful body, accessible plain-text structure, one clear next step, and respectful opt-out/preferences language. Do not invent facts, offers, pricing, dates, testimonials, deadlines, recipient permissions, or admission/visa outcomes. Preserve every supplied [bracket placeholder] and {{merge tag}} byte-for-byte. Return ONLY JSON {draft:string}.`;
  const criticSystem = `You are an independent email deliverability, clarity, and compliance critic. Check the supplied draft for misleading urgency, unsupported education/visa claims, spammy wording, missing subject/preheader, too many CTAs, privacy risks, and missing consent/unsubscribe reminder. Do not rewrite. Return ONLY JSON {score:0-100,strengths:string[],issues:string[],revisionPlan:string[],safetyFlags:string[]}.`;
  const finalistSystem = `You are the finalist editor for an ALO email marketing draft. Use the critic's specific notes to improve the exact candidate. Preserve every original bracket placeholder and merge tag exactly. Do not send the email, invent an unsubscribe URL, assert consent, or add unsupported facts. Return ONLY JSON {draft:string}. This is a human-review draft, not delivery authorization.`;
  return runThreeAgentRefinement<EmailMarketingDraftOut>({
    writerAgentId: "email_copywriter",
    writerRole: "Email copywriter",
    writerSystem,
    writerUser: `Objective: ${objective.slice(0, 500)}\nAudience: ${audience.slice(0, 500)}\nOriginal email draft:\n${draft.slice(0, 8_000)}\nReturn a revised draft.`,
    criticAgentId: "quality_critic",
    criticRole: "Email compliance critic",
    criticSystem,
    criticUser: (candidate) => `Objective: ${objective}. Audience: ${audience}. Review this email without inventing facts:\n${candidate.draft}`,
    finalistAgentId: "email_finalist",
    finalistRole: "Email finalist",
    finalistSystem,
    finalistUser: (candidate, critique) => `Objective: ${objective}. Audience: ${audience}.\nWriter candidate:\n${candidate.draft}\nIndependent critique:\n${JSON.stringify(critique)}\nReturn a better final draft, preserving all placeholders.`,
    fallback,
    normalize,
    score,
    timeoutMs: 22_000,
  });
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
    approved: false,
    riskLevel: "medium",
    blockedReasons: ["Local safety review unavailable; no safety decision was made."],
    requiredEdits: ["A human reviewer must check this item before approval or publication."],
    finalDisclaimer: "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛",
    needsHumanReview: true,
    checksPassed: [],
  };
  return chatJSON<SafetyOut>(sys, user, fallback);
}

// ---- Comment moderation (CommentModerationAgent + CommunityReplyAgent) ----

export interface CommentClassifyOut {
  category: string; // safe_general | question | praise | complaint | medical_sensitive | development_sensitive | abuse_risk | emergency | spam | toxic | review_required
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
    rationale: "স্থানীয় moderation model অনুপলব্ধ; human review না হওয়া পর্যন্ত auto-reply বন্ধ।",
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
): Promise<AIResult<{ path: string; prompt: string }>> {
  const startedAt = Date.now();
  const fallback = { prompt: prompt.slice(0, 2_000) };
  const normalize = (value: unknown) => {
    const raw = value && typeof value === "object" ? value as { prompt?: unknown } : {};
    return { prompt: typeof raw.prompt === "string" && raw.prompt.trim() ? raw.prompt.trim().slice(0, 2_000) : fallback.prompt };
  };
  const imagePromptResult = await runThreeAgentRefinement({
    writerAgentId: "image_prompt",
    writerRole: "Image art director",
    writerSystem: `You are ALO's local image art director. Improve the supplied prompt for a coherent, age-appropriate Bengali education brand visual: specific subject, composition, lighting, palette, medium, and crop safety. Do not add text, logos, real-person likenesses, or sensitive child depictions. Return ONLY JSON {prompt:string}.`,
    writerUser: `Canvas: ${size}. Original brief:\n${prompt.slice(0, 2_000)}\nWrite one clear, generator-ready prompt.`,
    criticAgentId: "quality_critic",
    criticRole: "Visual prompt critic",
    criticSystem: `You are a strict visual-prompt critic. Check composition, clarity, accessibility, safe child depiction, identity/consent, text artifacts, and fit for the requested crop. Do not rewrite. Return ONLY JSON {score:0-100,strengths:string[],issues:string[],revisionPlan:string[],safetyFlags:string[]}.`,
    criticUser: (candidate) => `Canvas: ${size}. Review this exact image prompt:\n${candidate.prompt}`,
    finalistAgentId: "image_prompt_finalist",
    finalistRole: "Final prompt editor",
    finalistSystem: `You are the finalist image-prompt editor. Incorporate valid critique, keep the image child-safe and brand-appropriate, avoid real-person likenesses and all embedded text/logos, and return ONLY JSON {prompt:string}.`,
    finalistUser: (candidate, critique) => `Canvas: ${size}.\nCandidate prompt:\n${candidate.prompt}\nIndependent critique:\n${JSON.stringify(critique)}\nReturn a materially improved final prompt.`,
    fallback,
    normalize,
    score: (candidate) => {
      let points = 0;
      if (candidate.prompt.length >= 80) points += 20;
      if (/(composition|foreground|background|close-up|wide|portrait|landscape)/i.test(candidate.prompt)) points += 15;
      if (/(light|lighting|morning|soft|contrast|color|palette)/i.test(candidate.prompt)) points += 15;
      if (/(illustration|photograph|editorial|watercolor|flat|3d|cinematic)/i.test(candidate.prompt)) points += 15;
      if (/(no text|without text|no logo|without logo)/i.test(candidate.prompt)) points += 10;
      if (/(child-safe|child safe|safe for children|non-identifiable|no real faces)/i.test(candidate.prompt)) points += 15;
      if (!/deepfake|impersonat|sexualized|nude|real person/i.test(candidate.prompt)) points += 10;
      return points;
    },
    timeoutMs: 20_000,
  });

  try {
    await generateComfyUiImage(imagePromptResult.data.prompt, outPath, size);
    return {
      ok: true,
      data: { path: outPath, prompt: imagePromptResult.data.prompt },
      provider: "comfyui-local",
      usedFallback: false,
      latencyMs: Date.now() - startedAt,
      qualityPipeline: imagePromptResult.qualityPipeline,
    };
  } catch (error) {
    return {
      ok: false,
      data: { path: outPath, prompt: imagePromptResult.data.prompt },
      provider: "image-fallback",
      usedFallback: true,
      error: error instanceof Error ? error.message : "Local image generation failed",
      latencyMs: Date.now() - startedAt,
      qualityPipeline: imagePromptResult.qualityPipeline,
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
  const points = (condition: boolean, value: number, issue: string) => {
    if (!condition) issues.push(issue);
    return condition ? value : 0;
  };
  const requiredChannels = ["facebook", "instagram", "youtube", "tiktok", "linkedin", "x", "whatsapp", "threads", "pinterest", "telegram"];
  const captions = pkg.captions && typeof pkg.captions === "object" ? pkg.captions : {};
  const completeChannels = requiredChannels.every((channel) => typeof captions[channel] === "string" && captions[channel].trim().length >= 15);
  const allText = [pkg.reelScript, ...Object.values(captions), ...(pkg.hooks ?? [])].filter((value) => typeof value === "string").join(" ");
  let score = 0;
  score += points(typeof pkg.reelScript === "string" && pkg.reelScript.trim().length >= 80, 15, "Reel script is missing or too short.");
  score += points(Array.isArray(pkg.hooks) && pkg.hooks.length >= 3, 10, "At least three hooks are required.");
  score += points(Array.isArray(pkg.hooks) && new Set(pkg.hooks.map((hook) => hook.trim().toLowerCase())).size >= 3, 5, "Hooks must be distinct.");
  score += points(completeChannels, 10, "A platform caption is missing or too short.");
  score += points(Object.values(captions).every((caption) => typeof caption === "string" && caption.trim().length > 0), 10, "All supplied caption values must be non-empty strings.");
  score += points(Array.isArray(pkg.seoKeywords) && pkg.seoKeywords.length >= 3, 8, "At least three SEO keywords are required.");
  score += points(Array.isArray(pkg.hashtags) && pkg.hashtags.length >= 3, 5, "At least three hashtags are required.");
  score += points(typeof pkg.imagePrompt === "string" && pkg.imagePrompt.trim().length >= 30, 10, "Image prompt is missing or too short.");
  score += points(typeof pkg.voiceDirection === "string" && pkg.voiceDirection.trim().length >= 12, 5, "Voice direction is missing.");
  score += points(typeof pkg.cta === "string" && pkg.cta.trim().length >= 8, 7, "CTA is missing or too short.");
  score += points(typeof pkg.disclaimerBn === "string" && pkg.disclaimerBn.trim().length >= 15, 5, "Bengali disclaimer is missing.");
  score += points(Array.isArray(pkg.ragCitations) && pkg.ragCitations.every((source) => source && typeof source.title === "string" && typeof source.type === "string"), 5, "Reference metadata is malformed; citations must come from retrieved documents.");
  score += points(/[\u0980-\u09FF]/.test(allText), 5, "Package has no Bengali-script text.");
  score += points(!/guaranteed admission|guaranteed visa|100% success|guaranteed outcome|ভর্তি নিশ্চিত|ভিসা নিশ্চিত|নিশ্চিত সাফল্য/i.test(allText), 10, "Potential guaranteed-outcome claim requires removal or human verification.");
  const boundedScore = Math.max(0, Math.min(100, score));
  return { score: boundedScore, passed: boundedScore >= 85, issues };
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
    searchDemand: 0,
    parentRelevance: 0,
    bangladeshRelevance: 0,
    competition: 0,
    videoPotential: 0,
    brandFit: 0,
    finalScore: 0,
    rationale: "স্থানীয় মডেল অনুপলব্ধ; কোনো অনুসন্ধান-চাহিদা বা বাজার মূল্যায়ন করা হয়নি।",
  };
  return chatJSON<OpportunityScore>(sys, user, fallback, { timeoutMs: 15000 });
}

export interface HookVariants {
  hooks: { variant: string; text: string; strategy: string }[];
}

export async function generateHookVariants(
  topic: string,
  count = 5
): Promise<AIResult<HookVariants>> {
  const sys = `You are the HookOptimizerAgent for ALO Learning Journey. Generate ${count} distinct hook drafts for a Bengali parenting video about "${topic}". Use varied approaches such as curiosity, question, benefit, and story, without fabricated statistics, fear, shame, or guarantees. Return ONLY JSON {hooks: [{variant: "A", text: "...", strategy: "curiosity"}]}. Do not invent retention predictions; only measured performance data is reported after a real test.`;
  const user = `Topic: "${topic}". Generate ${count} hook variants.`;
  const fallback: HookVariants = {
    hooks: [
      { variant: "A", text: `${topic} — আপনার কী জানা দরকার? 💛`, strategy: "curiosity" },
      { variant: "B", text: `${topic} শুরু করার একটি সহজ উপায় ✨`, strategy: "benefit" },
      { variant: "C", text: `${topic} নিয়ে আপনার প্রশ্ন কী?`, strategy: "question" },
      { variant: "D", text: `পরিবারের শেখার পথে ${topic} 🌱`, strategy: "story" },
      { variant: "E", text: `আজ ঘরে ${topic} চেষ্টা করে দেখুন 💛`, strategy: "action" },
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
    qualityScore: 0,
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
