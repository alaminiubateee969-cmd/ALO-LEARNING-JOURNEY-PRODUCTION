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

  const stats = {
    totalOpportunities: opportunities.length,
    approvedOpportunities: opportunities.filter((o) => o.approved).length,
    avgScore: opportunities.length > 0
      ? Math.round(opportunities.reduce((s, o) => s + o.finalScore, 0) / opportunities.length)
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

  // Score a topic for content opportunity — uses executeAsAgent
  if (body.action === "score_topic") {
    const agentResult = await executeAsAgent(
      { agentId: "trend_research", task: `Score topic: ${body.topic?.slice(0, 40)}`, tools: ["llm.score"] },
      async () => {
        const result = await scoreContentOpportunity(body.topic);
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
            approved: result.data.finalScore >= 80,
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
          created.push({ ...ht, strategy: hook.strategy, predictedRetention: hook.predictedRetention });
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

  // Create a campaign — no LLM, just DB
  if (body.action === "create_campaign") {
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
