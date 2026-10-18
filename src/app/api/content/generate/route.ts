import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateContentPackage } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

type GeneratedContentResult = {
  pkg: unknown;
  full: Awaited<ReturnType<typeof generateContentPackage>>["data"];
  provider: string;
  usedFallback: boolean;
  latencyMs: number;
};

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => null) as { topic?: unknown; audience?: unknown } | null;
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const audience = typeof body?.audience === "string" ? body.audience.trim() : "";
  if (!topic || topic.length > 240 || !audience || audience.length > 300) {
    return NextResponse.json({ error: "topic (1–240 characters) and audience (1–300 characters) are required" }, { status: 400 });
  }

  const agent = await executeAsAgent<GeneratedContentResult>(
    {
      agentId: "content_writer",
      task: "Generate a content package draft",
      input: { topic, audience },
      tools: ["configured-content-model", "stored-document-context"],
      requiresApproval: false,
    },
    async () => {
      // This is not query-ranked RAG: the first three stored documents are
      // supplied as context. Citations are filtered by exact stored title.
      const docs = await db.ragDocument.findMany({ take: 3 });
      const ragContext = docs
        .map((doc, index) => `[${index + 1}] ${doc.title} (${doc.sourceType}): ${doc.content.slice(0, 220)}`)
        .join("\n\n");
      const result = await generateContentPackage(
        topic,
        audience,
        ragContext,
        docs.map((doc) => ({ title: doc.title, type: doc.sourceType }))
      );

      const pkg = await db.contentPackage.create({
        data: {
          topic,
          reelScript: result.data.reelScript,
          hooksJson: JSON.stringify(result.data.hooks),
          seoKeywords: JSON.stringify(result.data.seoKeywords),
          captionsJson: JSON.stringify(result.data.captions),
          hashtagsJson: JSON.stringify(result.data.hashtags),
          imagePrompt: result.data.imagePrompt,
          voiceDirection: result.data.voiceDirection,
          cta: result.data.cta,
          disclaimerBn: result.data.disclaimerBn,
          qualityScore: 0,
          safetyStatus: "pending",
          ragCitations: JSON.stringify(result.data.ragCitations),
        },
      });

      await db.approvalItem.create({
        data: {
          packageId: pkg.id,
          topic,
          type: "content",
          title: `কনটেন্ট প্যাকেজ — ${topic.slice(0, 40)}`,
          summary: `রিল স্ক্রিপ্ট + ${Object.keys(result.data.captions).length} প্ল্যাটফর্ম ক্যাপশন + হুক + ইমেজ প্রম্পট; human review required`,
          riskLevel: "medium",
          status: "pending",
        },
      });

      await db.auditLog.create({
        data: {
          actor: "admin",
          action: "content.generate",
          detail: `Draft package ${pkg.id} for topic ${topic.slice(0, 120)} via ${result.provider}; fallback=${result.usedFallback}; no independent fact, quality, or safety review was run.`,
          severity: result.usedFallback ? "warn" : "info",
        },
      });

      return {
        data: {
          pkg,
          full: result.data,
          provider: result.provider,
          usedFallback: result.usedFallback,
          latencyMs: result.latencyMs,
        },
        provider: result.provider,
        error: result.error,
        usedFallback: result.usedFallback,
      };
    }
  );

  if (agent.status === "failed") {
    return NextResponse.json({ error: agent.error || "content_draft_failed", agentRunId: agent.runId }, { status: 500 });
  }

  return NextResponse.json({
    package: agent.result.pkg,
    full: agent.result.full,
    provider: agent.result.provider,
    usedFallback: agent.result.usedFallback,
    latencyMs: agent.result.latencyMs,
    agentStatus: agent.status,
    agentError: agent.error,
    agentRunId: agent.runId,
  }, { headers: { "Cache-Control": "no-store" } });
}
