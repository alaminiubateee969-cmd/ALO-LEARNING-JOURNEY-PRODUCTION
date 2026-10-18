import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const snaps = await db.analyticsSnapshot.findMany();
  // group by platform -> metric -> series
  const byPlatform: Record<string, Record<string, { day: string; value: number }[]>> = {};
  for (const s of snaps) {
    if (!byPlatform[s.platform]) byPlatform[s.platform] = {};
    if (!byPlatform[s.platform][s.metric]) byPlatform[s.platform][s.metric] = [];
    byPlatform[s.platform][s.metric].push({
      day: s.capturedAt.toISOString().slice(5, 10),
      value: s.value,
    });
  }
  // totals
  const totals: Record<string, number> = {};
  for (const s of snaps) totals[s.metric] = (totals[s.metric] ?? 0) + s.value;

  const published = await db.publishedPost.findMany();
  return NextResponse.json({ byPlatform, totals, publishedPosts: published });
}
