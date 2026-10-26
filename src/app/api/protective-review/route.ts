import { NextResponse } from "next/server";
import { runProtectiveMode } from "@/lib/ai";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { executeAsAgent } from "@/lib/agent-runtime";

type SafetySuggestion = {
  approved: false;
  riskLevel: "low" | "medium" | "high";
  blockedReasons: string[];
  requiredEdits: string[];
  finalDisclaimer: string;
  needsHumanReview: true;
  checksPassed: [];
  modelRecommendation: "approve" | "revise" | "unavailable";
  modelChecksReported: string[];
  reviewMode: "unverified_model_suggestion";
};

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => null) as { content?: unknown; type?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const type = typeof body?.type === "string" ? body.type.trim().slice(0, 80) : "content";
  if (!content || content.length > 20_000) {
    return NextResponse.json({ error: "content_must_contain_1_to_20000_characters" }, { status: 400 });
  }

  const agent = await executeAsAgent<SafetySuggestion>(
    {
      agentId: "safety_guardian_prompt",
      task: "Generate an unverified safety-review suggestion",
      input: { type, contentLength: content.length },
      tools: ["configured-content-model"],
      requiresApproval: false,
    },
    async () => {
      const result = await runProtectiveMode(content, type);
      const riskLevel = ["low", "medium", "high"].includes(result.data.riskLevel)
        ? result.data.riskLevel
        : "medium";
      const modelChecksReported = !result.usedFallback && Array.isArray(result.data.checksPassed)
        ? result.data.checksPassed.filter((check): check is string => typeof check === "string")
        : [];
      const review: SafetySuggestion = {
        // A model recommendation is never treated as a safety approval.
        approved: false,
        riskLevel,
        blockedReasons: result.usedFallback
          ? ["Automated review unavailable; no safety decision was made."]
          : Array.isArray(result.data.blockedReasons)
            ? result.data.blockedReasons.filter((reason): reason is string => typeof reason === "string")
            : [],
        requiredEdits: result.usedFallback
          ? ["A human reviewer must assess the content before approval or publication."]
          : Array.isArray(result.data.requiredEdits)
            ? result.data.requiredEdits.filter((edit): edit is string => typeof edit === "string")
            : [],
        finalDisclaimer: typeof result.data.finalDisclaimer === "string" ? result.data.finalDisclaimer : "",
        needsHumanReview: true,
        checksPassed: [],
        modelRecommendation: result.usedFallback ? "unavailable" : result.data.approved ? "approve" : "revise",
        modelChecksReported,
        reviewMode: "unverified_model_suggestion",
      };
      await db.auditLog.create({
        data: {
          actor: "admin",
          action: "protective_mode.prompt_suggestion",
          detail: `Unverified model suggestion for ${type}; fallback=${result.usedFallback}; recommendation=${review.modelRecommendation}; never a safety approval.`,
          severity: "warn",
        },
      });
      return {
        data: review,
        provider: result.provider,
        error: result.error,
        usedFallback: result.usedFallback,
      };
    }
  );

  if (agent.status === "failed") {
    return NextResponse.json({ error: agent.error || "unverified_review_suggestion_failed", agentRunId: agent.runId }, { status: 500 });
  }

  return NextResponse.json({
    review: agent.result,
    provider: agent.provider,
    usedFallback: agent.status === "blocked",
    independentSafetyReview: false,
    agentStatus: agent.status,
    agentRunId: agent.runId,
  }, { headers: { "Cache-Control": "no-store" } });
}
