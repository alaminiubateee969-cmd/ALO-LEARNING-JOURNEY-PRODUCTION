import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateContentBrief } from "@/lib/ai";

// Generate SEO content brief with LLM
export async function POST(req: Request) {
  await ensureSeeded();

  // ALO Agent Runtime — creates traceable AgentRun
  const agentRun = await db.aIAgentRun.create({
    data: {
      agentId: "seo",
      status: "running",
      inputBrief: "Generate SEO content brief",
      startedAt: new Date(),
    },
  });

  const { topic, category, ageGroup } = await req.json().catch(() => ({
    topic: "Untitled", category: "parenting", ageGroup: "1-2y",
  }));

  const result = await generateContentBrief(topic, category, ageGroup);

  await db.auditLog.create({
    data: {
      actor: "SEO_AI",
      action: "content_brief.generate",
      detail: `Brief draft for "${topic}" (${category}/${ageGroup}) — ${result.usedFallback ? "fallback template" : "model output"} via ${result.provider}; no independent SEO, fact, safety, or quality review was run`,
      severity: result.usedFallback ? "warn" : "info",
    },
  });


  await db.aIAgentRun.update({
    where: { id: agentRun.id },
    data: {
      status: result.usedFallback ? "blocked_external_setup" : "success",
      errorMsg: result.usedFallback ? (result.error ?? "Fallback draft requires human review.").slice(0, 500) : null,
      finishedAt: new Date(),
    },
  });
  await db.auditLog.create({
    data: {
      actor: "seo",
      action: "agent.generate_seo_content_brief",
      detail: `AgentRun ${agentRun.id}: Generate SEO content brief → ${result.usedFallback ? "blocked_external_setup (fallback draft)" : "success"}`,
      severity: result.usedFallback ? "warn" : "info",
    },
  });

  return NextResponse.json({
    brief: result.data,
    provider: result.provider,
    usedFallback: result.usedFallback,
    agentStatus: result.usedFallback ? "blocked" : "success",
    publishReady: false,
    requiresHumanReview: true,
  });
}
