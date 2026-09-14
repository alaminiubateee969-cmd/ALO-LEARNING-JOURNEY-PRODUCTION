// ALO Learning Journey — Agent Runtime
// This is the MISSING LINK: wraps every AI/media operation in an agent-owned
// execution context. Every operation that an "ALO Agent" performs must go
// through this runtime, creating an AgentRun record with full traceability:
// agentId, task, status, provider, result, audit.

import { db } from "./db";

export interface AgentTask {
  agentId: string;
  task: string;
  input?: Record<string, any>;
  tools?: string[];
  priority?: "low" | "normal" | "high" | "urgent";
  requiresApproval?: boolean;
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
 * Execute a task as an ALO Agent — creates an AgentRun record before
 * execution, runs the task function, then updates the record with
 * the result. Every execution is fully traceable.
 *
 * This is what makes an operation "ALO-owned agent work" rather than
 * just "a direct API call to a provider".
 */
export async function executeAsAgent<T>(
  task: AgentTask,
  fn: () => Promise<{ data: T; provider?: string; error?: string }>
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

    // 3. UPDATE AgentRun with success
    await db.aIAgentRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        outputJson: JSON.stringify(execResult.data).slice(0, 2000),
        finishedAt: new Date(),
        costEstUsd: 0.01, // estimated
      },
    });

    // 4. CREATE audit log
    const audit = await db.auditLog.create({
      data: {
        actor: task.agentId,
        action: `agent.${task.task.slice(0, 50).replace(/\s+/g, "_").toLowerCase()}`,
        detail: `AgentRun ${run.id}: ${task.task} → success via ${execResult.provider ?? "local"} (${durationMs}ms)`,
        severity: "info",
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
      status: "success",
      result: execResult.data,
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
    status: lastRun.status === "failed" ? "warning" : "active",
    successRate: Math.round((successes / runs.length) * 100),
    lastRun: lastRun.createdAt,
    avgDurationMs: Math.round(avgDuration),
    totalRuns: runs.length,
  };
}
