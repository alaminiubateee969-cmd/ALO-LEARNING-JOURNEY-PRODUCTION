import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGENT_CATALOG, AGENTOS_POLICY, PRIVATE_SKILL_COUNT, SKILLS_PER_CATEGORY } from "@/lib/agentos-catalog";
import { DEPARTMENTS } from "@/lib/departments";
import { AGENTS } from "@/lib/agents";
import { isExternalAiAllowed } from "@/lib/agentos/payment-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [registeredAgents, agentRuns, pendingApprovals] = await Promise.all([
    db.agentEmployee.count().catch(() => 0),
    db.aIAgentRun.count().catch(() => 0),
    db.approvalItem.count({ where: { status: "pending" } }).catch(() => 0),
  ]);
  return NextResponse.json({
    server_status: "ok",
    departments_count: DEPARTMENTS.length,
    agents_count: AGENT_CATALOG.length,
    agents_catalog_status: "generated_scaffold_not_active_workers",
    active_core_agents_count: AGENTS.length,
    database_registered_agents_count: registeredAgents,
    agent_runs_count: agentRuns,
    skills_count: PRIVATE_SKILL_COUNT,
    skills_per_category: SKILLS_PER_CATEGORY,
    skills_status: "private_generated_scaffolds_pending_validation_and_owner_approval",
    approved_skills_count: 0,
    quarantined_skills_count: 0,
    workflows_count: 0,
    workflows_status: "no_generic_agentos_workflow_registry_yet",
    approvals_pending_count: pendingApprovals,
    ollama_status: process.env.OLLAMA_BASE_URL ? "configured_status_not_probed" : "not_configured_or_default_local_endpoint",
    qdrant_status: process.env.QDRANT_URL ? "configured_not_probed" : "not_configured",
    n8n_status: process.env.N8N_BASE_URL ? "configured_not_probed" : "not_configured",
    protection_mode_enabled: AGENTOS_POLICY.protection_mode_enabled,
    payment_guard_enabled: AGENTOS_POLICY.payment_guard_enabled,
    self_improvement_enabled: AGENTOS_POLICY.self_improvement_enabled,
    productivity_mode_enabled: AGENTOS_POLICY.productivity_mode_enabled,
    private_skills_only: AGENTOS_POLICY.private_skills_only,
    public_skills_disabled: AGENTOS_POLICY.public_skills_disabled,
    paid_api_allowed: isExternalAiAllowed(),
    paid_api_server_switches_enabled: isExternalAiAllowed(),
    owner_approval_required_for_risky_action: true,
    local_ai_execution_verified: false,
    note: "Counts describe catalog scaffolds and current app records, not 2,000 running autonomous model agents or 20,000 individually authored/approved executable skills.",
  }, { headers: { "Cache-Control": "no-store" } });
}
