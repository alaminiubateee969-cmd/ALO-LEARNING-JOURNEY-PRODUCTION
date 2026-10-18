// ALO Learning Journey — Agent Runtime
// This wrapper persists an AgentRun/audit record around the callback supplied
// by a route. It does not schedule background work or execute AgentTask.tools;
// those are declarations only. Callbacks may return fallback drafts, so status
// and provider fields must reflect what actually ran.

import { db } from "./db";

export interface AgentTask {
  agentId: string;
  task: string;
  input?: Record<string, any>;
  tools?: string[];
  priority?: "low" | "normal" | "high" | "urgent";
  requiresApproval?: boolean;
}

export interface AgentPipelineStageReport {
  agentId: string;
  role: string;
  status: "complete" | "fallback" | "skipped";
  provider: string;
  latencyMs: number;
  scoreBefore?: number;
  scoreAfter?: number;
  summary: string;
}

export interface AgentRunResult<T = any> {
  runId: string;
  agentId: string;
  status: "success" | "failed" | "pending_approval" | "blocked";
  result: T;
  error?: string;
  provider?: string;
  durationMs: number;
  auditId: string;
}

/**
 * Run the caller-supplied callback and persist its actual outcome.
 * AgentTask.tools is descriptive metadata only; this function does not execute
 * tools, provide an autonomous worker, or validate model output.
 */
export async function executeAsAgent<T>(
  task: AgentTask,
  fn: () => Promise<{ data: T; provider?: string; error?: string; usedFallback?: boolean }>
): Promise<AgentRunResult<T>> {
  const startTime = Date.now();

  // 1. CREATE AgentRun record (pending)
  const run = await db.aIAgentRun.create({
    data: {
      agentId: task.agentId,
      status: "running",
      inputBrief: task.task,
      startedAt: new Date(),
    },
  });

  try {
    // 2. EXECUTE the actual task function
    const execResult = await fn();
    const durationMs = Date.now() - startTime;

    const dataReportsFallback = Boolean(
      execResult.data && typeof execResult.data === "object" &&
      "usedFallback" in execResult.data && (execResult.data as { usedFallback?: unknown }).usedFallback === true
    );
    const usedFallback = execResult.usedFallback === true || dataReportsFallback;
    const persistedStatus = usedFallback ? "blocked_external_setup" : "success";

    // A deterministic/template fallback can return useful draft data, but it is
    // not evidence that the configured agent or provider completed the task.
    await db.aIAgentRun.update({
      where: { id: run.id },
      data: {
        status: persistedStatus,
        outputJson: JSON.stringify(execResult.data).slice(0, 2000),
        errorMsg: usedFallback ? (execResult.error ?? "Configured local provider unavailable; fallback output requires human review.").slice(0, 500) : null,
        finishedAt: new Date(),
        costEstUsd: 0, // paid AI APIs are disabled; infrastructure costs are not measured here
      },
    });

    // 4. CREATE audit log
    const audit = await db.auditLog.create({
      data: {
        actor: task.agentId,
        action: `agent.${task.task.slice(0, 50).replace(/\s+/g, "_").toLowerCase()}`,
        detail: `AgentRun ${run.id}: ${task.task} → ${usedFallback ? "blocked_external_setup (fallback output)" : "success"} via ${execResult.provider ?? "local"} (${durationMs}ms)`,
        severity: usedFallback ? "warn" : "info",
      },
    });

    // 5. If approval required, create approval item
    if (task.requiresApproval) {
      await db.approvalItem.create({
        data: {
          topic: task.task.slice(0, 60),
          type: task.agentId.includes("video") ? "video" : task.agentId.includes("image") ? "image" : "content",
          title: `Agent: ${task.agentId} — ${task.task.slice(0, 40)}`,
          summary: `AgentRun ${run.id} output pending approval`,
          riskLevel: "low",
          status: "pending",
        },
      });
    }

    return {
      runId: run.id,
      agentId: task.agentId,
      status: usedFallback ? "blocked" : "success",
      result: execResult.data,
      error: usedFallback ? execResult.error ?? "Fallback output is not a verified agent completion." : undefined,
      provider: execResult.provider,
      durationMs,
      auditId: audit.id,
    };
  } catch (e: any) {
    const durationMs = Date.now() - startTime;

    // Update AgentRun with failure
    await db.aIAgentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMsg: (e.message || "").slice(0, 500),
        finishedAt: new Date(),
      },
    });

    // Create audit log for failure
    const audit = await db.auditLog.create({
      data: {
        actor: task.agentId,
        action: `agent.${task.task.slice(0, 50).replace(/\s+/g, "_").toLowerCase()}.failed`,
        detail: `AgentRun ${run.id}: ${task.task} → FAILED: ${(e.message || "").slice(0, 200)}`,
        severity: "error",
      },
    });

    return {
      runId: run.id,
      agentId: task.agentId,
      status: "failed",
      result: null as T,
      error: e.message,
      durationMs,
      auditId: audit.id,
    };
  }
}

/**
 * Get agent run history for traceability.
 */
/** Persist the real completion/fallback state of each sequential creative pass. */
export async function recordAgentPipelineStages(taskLabel: string, stages: AgentPipelineStageReport[]) {
  const finishedAt = new Date();
  for (const stage of stages) {
    const latencyMs = Math.max(0, Math.min(300_000, Math.round(stage.latencyMs)));
    const startedAt = new Date(finishedAt.getTime() - latencyMs);
    const status = stage.status === "complete" ? "success" : "blocked_external_setup";
    const run = await db.aIAgentRun.create({
      data: {
        agentId: stage.agentId,
        status,
        inputBrief: `${taskLabel}: ${stage.role}`.slice(0, 500),
        outputJson: JSON.stringify({ provider: stage.provider, status: stage.status, scoreBefore: stage.scoreBefore, scoreAfter: stage.scoreAfter }).slice(0, 1_000),
        errorMsg: stage.status === "complete" ? null : stage.summary.slice(0, 500),
        startedAt,
        finishedAt,
        costEstUsd: 0,
      },
    });
    await db.auditLog.create({
      data: {
        actor: stage.agentId,
        action: "agent.creative_pipeline_stage",
        detail: `AgentRun ${run.id}: ${stage.role} ${stage.status} via ${stage.provider}; rubric ${stage.scoreBefore ?? "—"} → ${stage.scoreAfter ?? "—"}`.slice(0, 1_000),
        severity: stage.status === "complete" ? "info" : "warn",
      },
    });
  }
}

export async function getAgentRuns(agentId?: string, limit = 20) {
  return db.aIAgentRun.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get agent health: success rate, last run, avg duration.
 */
export async function getAgentHealth(agentId: string) {
  const runs = await db.aIAgentRun.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (runs.length === 0) {
    return { agentId, status: "idle", successRate: 0, lastRun: null, avgDurationMs: 0 };
  }

  const successes = runs.filter((r) => r.status === "success").length;
  const lastRun = runs[0];
  const avgDuration = runs
    .filter((r) => r.startedAt && r.finishedAt)
    .reduce((s, r) => s + (r.finishedAt!.getTime() - r.startedAt!.getTime()), 0) /
    Math.max(1, runs.filter((r) => r.startedAt && r.finishedAt).length);

  return {
    agentId,
    status: lastRun.status === "failed" || lastRun.status === "blocked_external_setup" ? "warning" : "active",
    successRate: Math.round((successes / runs.length) * 100),
    lastRun: lastRun.createdAt,
    avgDurationMs: Math.round(avgDuration),
    totalRuns: runs.length,
  };
}
