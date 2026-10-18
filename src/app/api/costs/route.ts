import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import { AGENTS } from "@/lib/agents";

// CostRouterAgent: per-agent cost breakdown + provider usage stats.
export async function GET() {
  await ensureSeeded();

  // Per-agent cost
  const agentCosts = AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    provider: a.provider,
    model: a.model,
    estimatedCostUsd: a.estimatedCostUsd,
    status: a.status,
  }));

  // Provider breakdown
  const providers: Record<string, { count: number; cost: number; label: string }> = {};
  for (const a of AGENTS) {
    const key = a.provider;
    if (!providers[key]) {
      providers[key] = { count: 0, cost: 0, label: a.provider };
    }
    providers[key].count++;
    providers[key].cost += a.estimatedCostUsd;
  }

  // Category breakdown
  const categories: Record<string, { count: number; cost: number }> = {};
  for (const a of AGENTS) {
    if (!categories[a.category]) categories[a.category] = { count: 0, cost: 0 };
    categories[a.category].count++;
    categories[a.category].cost += a.estimatedCostUsd;
  }

  const totalCost = AGENTS.reduce((s, a) => s + a.estimatedCostUsd, 0);
  const localCount = AGENTS.filter((a) => a.provider === "local").length;
  const externalCount = AGENTS.filter((a) => a.provider === "external-optional").length;
  const llmCount = AGENTS.filter((a) => a.provider === "zai-llm").length;
  const localPct = Math.round((localCount / AGENTS.length) * 100);
  const blockedCount = AGENTS.filter((a) => a.status === "blocked_external_setup").length;

  return NextResponse.json({
    agentCosts,
    providers: Object.values(providers).sort((a, b) => b.cost - a.cost),
    categories: Object.entries(categories).map(([k, v]) => ({ category: k, ...v })).sort((a, b) => b.cost - a.cost),
    summary: {
      totalAgents: AGENTS.length,
      totalCost: Number(totalCost.toFixed(4)),
      localCount,
      externalCount,
      llmCount,
      localPct,
      blockedCount,
      avgCostPerAgent: Number((totalCost / AGENTS.length).toFixed(4)),
    },
  });
}
