import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// WeeklyLearningAgent: analyses the last 7 days of analytics + published posts
// and derives recommendations. Never auto-rewrites safety/brand rules.
export async function GET() {
  await ensureSeeded();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const snaps = await db.analyticsSnapshot.findMany({
    where: { capturedAt: { gte: since } },
  });
  const posts = await db.publishedPost.findMany({
    where: { status: "published", publishedAt: { gte: since } },
  });
  const comments = await db.commentInbox.findMany();

  // Aggregate per platform
  const byPlatform: Record<string, Record<string, number>> = {};
  for (const s of snaps) {
    if (!byPlatform[s.platform]) byPlatform[s.platform] = {};
    byPlatform[s.platform][s.metric] = (byPlatform[s.platform][s.metric] ?? 0) + s.value;
  }

  // Totals
  const totals: Record<string, number> = {};
  for (const s of snaps) totals[s.metric] = (totals[s.metric] ?? 0) + s.value;

  // Best platform by views
  let bestPlatform = "—";
  let bestPlatformViews = 0;
  for (const [p, m] of Object.entries(byPlatform)) {
    if ((m.views ?? 0) > bestPlatformViews) {
      bestPlatformViews = m.views ?? 0;
      bestPlatform = p;
    }
  }

  // Engagement rate (likes+comments+shares+saves / reach)
  const engagement = totals.reach > 0
    ? (((totals.shares ?? 0) + (totals.saves ?? 0) + (totals.comments ?? 0)) / totals.reach * 100)
    : 0;

  // Sensitive comment rate
  const sensitiveCount = comments.filter((c) =>
    ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"].includes(c.category)
  ).length;
  const sensitiveRate = comments.length > 0 ? (sensitiveCount / comments.length * 100) : 0;

  // Day-of-week performance (derive from snapshots)
  const dayPerf: Record<string, number> = {};
  for (const s of snaps) {
    if (s.metric === "views") {
      const day = s.capturedAt.toLocaleDateString("en-US", { weekday: "short" });
      dayPerf[day] = (dayPerf[day] ?? 0) + s.value;
    }
  }
  let bestDay = "—";
  let bestDayViews = 0;
  for (const [d, v] of Object.entries(dayPerf)) {
    if (v > bestDayViews) { bestDayViews = v; bestDay = d; }
  }

  // Recommendations (never auto-rewrite safety rules)
  const recommendations: { title: string; detail: string; priority: "high" | "medium" | "low"; icon: string }[] = [];
  if (bestPlatform !== "—") {
    recommendations.push({
      title: `${bestPlatform} আপনার সেরা প্ল্যাটফর্ম`,
      detail: `গত ৭ দিনে সর্বোচ্চ ভিউ (${bestPlatformViews.toLocaleString()}) এখানে। এই প্ল্যাটফর্মে পোস্টিং ফ্রিকোয়েন্সি বাড়ান।`,
      priority: "high",
      icon: "🏆",
    });
  }
  if (engagement < 5) {
    recommendations.push({
      title: "এনগেজমেন্ট বাড়ান",
      detail: `এনগেজমেন্ট রেট ${engagement.toFixed(1)}% — কম। প্রতিটি পোস্টে স্পষ্ট CTA এবং প্রশ্ন যোগ করুন।`,
      priority: "high",
      icon: "💬",
    });
  } else {
    recommendations.push({
      title: "এনগেজমেন্ট ভালো",
      detail: `এনগেজমেন্ট রেট ${engagement.toFixed(1)}% — ধরে রাখুন। সেরা হুক পুনরায় ব্যবহার করুন।`,
      priority: "medium",
      icon: "✨",
    });
  }
  if (bestDay !== "—") {
    recommendations.push({
      title: `${bestDay} সেরা দিন`,
      detail: `${bestDay}-এ সর্বোচ্চ ভিউ। আগামী সপ্তাহে এই দিনে প্রিমিয়াম কনটেন্ট প্রকাশ করুন।`,
      priority: "medium",
      icon: "📅",
    });
  }
  if (sensitiveRate > 20) {
    recommendations.push({
      title: "সংবেদনশীল মন্তব্য বেশি",
      detail: `${sensitiveRate.toFixed(0)}% মন্তব্য সংবেদনশীল। মেডিক্যাল/ডেভেলপমেন্টাল টপিকে আরও সতর্কতা ও ডিসক্লেইমার যোগ করুন।`,
      priority: "high",
      icon: "⚠️",
    });
  }
  recommendations.push({
    title: "হুক A/B টেস্টিং",
    detail: "প্রতিটি টপিকের ৩টি হুক আলাদা প্ল্যাটফর্মে টেস্ট করুন এবং ৩-সেকেন্ড ভিউ রেট তুলনা করুন।",
    priority: "medium",
    icon: "🎯",
  });
  recommendations.push({
    title: "প্রিমিয়ার টাইম অপ্টিমাইজ",
    detail: "বাংলাদেশি দর্শকদের জন্য সন্ধ্যা ৭–৯টা প্রাইম টাইম। সেভ করা কনটেন্ট তখন প্রকাশ করুন।",
    priority: "low",
    icon: "🕒",
  });

  return NextResponse.json({
    period: "৭ দিন",
    totals,
    byPlatform,
    bestPlatform,
    bestPlatformViews,
    engagement: Number(engagement.toFixed(2)),
    sensitiveRate: Number(sensitiveRate.toFixed(1)),
    bestDay,
    bestDayViews,
    publishedCount: posts.length,
    recommendations,
  });
}
