import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { AGENTS } from "@/lib/agents";
import { PLATFORMS } from "@/lib/platforms";

export async function GET() {
  await ensureSeeded();
  const [
    approvals,
    ideas,
    connections,
    published,
    audit,
    notifications,
    ragDocs,
    agentRuns,
  ] = await Promise.all([
    db.approvalItem.findMany(),
    db.contentIdea.findMany(),
    db.socialConnection.findMany(),
    db.publishedPost.findMany(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.ragDocument.findMany(),
    db.aIAgentRun.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const connectedPlatforms = connections.filter((c) => c.status === "connected").length;
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const sensitiveComments = approvals.filter(
    (a) => a.type === "comment" && a.riskLevel === "high"
  ).length;

  // Analytics totals (sum of latest snapshot per metric)
  const snaps = await db.analyticsSnapshot.findMany();
  const metricTotals: Record<string, number> = {};
  for (const s of snaps) {
    metricTotals[s.metric] = (metricTotals[s.metric] ?? 0) + s.value;
  }

  const agentCounts = {
    total: AGENTS.length,
    active: AGENTS.filter((a) => a.status === "active").length,
    blocked: AGENTS.filter((a) => a.status === "blocked_external_setup").length,
    idle: AGENTS.filter((a) => a.status === "idle").length,
  };

  const failedJobs = agentRuns.filter((r) => r.status === "failed").length;
  const renderingJobs = AGENTS.filter(
    (a) => a.category === "media" && a.status === "blocked_external_setup"
  ).length;

  return NextResponse.json({
    widgets: {
      connectedPlatforms,
      activeCompanies: 1,
      activeAgents: agentCounts.active,
      topicIdeas: ideas.length,
      contentPackages: await db.contentPackage.count(),
      pendingApproval: pendingApprovals,
      renderingJobs,
      publishingJobs: published.filter((p) => p.status === "queued").length,
      publishedPosts: published.filter((p) => p.status === "published").length,
      failedJobs,
      comments: 0,
      sensitiveComments,
      views: metricTotals.views ?? 0,
      reach: metricTotals.reach ?? 0,
      watchTime: metricTotals.watch_time ?? 0,
      retention: metricTotals.retention ?? 0,
      shares: metricTotals.shares ?? 0,
      saves: metricTotals.saves ?? 0,
      leads: metricTotals.leads ?? 0,
      whatsappJoins: 42,
      apiCostUsd: AGENTS.reduce((s, a) => s + a.estimatedCostUsd, 0).toFixed(3),
      localModelUsage: Math.round(
        (AGENTS.filter((a) => a.provider === "local").length / AGENTS.length) * 100
      ),
      providerFailures: AGENTS.filter((a) => a.status === "blocked_external_setup").length,
      tokenExpiration: connections.filter(
        (c) => c.tokenExpiry && new Date(c.tokenExpiry).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3
      ).length,
      cronHealth: "healthy",
      storageUsageMb: 184,
    },
    agentCounts,
    platforms: PLATFORMS.map((p) => ({
      ...p,
      connection: connections.find((c) => c.platform === p.id),
    })),
    approvals: approvals.slice(0, 6),
    audit,
    notifications,
    ragDocCount: ragDocs.length,
    recentRuns: agentRuns,
  });
}
