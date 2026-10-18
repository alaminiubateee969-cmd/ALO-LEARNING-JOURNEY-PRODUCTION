import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateEmailMarketingDraft } from "@/lib/ai";
import { recordAgentPipelineStages } from "@/lib/agent-runtime";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const draft = typeof body.draft === "string" ? body.draft.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience.trim() : "";
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  if (!draft || draft.length > 8_000 || !audience || audience.length > 500 || !objective || objective.length > 500) {
    return NextResponse.json({ error: "draft (1–8,000 chars), audience, and objective (max 500 chars each) are required" }, { status: 400 });
  }

  const result = await generateEmailMarketingDraft(draft, audience, objective);
  await recordAgentPipelineStages("email marketing draft", result.qualityPipeline ?? []);
  await db.auditLog.create({
    data: {
      actor: "admin",
      action: "marketing.email_draft_refine",
      detail: `Email draft ${result.usedFallback ? "kept as local fallback" : "revised through prompts to the same local model"}; ${result.qualityPipeline?.length ?? 0} prompt-stage records; no independent compliance review and no email sent.`,
      severity: result.usedFallback ? "warn" : "info",
    },
  });

  return NextResponse.json({
    draft: result.data.draft,
    provider: result.provider,
    usedFallback: result.usedFallback,
    latencyMs: result.latencyMs,
    qualityPipeline: result.qualityPipeline ?? [],
    status: result.usedFallback ? "fallback_draft_only" : "refined_draft_only",
    humanReviewRequired: true,
    deliveryEnabled: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
