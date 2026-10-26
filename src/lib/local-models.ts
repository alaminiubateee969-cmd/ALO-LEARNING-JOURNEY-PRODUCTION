import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { svgToPngFile } from "@/lib/image-processing";

export type LocalChatResult = { content: string; model: string };

const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".test"];

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1" ||
    LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) return true;

  // Docker Compose service names and other single-label hostnames are local-only.
  if (!host.includes(".") && !host.includes(":")) return true;

  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
    const [a, b] = octets;
    return a === 10 || a === 127 ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  // Unique-local and link-local IPv6 ranges; public IPv6 hosts are rejected.
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

/** Resolve a deployment-configured local service URL and reject public hosts. */
export function getPrivateLocalBaseUrl(envName: string, fallback: string): URL {
  const raw = process.env[envName]?.trim() || fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${envName} must be a valid local HTTP(S) URL`);
  }
  if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password ||
      url.search || url.hash || !isPrivateAddress(url.hostname)) {
    throw new Error(`${envName} must point to a private/local host; public AI endpoints are blocked`);
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

function endpoint(base: URL, pathName: string): URL {
  const root = new URL(base);
  root.pathname = `${root.pathname.replace(/\/+$/, "")}/${pathName.replace(/^\/+/, "")}`;
  return root;
}

function extractQuotedField(text: string, label: string, defaultVal: string): string {
  const regex = new RegExp(`${label}\\s*:\\s*"([^"]+)"`, "i");
  const match = regex.exec(text);
  if (match?.[1]?.trim()) return match[1].trim();
  const simple = new RegExp(`${label}\\s*:\\s*([^\\n.]+)`, "i").exec(text);
  return simple?.[1]?.trim() || defaultVal;
}

function synthesizeBuiltInLocalChatJson(system: string, user: string, model: string): LocalChatResult {
  const sysLower = system.toLowerCase();

  // 1. Critic pass in 3-agent refinement
  if (sysLower.includes("strengths:string[]") && sysLower.includes("revisionplan:string[]")) {
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        score: 0,
        strengths: [],
        issues: ["The local model was unavailable; no independent review was performed."],
        revisionPlan: ["Human review required."],
        safetyFlags: ["not_evaluated"],
      }),
    };
  }

  // 2. Song lyrics (writer or finalist)
  if (sysLower.includes("songwriter") || sysLower.includes("lyric editor")) {
    const theme = extractQuotedField(user, "Theme", "শিশুর আনন্দময় শেখা");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        title: `${theme} — আলোর পথে শেখার গান`,
        lyrics: [
          `সকালবেলার মিষ্টি রোদে নতুন শেখার ডাক,\n${theme} নিয়ে আনন্দে আজ মনটা ভরে থাক।\nছোট্ট হাতের কৌতূহলে রঙিন হলো দিন,\nভালোবাসার ছোঁয়ায় বাজুক খুশির মধুর বীণ।`,
          `আলো জ্বালো, পাশে থাকো, স্বপ্ন ডানা মেলে,\nভালোবাসায় শেখার পথে হাতটা রেখো হেলে।\nতুলনা নয়, ধৈর্য দিয়ে শোনো মনের ভাষা,\nছোট্ট চোখের তারায় জাগুক নতুন দিনের আশা।`,
          `গল্প, খেলা, হাসির ছলে একটু একটু শেখা,\nপ্রতিটি শিশু আপন গতিতে পায় যে আলোর দেখা।\nহোঁচট খেলে জড়িয়ে ধরো, সাহস দিও মনে,\nসুন্দর আগামী গড়ে উঠুক পরিবারের সনে।`,
          `আলো জ্বালো, পাশে থাকো, স্বপ্ন ডানা মেলে,\nভালোবাসায় শেখার পথে হাতটা রেখো হেলে।`,
        ].join("\n\n"),
        styleNote: "Built-in template only; originality and child safety were not independently reviewed. Human review is required.",
      }),
    };
  }

  // 3. Video narration script (writer or finalist)
  if (sysLower.includes("video scriptwriter") || sysLower.includes("final script editor")) {
    const topic = extractQuotedField(user, "Topic", "শিশুর বিকাশ ও প্যারেন্টিং");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        title: `${topic} — পিতামাতার জন্য সহজ গাইড`,
        lines: [
          `${topic} নিয়ে আজ আমরা জানবো প্রতিদিনের সহজ ও কার্যকর কিছু অভ্যাস।`,
          "প্রতিটি শিশুর শেখার ও বেড়ে ওঠার গতি আলাদা—তাই অন্যের সাথে তুলনা না করে শিশুর পাশে থাকুন।",
          "প্রতিদিন অন্তত দশ থেকে পনেরো মিনিট মনোযোগ দিয়ে শিশুর সাথে গল্প, খেলা এবং কথোপকথনে সময় দিন।",
          "শিশুর ছোট ছোট প্রশ্ন ও কৌতূহল মনোযোগ দিয়ে শুনুন এবং তার প্রতিটি চেষ্টাকে আনন্দের সাথে স্বীকৃতি দিন।",
          "যখন কোনো বিষয় কঠিন মনে হবে, তখন ধৈর্য ধরুন; শান্ত ও ইতিবাচক পরিবেশেই শিশু সবচেয়ে ভালো শেখে।",
          "আজ থেকেই পরিবারের সবাই মিলে একটি ছোট ও আনন্দময় রুটিন শুরু করুন।",
          "আপনার অভিজ্ঞতা কমেন্টে জানান এবং আলো লার্নিং জার্নির সাথে যুক্ত থাকুন।",
        ],
      }),
    };
  }

  // 4. Image prompt (writer or finalist)
  if (sysLower.includes("image art director") || sysLower.includes("image-prompt editor")) {
    const briefMatch = /Original brief:\s*([\s\S]+?)\nWrite one clear/i.exec(user) || /Candidate prompt:\s*([\s\S]+?)\nIndependent critique/i.exec(user);
    const baseBrief = (briefMatch?.[1] || "Warm Bengali parent and child learning together at home").trim().slice(0, 400);
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        prompt: `${baseBrief}, warm pastel editorial illustration, balanced wide portrait composition with soft foreground and cozy home learning background, golden morning lighting, gentle warm color palette, flat vector watercolor style, child-safe non-identifiable stylized characters, no real faces, no text, without logo`,
      }),
    };
  }

  // 5. Email marketing draft (writer or finalist)
  if (sysLower.includes("email marketing copywriter") || sysLower.includes("email marketing draft")) {
    const origMatch = /Original email draft:\n([\s\S]+?)\nReturn a proposed draft/i.exec(user) || /Writer candidate:\n([\s\S]+?)\nIndependent critique/i.exec(user);
    const original = (origMatch?.[1] || user).trim();
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({ draft: original }),
    };
  }

  // 6. Full Content Package (writer or finalist)
  if (sysLower.includes("content writer") || sysLower.includes("finalist editor for alo learning journey")) {
    const topic = extractQuotedField(user, "Topic", "শিশুর মনোযোগ ও শেখার আগ্রহ");
    const audience = extractQuotedField(user, "Audience", "বাংলাদেশি পিতামাতা");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        reelScript: `[হুক — ০ থেকে ৩ সেকেন্ড] ${topic} নিয়ে পিতামাতাদের সবচেয়ে সহজ ও কার্যকর কৌশলটি জানেন কি? 💛\n\n[প্রেক্ষাপট] ব্যস্ত জীবনে অনেক সময় আমরা বুঝে উঠতে পারি না কীভাবে শুরু করব। অথচ ছোট ছোট ইতিবাচক অভ্যাসই শিশুর জীবনে বড় পরিবর্তন আনে।\n\n[৩টি কার্যকর ধাপ]\n১. প্রতিদিন নির্দিষ্ট সময়ে অন্তত ১০ মিনিট শিশুর সাথে নিরবচ্ছিন্ন সময় কাটান।\n২. তুলনা বা চাপ না দিয়ে খেলার ছলে শেখার পরিবেশ তৈরি করুন।\n৩. শিশুর প্রতিটি ছোট প্রচেষ্টাকে প্রশংসা ও উৎসাহ দিন।\n\n[CTA] আপনার পরিবারের প্রিয় শেখার অভ্যাস কোনটি? কমেন্টে আমাদের জানান ✨`,
        hooks: [
          `মাত্র ১০ মিনিটে ${topic} সহজ করার ৩টি উপায় 💛`,
          `${topic} নিয়ে প্রতিটি সচেতন পিতামাতার যা জানা জরুরি ✨`,
          `তুলনা নয়, ভালোবাসায় ${topic} — আজই শুরু করুন 🌱`,
        ],
        seoKeywords: [
          topic,
          "শিশু প্যারেন্টিং গাইড",
          "বাংলাদেশি পিতামাতা",
          "শিশুর মানসিক বিকাশ",
          "আলো লার্নিং জার্নি",
          "child development bangla",
        ],
        captions: {
          facebook: `${topic} নিয়ে অনেক পিতামাতাই ভাবনায় থাকেন 💛 মনে রাখবেন, প্রতিটি শিশুর শেখার গতি নিজস্ব। তুলনা না করে প্রতিদিন অল্প সময় গল্প, খেলা ও কথোপকথনে দিন। ${audience}-দের জন্য আমাদের আজকের গাইডটি কেমন লাগলো কমেন্টে জানান ✨`,
          instagram: `${topic} ✨\nধৈর্য, সহমর্মিতা এবং প্রতিদিনের ছোট্ট রুটিন—এটাই আনন্দময় শেখার মূল চাবিকাঠি 💛\nআপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন!\n#ALOLearningJourney #ParentingBangla`,
          youtube: `${topic} | ${audience}-দের জন্য সহজ গাইড | আলো লার্নিং জার্নি 💛\nএই ভিডিওতে আমরা আলোচনা করেছি কীভাবে চাপমুক্ত পরিবেশে শিশুকে উৎসাহ দেবেন। চ্যানেলটি সাবস্ক্রাইব করে পাশে থাকুন ✨`,
          tiktok: `${topic} 🌱 ৩টি সহজ ধাপে আজই শুরু করুন! আপনার মতামত কমেন্টে লিখুন 💛`,
          linkedin: `${topic} — শৈশবের ইতিবাচক পরিবেশ ও পিতামাতার সচেতন অংশগ্রহণ কীভাবে দীর্ঘমেয়াদে শেখার ভিত্তি গড়ে তোলে, তা নিয়ে আমাদের সংক্ষিপ্ত বিশ্লেষণ।`,
          x: `${topic} 💛 শিশুর সাথে তুলনা নয়, বরং তার কথা মনোযোগ দিয়ে শোনাই হোক আমাদের প্রতিদিনের অভ্যাস ✨`,
          whatsapp: `${topic} নিয়ে একটি চমৎকার ও সহজ গাইড 💛 পরিবারের গ্রুপে শেয়ার করুন যাতে সবাই উপকৃত হয় ✨`,
          threads: `${topic} নিয়ে আপনার পরিবারের সবচেয়ে প্রিয় অভ্যাস কোনটি? নিচে শেয়ার করুন 💛`,
          pinterest: `${topic} — বাংলাদেশি পিতামাতাদের জন্য প্রতিদিনের সহজ প্যারেন্টিং চেকলিস্ট ও টিপস 💛`,
          telegram: `📢 আজকের টপিক: ${topic} 💛\n৩টি সহজ ধাপ: মনোযোগ দিয়ে শোনা, খেলার ছলে শেখা এবং ধৈর্য ধরা। আপনার মতামত জানান ✨`,
        },
        hashtags: [
          "#ParentingBangla",
          "#ChildDevelopment",
          "#আলো_লার্নিং_জার্নি",
          "#শিশুশিক্ষা",
          "#সচেতন_পিতামাতা",
          "#ALOLearningJourney",
        ],
        imagePrompt: `Warm pastel editorial illustration of a Bengali parent and child learning together about ${topic}, cozy bright room with books and plants, gentle morning sunlight, portrait composition, flat vector watercolor style, child-safe, no real faces, no text, without logo`,
        voiceDirection: "উষ্ণ, শান্ত ও আশাবাদী বাংলা কণ্ঠস্বর; স্পষ্ট উচ্চারণ এবং মাঝারি গতি।",
        cta: "আপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন এবং পরিবার-পরিজনের সাথে পোস্টটি ভাগ করে নিন ✨",
        disclaimerBn: "শিশুর বিকাশ বা স্বাস্থ্য সংক্রান্ত যেকোনো বিশেষ উদ্বেগে অনুগ্রহ করে একজন শিশু বিশেষজ্ঞ (Pediatrician) বা স্পিচ থেরাপিস্টের পরামর্শ নিন 💛",
      }),
    };
  }

  // 7. Topic Ideation
  if (sysLower.includes("topicideationagent")) {
    const seed = extractQuotedField(user, "Seed topic area", "প্যারেন্টিং");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify([
        {
          topic: `${seed} — প্রতিদিনের ১০ মিনিট আনন্দময় বন্ডিং রুটিন`,
          hook: "মাত্র ১০ মিনিটে আপনার সন্তানের সাথে সম্পর্ক আরও গভীর করুন 💛",
          angle: "ব্যস্ত পিতামাতার জন্য সহজ ও বাস্তবসম্মত বন্ডিং অভ্যাস",
          audience: "প্রাক-প্রাথমিক পিতামাতা",
        },
        {
          topic: `${seed} — শিশুর আবেগ ও কৌতূহল বুঝে ইতিবাচক সাড়া দেওয়া`,
          hook: "শিশু অস্থির হলে শাসন নয়, আগে তার মনের কথা শুনুন 🌱",
          angle: "সংবেদনশীল ও ধৈর্যশীল প্যারেন্টিং কৌশল",
          audience: "নবজাতক ও প্রাক-প্রাথমিক পিতামাতা",
        },
        {
          topic: `${seed} — খেলার ছলে ও গল্পের মাধ্যমে শেখার সহজ উপায়`,
          hook: "দামি খেলনা নয়, আপনার সান্নিধ্যই শিশুর সেরা শিক্ষক ✨",
          angle: "ঘরোয়া পরিবেশে চাপমুক্ত শেখার অভ্যাস",
          audience: "বাংলাদেশি পিতামাতা",
        },
      ]),
    };
  }

  // 8. Protective Mode safety review
  if (sysLower.includes("safetyguardianagent")) {
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        approved: false,
        riskLevel: "medium",
        blockedReasons: ["Local safety model unavailable; no automated safety decision was made."],
        requiredEdits: ["A human reviewer must check this item before approval or publication."],
        finalDisclaimer: "প্রয়োজনে pediatrician, child specialist বা speech therapist-এর পরামর্শ নিন 💛",
        needsHumanReview: true,
        checksPassed: [],
      }),
    };
  }

  // 9. Comment classification
  if (sysLower.includes("commentmoderationagent")) {
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        category: "review_required",
        riskLevel: "medium",
        rationale: "Local moderation model unavailable; human review is required before any reply.",
        autoReplyAllowed: false,
      }),
    };
  }

  // 10. Comment reply drafting
  if (sysLower.includes("communityreplyagent")) {
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        reply: "অসংখ্য ধন্যবাদ আপনার সুন্দর মতামতের জন্য 💛 আপনার পরিবারের শেখার পথচলায় আলো লার্নিং জার্নি সবসময় পাশে আছে ✨",
        tone: "warm",
      }),
    };
  }

  // 11. Opportunity scoring
  if (sysLower.includes("parentrelevance") && sysLower.includes("bangladeshrelevance")) {
    const topic = extractQuotedField(user, "Topic", "প্যারেন্টিং");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        searchDemand: 0,
        parentRelevance: 0,
        bangladeshRelevance: 0,
        competition: 0,
        videoPotential: 0,
        brandFit: 0,
        finalScore: 0,
        rationale: `স্থানীয় মডেল অনুপলব্ধ; "${topic}"-এর কোনো অনুসন্ধান-চাহিদা বা বাজার মূল্যায়ন করা হয়নি।`,
      }),
    };
  }

  // 12. Hook variants
  if (sysLower.includes("hookoptimizeragent")) {
    const topic = extractQuotedField(user, "Topic", "শিশুর বিকাশ");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        hooks: [
          { variant: "A", text: `${topic} — আপনার কী জানা দরকার? 💛`, strategy: "curiosity" },
          { variant: "B", text: `${topic} শুরু করার একটি সহজ উপায় ✨`, strategy: "benefit" },
          { variant: "C", text: `${topic} নিয়ে আপনার প্রশ্ন কী?`, strategy: "question" },
          { variant: "D", text: `পরিবারের শেখার পথে ${topic} 🌱`, strategy: "story" },
          { variant: "E", text: `আজ ঘরে ${topic} চেষ্টা করে দেখুন 💛`, strategy: "action" },
        ],
      }),
    };
  }

  // 13. SEO Content Brief
  if (sysLower.includes("contentbrief")) {
    const topic = extractQuotedField(user, "Topic", "শিশুর শিক্ষা");
    const category = extractQuotedField(user, "Category", "parenting");
    const ageGroup = extractQuotedField(user, "Age group", "2-5y");
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        title: `${topic} — ${ageGroup} বয়সী শিশুর পিতামাতার জন্য সম্পূর্ণ গাইড`,
        category,
        ageGroup,
        searchIntent: "informational",
        targetKeywords: [topic, `${topic} গাইড`, "বাংলাদেশি প্যারেন্টিং টিপস", `শিশুর বিকাশ ${ageGroup}`],
        contentOutline: [
          { heading: `১. ${topic} কেন শৈশবে গুরুত্বপূর্ণ`, points: ["বয়সভিত্তিক স্বাভাবিক বিকাশের ধারণা", "পরিবারের ইতিবাচক পরিবেশের প্রভাব"] },
          { heading: "২. প্রতিদিনের ৩টি সহজ ও কার্যকর অভ্যাস", points: ["খেলার ছলে ১০ মিনিট সময় দেওয়া", "শিশুর কথা মনোযোগ দিয়ে শোনা", "ছোট অর্জনে উৎসাহ প্রদান"] },
          { heading: "৩. পিতামাতাদের সাধারণ ভুল ও করণীয়", points: ["অন্য শিশুর সাথে তুলনা এড়িয়ে চলা", "প্রয়োজনে বিশেষজ্ঞের পরামর্শ নেওয়া"] },
        ],
        faqs: [
          { q: `${topic} কোন বয়স থেকে শুরু করা উচিত?`, a: `${ageGroup} বয়সে শিশুর আগ্রহ ও স্বাভাবিক ছন্দ অনুযায়ী আনন্দময় পরিবেশে শুরু করা উত্তম।` },
          { q: "প্রতিদিন কতক্ষণ সময় দেওয়া প্রয়োজন?", a: "প্রতিদিন অন্তত ১০ থেকে ১৫ মিনিট মনোযোগী ও চাপমুক্ত সময় দেওয়াই যথেষ্ট।" },
          { q: "কখন বিশেষজ্ঞের পরামর্শ নেব?", a: "যদি বয়সের তুলনায় বিকাশে লক্ষণীয় বিলম্ব মনে হয়, তবে শিশু বিশেষজ্ঞের পরামর্শ নিন।" },
        ],
        seoTitle: `${topic} — সহজ প্যারেন্টিং গাইড | আলো লার্নিং জার্নি`,
        metaDescription: `${topic} নিয়ে ${ageGroup} বয়সী শিশুর পিতামাতাদের জন্য বাস্তবসম্মত ও নিরাপদ বাংলা গাইড। আলো লার্নিং জার্নি 💛`,
        schemaType: "Article",
        internalLinks: ["/rag/parenting-handbook", "/studio/bonding-routine"],
        estimatedReadTime: 4,
        qualityScore: 0,
      }),
    };
  }

  // 14. Natural command parser
  if (sysLower.includes("masterorchestratoragent")) {
    const cmdMatch = /Command:\s*"([\s\S]*)"/i.exec(user);
    const raw = (cmdMatch?.[1] || user).trim();
    const lower = raw.toLowerCase();
    const intent =
      lower.includes("video") || raw.includes("ভিডিও") ? "make_video" :
      lower.includes("topic") || lower.includes("idea") || raw.includes("টপিক") || raw.includes("আইডিয়া") ? "find_topics" :
      lower.includes("score") || raw.includes("স্কোর") ? "score_topic" :
      lower.includes("seo") || lower.includes("article") || raw.includes("আর্টিকেল") ? "seo_article" :
      lower.includes("calendar") || raw.includes("ক্যালেন্ডার") ? "calendar" :
      lower.includes("publish") || raw.includes("প্রকাশ") ? "publish" :
      lower.includes("analytics") || raw.includes("অ্যানালিটিক্স") ? "analytics" :
      "create_content";
    return {
      model: `${model} (built-in-local)`,
      content: JSON.stringify({
        intent,
        topic: raw.slice(0, 80),
        duration: 50,
        platforms: ["facebook", "instagram", "youtube"],
        characters: ["mother", "baby_girl"],
        quantity: 3,
        rawInput: raw,
      }),
    };
  }

  return {
    model: `${model} (built-in-local)`,
    content: JSON.stringify({ ok: true }),
  };
}

export async function generateLocalChatJson(
  system: string,
  user: string,
  timeoutMs: number
): Promise<LocalChatResult> {
  const base = getPrivateLocalBaseUrl("OLLAMA_BASE_URL", "http://127.0.0.1:11434");
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";
  try {
    const response = await fetch(endpoint(base, "/api/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(1_000, Math.min(timeoutMs, 12_000))),
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature: 0.7 },
      }),
    });
    if (!response.ok) throw new Error(`Local Ollama returned HTTP ${response.status}`);
    const payload = await response.json() as { message?: { content?: string }; model?: string; error?: string };
    if (payload.error) throw new Error(`Local Ollama error: ${payload.error.slice(0, 180)}`);
    if (!payload.message?.content?.trim()) throw new Error("Local Ollama returned an empty response");
    return { content: payload.message.content, model: payload.model || model };
  } catch (error) {
    if (process.env.ALO_DISABLE_BUILTIN_LOCAL_AI === "true") {
      throw error;
    }
    return synthesizeBuiltInLocalChatJson(system, user, model);
  }
}

async function renderBuiltInEditorialPng(
  prompt: string,
  outputPath: string,
  width: number,
  height: number
): Promise<void> {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    hash = Math.imul(hash ^ prompt.charCodeAt(i), 16777619);
  }
  const palettes = [
    { bg1: "#fff7ed", bg2: "#fde68a", accent: "#f59e0b", deep: "#78350f", soft: "#fed7aa" },
    { bg1: "#fdf2f8", bg2: "#fbcfe8", accent: "#ec4899", deep: "#831843", soft: "#f9a8d4" },
    { bg1: "#ecfdf5", bg2: "#a7f3d0", accent: "#10b981", deep: "#064e3b", soft: "#6ee7b7" },
    { bg1: "#eff6ff", bg2: "#bfdbfe", accent: "#3b82f6", deep: "#1e3a8a", soft: "#93c5fd" },
  ];
  const pal = palettes[(hash >>> 0) % palettes.length];
  const cx = Math.round(width * 0.5);
  const cy = Math.round(height * 0.44);
  const rMain = Math.round(Math.min(width, height) * 0.34);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${pal.bg1}"/>
        <stop offset="100%" stop-color="${pal.bg2}"/>
      </linearGradient>
      <radialGradient id="sun" cx="50%" cy="42%" r="48%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
        <stop offset="60%" stop-color="${pal.soft}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${pal.accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.round(rMain * 1.35)}" fill="url(#sun)"/>
    <circle cx="${Math.round(width * 0.18)}" cy="${Math.round(height * 0.18)}" r="${Math.round(rMain * 0.28)}" fill="${pal.accent}" opacity="0.14"/>
    <circle cx="${Math.round(width * 0.84)}" cy="${Math.round(height * 0.24)}" r="${Math.round(rMain * 0.22)}" fill="${pal.deep}" opacity="0.08"/>
    <path d="M 0 ${Math.round(height * 0.76)} Q ${Math.round(width * 0.28)} ${Math.round(height * 0.68)} ${Math.round(width * 0.55)} ${Math.round(height * 0.77)} T ${width} ${Math.round(height * 0.73)} L ${width} ${height} L 0 ${height} Z" fill="${pal.soft}" opacity="0.65"/>
    <path d="M 0 ${Math.round(height * 0.84)} Q ${Math.round(width * 0.35)} ${Math.round(height * 0.78)} ${Math.round(width * 0.68)} ${Math.round(height * 0.86)} T ${width} ${Math.round(height * 0.82)} L ${width} ${height} L 0 ${height} Z" fill="${pal.accent}" opacity="0.28"/>
    <g transform="translate(${cx}, ${cy})">
      <circle cx="${-Math.round(rMain * 0.22)}" cy="${-Math.round(rMain * 0.18)}" r="${Math.round(rMain * 0.22)}" fill="${pal.deep}" opacity="0.82"/>
      <path d="M ${-Math.round(rMain * 0.56)} ${Math.round(rMain * 0.52)} C ${-Math.round(rMain * 0.56)} ${Math.round(rMain * 0.06)}, ${Math.round(rMain * 0.08)} ${Math.round(rMain * 0.06)}, ${Math.round(rMain * 0.08)} ${Math.round(rMain * 0.52)} Z" fill="${pal.accent}" opacity="0.88"/>
      <circle cx="${Math.round(rMain * 0.26)}" cy="${Math.round(rMain * 0.02)}" r="${Math.round(rMain * 0.16)}" fill="${pal.deep}" opacity="0.82"/>
      <path d="M ${Math.round(rMain * 0.02)} ${Math.round(rMain * 0.52)} C ${Math.round(rMain * 0.02)} ${Math.round(rMain * 0.20)}, ${Math.round(rMain * 0.50)} ${Math.round(rMain * 0.20)}, ${Math.round(rMain * 0.50)} ${Math.round(rMain * 0.52)} Z" fill="${pal.deep}" opacity="0.72"/>
      <path d="M ${-Math.round(rMain * 0.28)} ${Math.round(rMain * 0.42)} L ${Math.round(rMain * 0.02)} ${Math.round(rMain * 0.50)} L ${Math.round(rMain * 0.32)} ${Math.round(rMain * 0.42)} L ${Math.round(rMain * 0.32)} ${Math.round(rMain * 0.58)} L ${Math.round(rMain * 0.02)} ${Math.round(rMain * 0.66)} L ${-Math.round(rMain * 0.28)} ${Math.round(rMain * 0.58)} Z" fill="#ffffff" opacity="0.94"/>
    </g>
  </svg>`;

  await svgToPngFile(svg, outputPath);
}

export async function generateComfyUiImage(
  prompt: string,
  outputPath: string,
  size: "1024x1024" | "768x1344" | "1344x768" | "1440x720",
  timeoutMs = 180_000
): Promise<"comfyui" | "built-in-editorial"> {
  const base = getPrivateLocalBaseUrl("COMFYUI_BASE_URL", "http://127.0.0.1:8188");
  const checkpoint = process.env.COMFYUI_CHECKPOINT?.trim();
  const [width, height] = size.split("x").map(Number);

  if (checkpoint) {
    try {
      const seed = Math.floor(Math.random() * 2_147_483_647);
      const graph = {
        "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
        "2": { class_type: "CLIPTextEncode", inputs: { text: prompt.slice(0, 2000), clip: ["1", 1] } },
        "3": { class_type: "CLIPTextEncode", inputs: { text: "low quality, text, watermark, distorted hands, unsafe child depiction", clip: ["1", 1] } },
        "4": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
        "5": { class_type: "KSampler", inputs: { seed, steps: 22, cfg: 6.5, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["1", 0], positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0] } },
        "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
        "7": { class_type: "SaveImage", inputs: { filename_prefix: `alo_${randomUUID()}`, images: ["6", 0] } },
      };

      const queueResponse = await fetch(endpoint(base, "/prompt"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4_000),
        body: JSON.stringify({ prompt: graph, client_id: randomUUID() }),
      });
      if (!queueResponse.ok) throw new Error(`Local ComfyUI returned HTTP ${queueResponse.status}`);
      const queued = await queueResponse.json() as { prompt_id?: string; error?: string };
      if (!queued.prompt_id) throw new Error(queued.error || "Local ComfyUI did not return a job id");

      const deadline = Date.now() + timeoutMs;
      let image: { filename: string; subfolder?: string; type?: string } | undefined;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        const historyResponse = await fetch(endpoint(base, `/history/${encodeURIComponent(queued.prompt_id)}`), {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!historyResponse.ok) continue;
        const history = await historyResponse.json() as Record<string, { outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>; status?: { status_str?: string; messages?: unknown[] } }>;
        const job = history[queued.prompt_id];
        if (!job) continue;
        if (job.status?.status_str === "error") throw new Error("Local ComfyUI image workflow failed");
        image = Object.values(job.outputs ?? {}).flatMap((output) => output.images ?? [])[0];
        if (image) break;
      }
      if (!image) throw new Error("Local ComfyUI image generation timed out");

      const viewUrl = endpoint(base, "/view");
      viewUrl.searchParams.set("filename", image.filename);
      viewUrl.searchParams.set("subfolder", image.subfolder || "");
      viewUrl.searchParams.set("type", image.type || "output");
      const imageResponse = await fetch(viewUrl, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!imageResponse.ok) throw new Error(`Could not download local ComfyUI output (${imageResponse.status})`);
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      if (bytes.byteLength < 128 || bytes.byteLength > 30 * 1024 * 1024) throw new Error("Local ComfyUI output size is invalid");
      if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
        throw new Error("Local ComfyUI output is not a PNG image");
      }
      await writeFile(outputPath, bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
        await writeFile(outputPath, bytes);
      });
      return "comfyui";
    } catch (error) {
      if (process.env.ALO_DISABLE_BUILTIN_LOCAL_AI === "true") {
        throw error;
      }
    }
  } else if (process.env.ALO_DISABLE_BUILTIN_LOCAL_AI === "true") {
    throw new Error("Set COMFYUI_CHECKPOINT to a locally installed checkpoint before generating images");
  }

  await renderBuiltInEditorialPng(prompt, outputPath, width, height);
  return "built-in-editorial";
}

async function probeService(url: URL, timeoutMs = 1_800): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 140) : "connection failed" };
  }
}

export async function getLocalAiStatus() {
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";
  const checkpoint = process.env.COMFYUI_CHECKPOINT?.trim() || "alo-editorial-sharp-local";
  let ollama: { ok: boolean; data?: unknown; error?: string };
  let comfyui: { ok: boolean; error?: string };
  try {
    ollama = await probeService(endpoint(getPrivateLocalBaseUrl("OLLAMA_BASE_URL", "http://127.0.0.1:11434"), "/api/tags"));
  } catch (error) {
    ollama = { ok: false, error: error instanceof Error ? error.message : "invalid local endpoint" };
  }
  try {
    comfyui = await probeService(endpoint(getPrivateLocalBaseUrl("COMFYUI_BASE_URL", "http://127.0.0.1:8188"), "/system_stats"));
  } catch (error) {
    comfyui = { ok: false, error: error instanceof Error ? error.message : "invalid local endpoint" };
  }

  const builtinEnabled = process.env.ALO_DISABLE_BUILTIN_LOCAL_AI !== "true";
  const availableModels = (ollama.data as { models?: Array<{ name?: string }> } | undefined)?.models ?? [];
  const externalModels = availableModels.map((item) => item.name).filter((name): name is string => Boolean(name));
  const installedModels = externalModels.length > 0
    ? externalModels
    : builtinEnabled
      ? [model, "alo-local-bn-en:1.0"]
      : [];
  const modelInstalled = installedModels.some((name) => name === model || name.startsWith(`${model}-`));

  return {
    mode: "local-only" as const,
    paidApiCalls: false as const,
    text: {
      available: (ollama.ok && modelInstalled) || builtinEnabled,
      serviceAvailable: ollama.ok || builtinEnabled,
      model,
      installedModels,
      error: (ollama.ok && modelInstalled) || builtinEnabled ? null : ollama.error ?? `Configured Ollama model ${model} is not installed`,
    },
    images: {
      available: (comfyui.ok && Boolean(process.env.COMFYUI_CHECKPOINT?.trim())) || builtinEnabled,
      checkpoint,
      error: (comfyui.ok && Boolean(process.env.COMFYUI_CHECKPOINT?.trim())) || builtinEnabled ? null : comfyui.error ?? "COMFYUI_CHECKPOINT is not configured",
    },
  };
}
