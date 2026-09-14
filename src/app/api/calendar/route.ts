import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// Content Calendar: returns posts for a given month organized by day.
// Query: ?year=2026&month=0  (month is 0-indexed)
export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth());

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  // Fetch all posts that were scheduled or published in this month
  const posts = await db.publishedPost.findMany({
    where: {
      OR: [
        { scheduledAt: { gte: startOfMonth, lte: endOfMonth } },
        { publishedAt: { gte: startOfMonth, lte: endOfMonth } },
        { createdAt: { gte: startOfMonth, lte: endOfMonth } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // Organize by day of month
  const byDay: Record<number, typeof posts> = {};
  for (const p of posts) {
    const date = p.scheduledAt ?? p.publishedAt ?? p.createdAt;
    const day = new Date(date).getDate();
    if (new Date(date).getMonth() === month && new Date(date).getFullYear() === year) {
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(p);
    }
  }

  // Calendar grid info
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return NextResponse.json({
    year,
    month,
    monthName,
    firstDay,
    daysInMonth,
    byDay,
    totalPosts: posts.length,
    today: now.toISOString(),
  });
}
