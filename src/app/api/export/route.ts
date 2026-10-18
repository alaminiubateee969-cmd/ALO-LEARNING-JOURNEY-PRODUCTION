import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// Export data as CSV or JSON. Supports: packages | comments | analytics | posts
export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "packages";
  const format = searchParams.get("format") ?? "json";

  let rows: Record<string, any>[] = [];
  let filename = `${type}_export`;

  if (type === "packages") {
    const items = await db.contentPackage.findMany({ orderBy: { createdAt: "desc" } });
    rows = items.map((p) => ({
      id: p.id,
      topic: p.topic,
      qualityScore: p.qualityScore,
      safetyStatus: p.safetyStatus,
      cta: p.cta,
      reelScript: p.reelScript.slice(0, 100),
      hooksCount: p.hooksJson ? JSON.parse(p.hooksJson).length : 0,
      captionsCount: p.captionsJson ? Object.keys(JSON.parse(p.captionsJson)).length : 0,
      createdAt: p.createdAt,
    }));
  } else if (type === "comments") {
    const items = await db.commentInbox.findMany({ orderBy: { createdAt: "desc" } });
    rows = items.map((c) => ({
      id: c.id,
      platform: c.platform,
      authorName: c.authorName,
      authorHandle: c.authorHandle ?? "",
      text: c.text,
      postTopic: c.postTopic ?? "",
      category: c.category,
      riskLevel: c.riskLevel,
      status: c.status,
      createdAt: c.createdAt,
      repliedAt: c.repliedAt ?? "",
    }));
  } else if (type === "analytics") {
    const items = await db.analyticsSnapshot.findMany({ orderBy: { capturedAt: "desc" } });
    rows = items.map((s) => ({
      id: s.id,
      platform: s.platform,
      metric: s.metric,
      value: s.value,
      capturedAt: s.capturedAt,
    }));
  } else if (type === "posts") {
    const items = await db.publishedPost.findMany({ orderBy: { createdAt: "desc" } });
    rows = items.map((p) => ({
      id: p.id,
      platform: p.platform,
      topic: p.topic,
      status: p.status,
      providerPostId: p.providerPostId ?? "",
      url: p.url ?? "",
      createdAt: p.createdAt,
      publishedAt: p.publishedAt ?? "",
      scheduledAt: p.scheduledAt ?? "",
    }));
  }

  if (format === "csv") {
    if (rows.length === 0) {
      return new NextResponse("No data", { status: 404 });
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h];
            const s = v instanceof Date ? v.toISOString() : String(v ?? "");
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // JSON
  return NextResponse.json({ type, count: rows.length, rows });
}
