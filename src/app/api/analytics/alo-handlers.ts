import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const snapshots = await db.analyticsSnapshot.findMany({
    where: { capturedAt: { gte: sevenDaysAgo } },
    orderBy: { capturedAt: "asc" },
  });

  const byPlatform: Record<string, Record<string, { day: string; value: number }[]>> = {};
  const valuesByMetric: Record<string, number[]> = {};
  for (const snapshot of snapshots) {
    if (!byPlatform[snapshot.platform]) byPlatform[snapshot.platform] = {};
    if (!byPlatform[snapshot.platform][snapshot.metric]) byPlatform[snapshot.platform][snapshot.metric] = [];
    byPlatform[snapshot.platform][snapshot.metric].push({
      day: snapshot.capturedAt.toISOString().slice(0, 10),
      value: snapshot.value,
    });
    (valuesByMetric[snapshot.metric] ??= []).push(snapshot.value);
  }

  const totals: Record<string, number> = {};
  for (const [metric, values] of Object.entries(valuesByMetric)) {
    totals[metric] = metric === "retention"
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : values.reduce((sum, value) => sum + value, 0);
  }

  const publishedPosts = await db.publishedPost.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    byPlatform,
    totals,
    publishedPosts,
    generatedAt: new Date().toISOString(),
    providerAnalyticsFetched: false,
    deliveryVerified: false,
    message: "Metrics are sums/averages of stored snapshot values from the last seven days; source, completeness, and provider origin are not independently verified. Published posts are database records, not verified provider deliveries.",
  });
}
