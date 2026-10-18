import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { scoreContentOpportunity, generateHookVariants } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

export async function GET() {
  await ensureSeeded();
  const [opportunities, hookTests, campaigns] = await Promise.all([
    db.contentOpportunityScore.findMany({ orderBy: { finalScore: "desc" }, take: 20 }),
    db.hookTest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const evaluatedOpportunities = opportunities.filter((opportunity) => opportunity.provider !== "local-fallback");
  const stats = {
    totalOpportunities: opportunities.length,
    evaluatedOpportunities: evaluatedOpportunities.length,
    approvedOpportunities: opportunities.filter((o) => o.approved).length,
    avgScore: evaluatedOpportunities.length > 0
      ? Math.round(evaluatedOpportunities.reduce((sum, opportunity) => sum + opportunity.finalScore, 0) / evaluatedOpportunities.length)
      : 0,
    activeHookTests: hookTests.filter((h) => h.status === "testing").length,
    hookWinners: hookTests.filter((h) => h.isWinner).length,
    activeCampaigns: campaigns.filter((c) => c.status === "in_production" || c.status === "published").length,
    measuredCampaigns: campaigns.filter((c) => c.status === "measured" || c.status === "learned").length,
    totalViews: campaigns.reduce((s, c) => s + c.views, 0),
    totalFollowerGain: campaigns.reduce((s, c) => s + c.followerGain, 0),
    avgAudienceRelevance: campaigns.length > 0
      ? Math.round(campaigns.reduce((s, c) => s + c.audienceRelevance, 0) / campaigns.length)
      : 0,
  };

  return NextResponse.json({ opportunities, hookTests, campaigns, stats });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));

  // Score a topic for content opportunity — this is a model estimate, not live search analytics.
  if (body.action === "score_topic") {
    if (typeof body.topic !== "string" || !body.topic.trim() || body.topic.trim().length > 200) {
      return NextResponse.json({ error: "topic must contain 1–200 characters" }, { status: 400 });
    }
    const topic = body.topic.trim();
    const agentResult = await executeAsAgent(
      { agentId: "trend_research", task: `Score topic: ${topic.slice(0, 40)}`, tools: ["llm.score"] },
      async () => {
        const result = await scoreContentOpportunity(topic);
        const score = await db.contentOpportunityScore.create({
          data: {
            topic: body.topic,
            searchDemand: result.data.searchDemand,
            parentRelevance: result.data.parentRelevance,
            bangladeshRelevance: result.data.bangladeshRelevance,
            competition: result.data.competition,
            videoPotential: result.data.videoPotential,
            brandFit: result.data.brandFit,
            finalScore: result.data.finalScore,
            rationale: result.data.rationale,
            approved: false, // scoring is advisory; only the explicit admin action below can approve
            provider: result.provider,
          },
        });
        return { data: { score, provider: result.provider, usedFallback: result.usedFallback }, provider: result.provider };
      }
    );
    return NextResponse.json({
      ...agentResult.result,
      agentRunId: agentResult.runId,
      agentId: agentResult.agentId,
      agentStatus: agentResult.status,
      auditId: agentResult.auditId,
    });
  }

  // Human approval is explicit; an opportunity score never approves itself.
  if (body.action === "approve_opportunity") {
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ error: "opportunity id required" }, { status: 400 });
    }
    const existing = await db.contentOpportunityScore.findUnique({ where: { id: body.id.trim() } });
    if (!existing) return NextResponse.json({ error: "opportunity_not_found" }, { status: 404 });
    const approved = await db.contentOpportunityScore.update({
      where: { id: existing.id },
      data: { approved: true },
    });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "content_opportunity.approve",
        detail: `Manually approved content opportunity ${approved.id} after administrator review.`,
        severity: "info",
      },
    });
    return NextResponse.json({ opportunity: approved });
  }

  // Generate hook variants — uses executeAsAgent
  if (body.action === "generate_hooks") {
    const agentResult = await executeAsAgent(
      { agentId: "hook_optimizer", task: `Generate hooks for: ${body.topic?.slice(0, 40)}`, tools: ["llm.hooks"] },
      async () => {
        const result = await generateHookVariants(body.topic, 5);
        const created: Array<Record<string, unknown>> = [];
        for (const hook of result.data.hooks) {
          const ht = await db.hookTest.create({
            data: { topic: body.topic, hookText: hook.text, variant: hook.variant, status: "draft" },
          });
          created.push({ ...ht, strategy: hook.strategy });
        }
        return { data: { hooks: created, provider: result.provider, usedFallback: result.usedFallback }, provider: result.provider };
      }
    );
    return NextResponse.json({
      ...agentResult.result,
      agentRunId: agentResult.runId,
      agentId: agentResult.agentId,
      agentStatus: agentResult.status,
      auditId: agentResult.auditId,
    });
  }

  // Record hook test performance data — no LLM, just DB update
  if (body.action === "record_hook_performance" && body.id) {
    const updated = await db.hookTest.update({
      where: { id: body.id },
      data: {
        impressions: body.impressions ?? 0,
        hookRetention: body.hookRetention ?? 0,
        watchTime: body.watchTime ?? 0,
        completion: body.completion ?? 0,
        status: "completed",
        testedAt: new Date(),
      },
    });
    return NextResponse.json({ hook: updated });
  }

  // Declare a hook winner — no LLM, just DB query
  if (body.action === "declare_winner" && body.topic) {
    const hooks = await db.hookTest.findMany({ where: { topic: body.topic, status: "completed" } });
    if (hooks.length === 0) {
      return NextResponse.json({ error: "No completed hooks to evaluate" }, { status: 400 });
    }
    const winner = hooks.reduce((best, h) => h.hookRetention > best.hookRetention ? h : best);
    await db.hookTest.update({ where: { id: winner.id }, data: { isWinner: true, status: "winner" } });
    for (const h of hooks) {
      if (h.id !== winner.id) {
        await db.hookTest.update({ where: { id: h.id }, data: { status: "completed" } });
      }
    }
    await db.auditLog.create({
      data: { actor: "WeeklyLearningAgent", action: "hook.winner_declared", detail: `Winner for "${body.topic}": Variant ${winner.variant} (${winner.hookRetention}%)`, severity: "info" },
    });
    return NextResponse.json({ winner });
  }

  // Create a campaign — linked opportunities must first be manually approved.
  if (body.action === "create_campaign") {
    if (body.opportunityId != null) {
      const opportunity = await db.contentOpportunityScore.findUnique({ where: { id: String(body.opportunityId) } });
      if (!opportunity) return NextResponse.json({ error: "opportunity_not_found" }, { status: 404 });
      if (!opportunity.approved) {
        return NextResponse.json({ error: "opportunity_requires_manual_approval" }, { status: 409 });
      }
    }
    const campaign = await db.campaign.create({
      data: {
        title: body.title || body.topic?.slice(0, 40) || "Untitled Campaign",
        topic: body.topic || "",
        opportunityId: body.opportunityId ?? null,
        status: "planned",
        platformCount: body.platformCount ?? 10,
        totalAssets: body.totalAssets ?? 20,
      },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "campaign.create", detail: `Created campaign "${campaign.title}"`, severity: "info" },
    });
    return NextResponse.json({ campaign });
  }

  // Record campaign performance — no LLM, just DB
  if (body.action === "record_performance" && body.id) {
    const updated = await db.campaign.update({
      where: { id: body.id },
      data: {
        views: body.views ?? 0, reach: body.reach ?? 0, engagement: body.engagement ?? 0,
        followerGain: body.followerGain ?? 0, audienceRelevance: body.audienceRelevance ?? 0,
        conversionRate: body.conversionRate ?? 0, status: "measured", measuredAt: new Date(),
        lesson: body.lesson ?? null,
      },
    });
    return NextResponse.json({ campaign: updated });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
