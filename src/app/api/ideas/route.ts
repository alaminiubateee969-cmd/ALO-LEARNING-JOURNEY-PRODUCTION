import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateIdeas } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

export async function GET() {
  await ensureSeeded();
  const ideas = await db.contentIdea.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ideas });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({ seed: "প্যারেন্টিং" }));

  // Non-generation actions: promote/delete don't need AgentRun
  if (body.action === "promote" && body.id) {
    const idea = await db.contentIdea.findUnique({ where: { id: body.id } });
    if (!idea) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ idea });
  }

  if (body.action === "delete" && body.id) {
    await db.contentIdea.delete({ where: { id: body.id } });
    await db.auditLog.create({
      data: { actor: "admin", action: "ideas.delete", detail: `Deleted idea ${body.id}`, severity: "info" },
    });
    return NextResponse.json({ ok: true });
  }

  // GENERATION PATH: use executeAsAgent for full traceability
  const seed = body.seed || "প্যারেন্টিং";
  const agentResult = await executeAsAgent(
    {
      agentId: "topic_ideation",
      task: `Generate content ideas (seed: ${seed.slice(0, 40)})`,
      tools: ["llm.generate"],
    },
    async () => {
      const result = await generateIdeas(seed, 3);
      const saved: Awaited<ReturnType<typeof db.contentIdea.create>>[] = [];
      for (const idea of result.data) {
        const row = await db.contentIdea.create({
          data: { topic: idea.topic, hook: idea.hook, angle: idea.angle, audience: idea.audience, status: "idea" },
        });
        saved.push(row);
      }
      return { data: { ideas: saved, provider: result.provider, usedFallback: result.usedFallback }, provider: result.provider };
    }
  );

  return NextResponse.json({
    ...agentResult.result,
    agentRunId: agentResult.runId,
    agentId: agentResult.agentId,
    agentStatus: agentResult.status,
    auditId: agentResult.auditId,
  });
}

export async function DELETE(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.contentIdea.delete({ where: { id } }).catch(() => null);
  await db.auditLog.create({
    data: { actor: "admin", action: "ideas.delete", detail: `Deleted idea ${id}`, severity: "info" },
  });
  return NextResponse.json({ ok: true });
}
