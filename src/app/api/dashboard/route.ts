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
    activeCompanyCount,
    commentCount,
    failedRunCount,
    runningRunCount,
    leadCount,
    sensitiveCommentCount,
  ] = await Promise.all([
    db.approvalItem.findMany(),
    db.contentIdea.findMany(),
    db.socialConnection.findMany(),
    db.publishedPost.findMany(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.ragDocument.findMany(),
    db.aIAgentRun.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    db.company.count({ where: { active: true } }),
    db.commentInbox.count(),
    db.aIAgentRun.count({ where: { status: "failed" } }),
    db.aIAgentRun.count({ where: { status: "running" } }),
    db.lead.count(),
    db.commentInbox.count({ where: { category: { in: ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"] } } }),
  ]);

  const connectedPlatforms = connections.filter((c) => c.status === "connected").length;
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;

  // Dashboard metrics are derived only from snapshots captured during the last seven days.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const snaps = await db.analyticsSnapshot.findMany({ where: { capturedAt: { gte: sevenDaysAgo } } });
  const metricValues: Record<string, number[]> = {};
  for (const snapshot of snaps) {
    (metricValues[snapshot.metric] ??= []).push(snapshot.value);
  }
  const metricTotals: Record<string, number> = {};
  for (const [metric, values] of Object.entries(metricValues)) {
    metricTotals[metric] = metric === "retention"
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : values.reduce((sum, value) => sum + value, 0);
  }

  const agentCounts = {
    total: AGENTS.length,
    active: AGENTS.filter((a) => a.status === "active").length,
    blocked: AGENTS.filter((a) => a.status === "blocked_external_setup").length,
    idle: AGENTS.filter((a) => a.status === "idle").length,
  };

  return NextResponse.json({
    widgets: {
      connectedPlatforms,
      activeCompanies: activeCompanyCount,
      activeAgents: agentCounts.active,
      activeWorkers: 0,
      backgroundJobsStatus: "not_configured",
      topicIdeas: ideas.length,
      contentPackages: await db.contentPackage.count(),
      pendingApproval: pendingApprovals,
      runningJobs: runningRunCount,
      publishingQueueCount: published.filter((p) => p.status === "queued").length,
      publishedPosts: published.filter((p) => p.status === "published").length,
      failedRuns: failedRunCount,
      comments: commentCount,
      sensitiveComments: sensitiveCommentCount,
      views: metricTotals.views ?? 0,
      reach: metricTotals.reach ?? 0,
      watchTime: metricTotals.watch_time ?? 0,
      retention: metricTotals.retention ?? 0,
      shares: metricTotals.shares ?? 0,
      saves: metricTotals.saves ?? 0,
      leads: leadCount,
      runCostTelemetry: "not_metered",
      tokenExpiration: connections.filter(
        (c) => c.tokenExpiry && new Date(c.tokenExpiry).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3
      ).length,
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
    recentRuns: agentRuns.map((run) => ({
      id: run.id,
      agentId: run.agentId,
      status: run.status,
      inputBrief: run.inputBrief,
    })),
  });
}
