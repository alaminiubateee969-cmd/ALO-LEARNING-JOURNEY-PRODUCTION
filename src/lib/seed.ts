// ALO Learning Journey — DB seed (server-only)
// Seeds a single demo company + sample operational data if DB is empty.
// The 40-agent roster is static (src/lib/agents.ts) — not stored in DB.

import { db } from "./db";
import { PLATFORMS } from "./platforms";

let seeded = false;

export async function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  const companyCount = await db.company.count();
  if (companyCount > 0) {
    // Already seeded in a previous run — but make sure newer collections
    // (e.g. CommentInbox added in round 2) are backfilled if empty.
    await backfillComments();
    return;
  }

  const company = await db.company.create({
    data: {
      name: "ALO Education",
      domain: "learn.aloeducation.com",
      plan: "growth",
      active: true,
    },
  });

  // Additional demo companies for multi-tenant switcher
  await db.company.createMany({
    data: [
      { name: "Shishu Bikash", domain: "shishubikash.bd", plan: "starter", active: true },
      { name: "Parenting Hub BD", domain: "parentinghub.bd", plan: "enterprise", active: true },
      { name: "Koler Aalo Foundation", domain: null, plan: "growth", active: false },
    ],
    
  });

  // Social connections from platform registry
  for (const p of PLATFORMS) {
    await db.socialConnection.create({
      data: {
        platform: p.id,
        accountName: p.connected ? `${p.name} Official` : `${p.name} (pending)`,
        handle: p.id === "facebook" ? "aloeducation" : null,
        status: p.connected ? "connected" : "external_setup_required",
        tokenExpiry: p.connected
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 12)
          : null,
        lastSyncAt: p.connected ? new Date(Date.now() - 1000 * 60 * 30) : null,
      },
    });
  }

  // Sample content ideas
  const ideas = [
    { topic: "১৮ মাসের শিশুর ভাষা বিকাশ", hook: "প্রথম শব্দটি আগে হয়, নাকি পরে? 💛", angle: "ভাষা বিকাশের বাস্তব সময়রেখা", audience: "নবজাতক-পিতামাতা" },
    { topic: "স্ক্রিন টাইম কমানোর উপায়", hook: "৫ দিনে স্ক্রিন টাইম অর্ধেক করুন 🌱", angle: "বাস্তব ও ধীরে ধীরে কমানো", audience: "প্রাক-প্রাথমিক পিতামাতা" },
    { topic: "শিশুর ঘুমের রুটিন", hook: "ঘুমের রুটিন = শান্ত সন্ধ্যা ✨", angle: "রুটিন তৈরির ৩ ধাপ", audience: "নবজাতক-পিতামাতা" },
    { topic: "রাগ করলে শিশুকে শান্ত করা", hook: "রাগের সময় এই এক বাক্য বলুন 💛", angle: "সংবেদনশীল সাড়া", audience: "পিতামাতা" },
  ];
  for (const idea of ideas) {
    await db.contentIdea.create({ data: { ...idea, status: "idea" } });
  }

  // Sample approval items
  const approvals = [
    { topic: "ভাষা বিকাশে মায়ের ভূমিকা", type: "content", title: "Reel + ক্যাপশন প্যাকেজ #001", summary: "৩ হুক, রিল স্ক্রিপ্ট, ১০ প্ল্যাটফর্ম ক্যাপশন, ইমেজ প্রম্পট", riskLevel: "low", status: "pending" },
    { topic: "স্ক্রিন টাইম কমানো", type: "content", title: "Shorts প্যাকেজ #002", summary: "৩০ সেকেন্ড স্ক্রিপ্ট, সাবটাইটেল, থাম্বনেইল", riskLevel: "low", status: "pending" },
    { topic: "শিশুর ঘুম", type: "image", title: "ইমেজ ভ্যারিয়েন্ট #003", summary: "৫ প্ল্যাটফর্ম সাইজ, লোকাল পোস্টার", riskLevel: "low", status: "pending" },
    { topic: "রাগ শান্ত করা", type: "comment", title: "সংবেদনশীল মন্তব্য উত্তর #004", summary: "মেডিক্যাল সংবেদনশীল — মানব পর্যালোচনা দরকার", riskLevel: "high", status: "pending" },
  ];
  for (const a of approvals) {
    await db.approvalItem.create({
      data: {
        ...a,
        blockedReasons: a.riskLevel === "high" ? JSON.stringify(["medical_sensitive"]) : null,
        requiredEdits: a.riskLevel === "high" ? JSON.stringify(["Add pediatrician disclaimer"]) : null,
      },
    });
  }

  // Sample RAG docs
  const docs = [
    { title: "Parenting Handbook v2", sourceType: "pdf", content: "পিতামাতার জন্য সংবেদনশীল প্যারেন্টিংয়ের গাইড। শিশুকে শোনা, বোঝা এবং ধৈর্য ধরে রাখাই আসল ভিত্তি। তুলনা এড়িয়ে চলুন এবং প্রতিটি মাইলস্টোন উদ্ভাবন হিসেবে দেখুন।", tags: ["parenting", "handbook"] },
    { title: "Child Development Milestones", sourceType: "docx", content: "শিশুর বিকাশের মাইলস্টোন — ০ থেকে ৫ বছর। ভাষা, সামাজিক, মোটর ও জ্ঞানীয় বিকাশের সাধারণ সময়রেখা। প্রতিটি শিশু আলাদা গতিতে এগোয়।", tags: ["milestones", "development"] },
    { title: "Brand Safety Policy", sourceType: "policy", content: "আলো ব্র্যান্ড কখনো fear-based, parent-shaming, বা guaranteed-outcome কনটেন্ট তৈরি করে না। মেডিক্যাল দাবির ক্ষেত্রে pediatrician-এর পরামর্শ নেওয়ার ডিসক্লেইমার যুক্ত করুন।", tags: ["policy", "safety"] },
    { title: "FAQ — স্ক্রিন টাইম", sourceType: "faq", content: "স্ক্রিন টাইম কত হওয়া উচিত? ২ বছরের কম বয়সীদের জন্য স্ক্রিন এড়িয়ে চলুন। ২-৫ বছরে দিনে ১ ঘণ্টার বেশি নয়, এবং সেটি পিতামাতার সাথে দেখুন।", tags: ["screentime", "faq"] },
  ];
  for (const d of docs) {
    await db.ragDocument.create({
      data: {
        title: d.title,
        sourceType: d.sourceType,
        content: d.content,
        tagsJson: JSON.stringify(d.tags),
        chunkCount: 2,
      },
    });
  }

  // Sample analytics snapshots (last 7 days)
  const platforms = ["facebook", "instagram", "youtube", "tiktok", "whatsapp"];
  const metrics: Record<string, number[]> = {
    views: [1200, 1800, 2400, 2100, 2900, 3300, 4100],
    reach: [2400, 3100, 3900, 3700, 4800, 5200, 6300],
    watch_time: [180, 220, 260, 240, 300, 340, 410],
    retention: [62, 65, 67, 64, 70, 72, 75],
    shares: [40, 55, 70, 65, 88, 102, 130],
    saves: [30, 42, 58, 50, 72, 85, 110],
    leads: [5, 8, 12, 10, 15, 18, 24],
    comments: [22, 30, 38, 35, 48, 55, 70],
    followers: [820, 910, 1010, 1090, 1210, 1320, 1480],
  };
  for (const p of platforms) {
    for (const [metric, values] of Object.entries(metrics)) {
      values.forEach((v, i) => {
        const day = new Date(Date.now() - (6 - i) * 1000 * 60 * 60 * 24);
        db.analyticsSnapshot
          .create({
            data: { platform: p, metric, value: Math.round(v * (0.7 + Math.random() * 0.6)), capturedAt: day },
          })
          .catch(() => {});
      });
    }
  }

  // Sample telegram commands + audit logs + notifications
  await db.telegramCommand.createMany({
    data: [
      { command: "/ideas", senderId: "8847234", status: "executed", response: "৩টি নতুন আইডিয়া তৈরি হয়েছে" },
      { command: "/status", senderId: "8847234", status: "executed", response: "৪টি আইটেম অনুমোদনের অপেক্ষায়" },
      { command: "/approve 004", senderId: "9999999", status: "rejected", response: "Unauthorized chat ID" },
    ],
  });
  await db.auditLog.createMany({
    data: [
      { actor: "admin", action: "login", detail: "Admin logged in from cPanel", severity: "info" },
      { actor: "system", action: "rag.ingest", detail: "Ingested 4 documents", severity: "info" },
      { actor: "SafetyGuardianAgent", action: "protective_mode.run", detail: "Blocked 1 fear-based hook", severity: "warn" },
      { actor: "system", action: "token.refresh", detail: "Instagram token refreshed", severity: "info" },
      { actor: "system", action: "queue.batch", detail: "Cron batch: 10 light jobs completed", severity: "info" },
    ],
  });
  await db.notification.createMany({
    data: [
      { title: "নতুন অনুমোদনের অনুরোধ", body: "৪টি কনটেন্ট প্যাকেজ অনুমোদনের অপেক্ষায়", kind: "info" },
      { title: "সংবেদনশীল মন্তব্য", body: "১টি মেডিক্যাল-সংবেদনশীল মন্তব্য মানব পর্যালোচনায়", kind: "warn" },
      { title: "TikTok সংযোগ বাকি", body: "TikTok OAuth external_setup_required", kind: "warn" },
    ],
  });
  // Sample published posts + scheduled/queued posts for Publishing Queue
  await db.publishedPost.createMany({
    data: [
      { platform: "facebook", providerPostId: "fb_882133", url: "https://facebook.com/aloeducation/posts/882133", topic: "ভাষা বিকাশ", status: "published", publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 20) },
      { platform: "instagram", providerPostId: "ig_551209", url: "https://instagram.com/p/Cx8821", topic: "স্ক্রিন টাইম", status: "published", publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 44) },
      { platform: "youtube", providerPostId: "yt_v9k2", url: "https://youtube.com/shorts/v9k2", topic: "ঘুমের রুটিন", status: "published", publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 70) },
      // Scheduled posts (future)
      { platform: "facebook", topic: "রাগ শান্ত করার কৌশল", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 3) },
      { platform: "instagram", topic: "প্রথম দিনের স্কুল প্রস্তুতি", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 8) },
      { platform: "youtube", topic: "মায়ের মানসিক স্বাস্থ্য", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 26) },
      { platform: "tiktok", topic: "খেলার মাধ্যমে শেখা", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 30) },
      // Queued (awaiting publish approval)
      { platform: "whatsapp", topic: "ঘুমের রুটিন টিপস", status: "queued" },
      { platform: "telegram", topic: "সাপ্তাহিক আইডিয়া", status: "queued" },
      // Failed
      { platform: "linkedin", topic: "প্যারেন্টিং ও ক্যারিয়ার", status: "failed" },
    ],
  });
  // Sample comment inbox (CommentModerationAgent domain)
  await db.commentInbox.createMany({
    data: [
      { platform: "facebook", authorName: "রিয়া আক্তার", authorHandle: "@riya", text: "অসাধারণ ভিডিও! আমার মেয়েও এখন এই রুটিন মানছে 💛", postTopic: "ঘুমের রুটিন", category: "praise", riskLevel: "low", status: "new" },
      { platform: "instagram", authorName: "তানভীর", authorHandle: "@tanvir", text: "আপনারা কি বলেন — ২ বছরের শিশু এখনো কথা বলে না, কী করব?", postTopic: "ভাষা বিকাশ", category: "development_sensitive", riskLevel: "high", status: "new" },
      { platform: "youtube", authorName: "অজ্ঞাত", text: "এই ভিডিওতে যা বলা হয়েছে তা সম্পূর্ণ ভুল, ডাক্তারি পরামর্শ ছাড়া বলবেন না", postTopic: "স্ক্রিন টাইম", category: "medical_sensitive", riskLevel: "high", status: "new" },
      { platform: "tiktok", authorName: "সুমাইয়া", text: "ভালো লেগেছে, শেয়ার করলাম 🌱", postTopic: "প্যারেন্টিং", category: "praise", riskLevel: "low", status: "new" },
      { platform: "facebook", authorName: "বট ইউজার", text: "জিতে যান ১ লাখ টাকা এখনই ক্লিক করুন http://spam.example", postTopic: "ঘুমের রুটিন", category: "spam", riskLevel: "medium", status: "new" },
      { platform: "instagram", authorName: "নাদিয়া", text: "এই টপিকের উপর আরও ভিডিও চাই", postTopic: "ভাষা বিকাশ", category: "question", riskLevel: "low", status: "new" },
      { platform: "youtube", authorName: "অসন্তুষ্ট", text: "এত সময় কোথায় পাব? বাস্তবসম্মত নয়", postTopic: "স্ক্রিন টাইম", category: "complaint", riskLevel: "medium", status: "new" },
      { platform: "whatsapp", authorName: "ফারজানা", text: "ধন্যবাদ, খুব কাজে লেগেছে 💛", postTopic: "প্যারেন্টিং", category: "praise", riskLevel: "low", status: "replied", draftReply: "ধন্যবাদ ফারজানা! আপনার অভিজ্ঞতা শেয়ার করায় আনন্দিত 💛", repliedAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    ],
  });
}

// Backfill CommentInbox for DBs seeded before round 2 (idempotent).
async function backfillComments() {
  try {
    // Backfill demo companies for the multi-tenant switcher (check by name)
    const existing = await db.company.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((c) => c.name));
    const demoCompanies = [
      { name: "Shishu Bikash", domain: "shishubikash.bd", plan: "starter", active: true },
      { name: "Parenting Hub BD", domain: "parentinghub.bd", plan: "enterprise", active: true },
      { name: "Koler Aalo Foundation", domain: null, plan: "growth", active: false },
    ];
    for (const c of demoCompanies) {
      if (!existingNames.has(c.name)) {
        await db.company.create({ data: c });
      }
    }

    // Backfill scheduled/queued posts for the Publishing Queue (round 8)
    const postCount = await db.publishedPost.count();
    if (postCount <= 3) {
      await db.publishedPost.createMany({
        data: [
          { platform: "facebook", topic: "রাগ শান্ত করার কৌশল", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 3) },
          { platform: "instagram", topic: "প্রথম দিনের স্কুল প্রস্তুতি", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 8) },
          { platform: "youtube", topic: "মায়ের মানসিক স্বাস্থ্য", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 26) },
          { platform: "tiktok", topic: "খেলার মাধ্যমে শেখা", status: "scheduled", scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 30) },
          { platform: "whatsapp", topic: "ঘুমের রুটিন টিপস", status: "queued" },
          { platform: "telegram", topic: "সাপ্তাহিক আইডিয়া", status: "queued" },
          { platform: "linkedin", topic: "প্যারেন্টিং ও ক্যারিয়ার", status: "failed" },
        ],
      });
    }

    const count = await db.commentInbox.count();
    if (count > 0) return;
    await db.commentInbox.createMany({
      data: [
        { platform: "facebook", authorName: "রিয়া আক্তার", authorHandle: "@riya", text: "অসাধারণ ভিডিও! আমার মেয়েও এখন এই রুটিন মানছে 💛", postTopic: "ঘুমের রুটিন", category: "praise", riskLevel: "low", status: "new" },
        { platform: "instagram", authorName: "তানভীর", authorHandle: "@tanvir", text: "আপনারা কি বলেন — ২ বছরের শিশু এখনো কথা বলে না, কী করব?", postTopic: "ভাষা বিকাশ", category: "development_sensitive", riskLevel: "high", status: "new" },
        { platform: "youtube", authorName: "অজ্ঞাত", text: "এই ভিডিওতে যা বলা হয়েছে তা সম্পূর্ণ ভুল, ডাক্তারি পরামর্শ ছাড়া বলবেন না", postTopic: "স্ক্রিন টাইম", category: "medical_sensitive", riskLevel: "high", status: "new" },
        { platform: "tiktok", authorName: "সুমাইয়া", text: "ভালো লেগেছে, শেয়ার করলাম 🌱", postTopic: "প্যারেন্টিং", category: "praise", riskLevel: "low", status: "new" },
        { platform: "facebook", authorName: "বট ইউজার", text: "জিতে যান ১ লাখ টাকা এখনই ক্লিক করুন http://spam.example", postTopic: "ঘুমের রুটিন", category: "spam", riskLevel: "medium", status: "new" },
        { platform: "instagram", authorName: "নাদিয়া", text: "এই টপিকের উপর আরও ভিডিও চাই", postTopic: "ভাষা বিকাশ", category: "question", riskLevel: "low", status: "new" },
        { platform: "youtube", authorName: "অসন্তুষ্ট", text: "এত সময় কোথায় পাব? বাস্তবসম্মত নয়", postTopic: "স্ক্রিন টাইম", category: "complaint", riskLevel: "medium", status: "new" },
        { platform: "whatsapp", authorName: "ফারজানা", text: "ধন্যবাদ, খুব কাজে লেগেছে 💛", postTopic: "প্যারেন্টিং", category: "praise", riskLevel: "low", status: "replied", draftReply: "ধন্যবাদ ফারজানা! আপনার অভিজ্ঞতা শেয়ার করায় আনন্দিত 💛", repliedAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
      ],
    });
  } catch {
    // ignore — table may not exist yet
  }
}
