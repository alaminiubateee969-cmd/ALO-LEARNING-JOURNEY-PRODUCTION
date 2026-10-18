import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateContentBrief } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

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
      detail: `Brief for "${topic}" (${category}/${ageGroup}) — score ${result.data.qualityScore}/100 via ${result.provider}`,
      severity: "info",
    },
  });


  // Update AgentRun with success
  await db.aIAgentRun.update({
    where: { id: agentRun.id },
    data: { status: "success", finishedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      actor: "seo",
      action: "agent.generate_seo_content_brief",
      detail: `AgentRun ${agentRun.id}: Generate SEO content brief → success`,
      severity: "info",
    },
  });

  return NextResponse.json({
    brief: result.data,
    provider: result.provider,
    usedFallback: result.usedFallback,
    publishReady: result.data.qualityScore >= 85,
  });
}
