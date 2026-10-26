import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import { generateNarrationScript } from "@/lib/ai";
import { recordAgentPipelineStages } from "@/lib/agent-runtime";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  await ensureSeeded();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const requestedAudience = typeof body.audience === "string" ? body.audience.trim() : "";
  const audience = requestedAudience || "বাংলাদেশি পিতামাতা";
  if (!topic || topic.length > 240 || audience.length > 300) {
    return NextResponse.json({ error: "topic (1–240 characters) and audience (max 300 characters) are required" }, { status: 400 });
  }

  const result = await generateNarrationScript(topic, audience);
  const qualityPipeline = result.qualityPipeline ?? [];
  await recordAgentPipelineStages("voice narration script", qualityPipeline);
  await db.auditLog.create({
    data: {
      actor: "voice_scriptwriter",
      action: "voice.narration_script_draft",
      detail: `Narration script ${result.usedFallback ? "kept as local fallback" : "revised through prompts to the same local model"}; ${qualityPipeline.length} prompt-stage records; no speech synthesized.`,
      severity: result.usedFallback ? "warn" : "info",
    },
  });

  return NextResponse.json({
    title: result.data.title,
    lines: result.data.lines,
    text: result.data.lines.join("\n"),
    provider: result.provider,
    usedFallback: result.usedFallback,
    qualityPipeline,
    humanReviewRequired: true,
    speechGenerated: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
