import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/departments";
import { AGENT_CATALOG } from "@/lib/agentos-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HIGH_RISK = [
  /\b(?:deploy|publish|launch|send|broadcast|whatsapp|payment|pay|purchase|shell|command|dns|delete|remove|replace|scrape|clone|voice clone|face|real person|install|server|firewall|credential|secret|api key)\b/i,
];
const NEW_CAPABILITY = /\b(?:create|build|add|train)\b.{0,50}\b(?:agent|skill|workflow|model)\b/i;
const PAID_INTENT = /\b(?:paid api|openai|anthropic api|paid model|billing|purchase credits)\b/i;

function slug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { command?: unknown } | null;
  if (!body || typeof body.command !== "string" || !body.command.trim()) {
    return NextResponse.json({ error: "command_required" }, { status: 400 });
  }
  const command = body.command.trim().slice(0, 8000);
  const isRisky = HIGH_RISK.some((pattern) => pattern.test(command)) || NEW_CAPABILITY.test(command);
  const paidBlocked = PAID_INTENT.test(command);
  const normalizedCommand = command.toLowerCase();
  const department = DEPARTMENTS.find((item) => normalizedCommand.includes(item.name.toLowerCase())) ??
    DEPARTMENTS.find((item) => item.name.toLowerCase().split(/[^a-z0-9]+/).some((word) => word.length >= 3 && normalizedCommand.includes(word))) ??
    null;
  const relevant = department
    ? AGENT_CATALOG.filter((agent) => agent.department_name === department.name).slice(0, 10)
    : [];
  const requestId = randomUUID();
  let approvalId: string | null = null;

  if (isRisky && !paidBlocked) {
    const approval = await db.approvalItem.create({
      data: {
        topic: command.slice(0, 60),
        type: "content",
        title: "AgentOS owner review required",
        summary: `Planning-only request ${requestId}. No agent, skill, workflow, shell command, deployment, publication, payment, or external action was executed. Review the requested operation before implementation.\n\nRequest: ${command.slice(0, 3000)}`,
        riskLevel: "high",
        blockedReasons: JSON.stringify(["explicit_owner_approval_required", "planning_only_no_tools_executed"]),
        status: "pending",
      },
    });
    approvalId = approval.id;
  }

  const status = paidBlocked ? "blocked_paid_api" : isRisky ? "pending_owner_approval" : "plan_only";
  await db.auditLog.create({
    data: {
      actor: "AgentOSCommandPlanner",
      action: "agentos.command.plan",
      detail: `request=${requestId}; status=${status}; matched_department=${department?.name ?? "none"}; no tool execution`,
      severity: paidBlocked ? "warn" : isRisky ? "warn" : "info",
    },
  });

  return NextResponse.json({
    request_id: requestId,
    status,
    command,
    matched_department: department?.name ?? null,
    matched_agents: relevant.map(({ id, name, slug: agentSlug, status: agentStatus }) => ({ id, name, slug: agentSlug, status: agentStatus })),
    suggested_skill_category: department ? slug(department.name) : null,
    approval_id: approvalId,
    paid_api_used: false,
    tool_execution: false,
    note: paidBlocked
      ? "Paid API use is disallowed. No provider was called and no task was executed."
      : "This endpoint creates a plan and audit/approval record only. It does not run agents, skills, shell commands, workflows, or external actions.",
  }, { status: paidBlocked ? 403 : 200, headers: { "Cache-Control": "no-store" } });
}
