import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";

// This endpoint exposes static configuration counts, not cost or usage telemetry.
export async function GET() {
  const agentConfigs = AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    category: agent.category,
    provider: agent.provider,
    model: agent.model,
    status: agent.status,
  }));

  const providers = Array.from(new Set(AGENTS.map((agent) => agent.provider)))
    .map((label) => ({ label, count: AGENTS.filter((agent) => agent.provider === label).length }))
    .sort((a, b) => b.count - a.count);

  const categories = Array.from(new Set(AGENTS.map((agent) => agent.category)))
    .map((category) => ({ category, count: AGENTS.filter((agent) => agent.category === category).length }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    agentConfigs,
    providers,
    categories,
    summary: {
      totalDefinitions: AGENTS.length,
      localCount: AGENTS.filter((agent) => agent.provider === "local").length,
      externalOptionalCount: AGENTS.filter((agent) => agent.provider === "external-optional").length,
      paidApiRoutesConfigured: 0,
      costTelemetry: "not_metered",
    },
    message: "Provider and category totals count static definitions only. This endpoint does not meter API calls, provider invoices, infrastructure, storage, or electricity.",
  });
}
