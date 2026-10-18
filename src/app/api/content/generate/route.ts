import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateContentPackage } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

export async function POST(req: Request) {
  await ensureSeeded();

  // ALO Agent Runtime — creates traceable AgentRun
  const agentRun = await db.aIAgentRun.create({
    data: {
      agentId: "content_writer",
      status: "running",
      inputBrief: "Generate content package",
      startedAt: new Date(),
    },
  });

  const { topic, audience } = await req.json().catch(() => ({
    topic: "প্যারেন্টিং",
    audience: "পিতামাতা",
  }));

  // RAG context: pull a few docs as pseudo-retrieved context
  const docs = await db.ragDocument.findMany({ take: 3 });
  const ragContext = docs
    .map((d, i) => `[${i + 1}] ${d.title} (${d.sourceType}): ${d.content.slice(0, 220)}`)
    .join("\n\n");

  const result = await generateContentPackage(topic, audience, ragContext);

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
      qualityScore: result.data.qualityScore,
      safetyStatus: "pending",
      ragCitations: JSON.stringify(result.data.ragCitations),
    },
  });

  // Auto-create an approval item
  await db.approvalItem.create({
    data: {
      packageId: pkg.id,
      topic,
      type: "content",
      title: `কনটেন্ট প্যাকেজ — ${topic.slice(0, 40)}`,
      summary: `রিল স্ক্রিপ্ট + ${Object.keys(result.data.captions).length} প্ল্যাটফর্ম ক্যাপশন + হুক + ইমেজ প্রম্পট`,
      riskLevel: "low",
      status: "pending",
    },
  });

  await db.auditLog.create({
    data: {
      actor: "admin",
      action: "content.generate",
      detail: `Generated package for "${topic}" via ${result.provider}`,
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
      actor: "content_writer",
      action: "agent.generate_content_package",
      detail: `AgentRun ${agentRun.id}: Generate content package → success`,
      severity: "info",
    },
  });

  return NextResponse.json({
    package: pkg,
    full: result.data,
    provider: result.provider,
    usedFallback: result.usedFallback,
    latencyMs: result.latencyMs,
  });
}
