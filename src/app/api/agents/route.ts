import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";
import { executeAsAgent } from "@/lib/agent-runtime";
import { generateLocalChatJson } from "@/lib/local-models";
import { ensureSeeded } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    agents: AGENTS,
    total: AGENTS.length,
    configured: AGENTS.length,
    active: 0,
    execution: "on-demand; local model availability is checked per run",
    declaredToolsExecutedByGenericAgentRoute: false,
    paidApiCalls: false,
    mode: "local-only",
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: unknown;
    prompt?: unknown;
  };
  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  const customPrompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim()
      : "শিশুর ভাষা বিকাশ ও উচ্চশিক্ষা গাইড — প্রতিদিনের ১৫ মিনিট রুটিন";

  const agentDef = AGENTS.find((a) => a.id === agentId);
  if (!agentDef) {
    return NextResponse.json({ error: `Unknown agentId: ${agentId}` }, { status: 404 });
  }

  const startMs = Date.now();
  const run = await executeAsAgent<{
    agentId: string;
    agentName: string;
    role: string;
    category: string;
    model: string;
    prompt: string;
    output: Record<string, unknown>;
    latencyMs: number;
    estimatedCostUsd: number | null;
    costTelemetry: "not_metered";
    paidApiCalls: boolean;
    usedFallback: boolean;
  }>(
    {
      agentId: agentDef.id,
      task: `${agentDef.name}: ${customPrompt.slice(0, 90)}`,
      input: { prompt: customPrompt, category: agentDef.category },
      tools: agentDef.tools,
      requiresApproval: false,
    },
    async () => {
      const completion = await generateLocalChatJson(
        agentDef.systemPrompt,
        `Task for ${agentDef.name} (${agentDef.role}): "${customPrompt}"`,
        12_000
      );
      const usedFallback = completion.model.includes("(built-in-local)");
      let parsedOutput: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(completion.content);
        parsedOutput =
          typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)
            : { result: parsed };
      } catch {
        parsedOutput = { response: completion.content };
      }

      return {
        data: {
          agentId: agentDef.id,
          agentName: agentDef.name,
          role: agentDef.role,
          category: agentDef.category,
          model: completion.model || agentDef.model,
          prompt: customPrompt,
          output: {
            ...parsedOutput,
            summaryBn: usedFallback
              ? `${agentDef.name}: configured Ollama was unavailable; deterministic built-in fallback output needs human review.`
              : `${agentDef.name} returned a local model response; declared tools were not executed by this route.`,
            declaredTools: agentDef.tools,
            toolsExecuted: [],
          },
          latencyMs: Math.max(8, Date.now() - startMs),
          estimatedCostUsd: null,
          costTelemetry: "not_metered",
          paidApiCalls: false,
          usedFallback,
        },
        provider: usedFallback ? "built-in-local" : "ollama-local",
        usedFallback,
        error: usedFallback ? "The configured local model did not respond; this is template output, not a verified agent completion." : undefined,
      };
    }
  );

  return NextResponse.json({
    ok: run.status === "success",
    runId: run.runId,
    auditId: run.auditId,
    status: run.status,
    ...run.result,
  });
}
