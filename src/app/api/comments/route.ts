import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { classifyComment, draftReply } from "@/lib/ai";
import { executeAsAgent } from "@/lib/agent-runtime";

export async function GET() {
  await ensureSeeded();
  const comments = await db.commentInbox.findMany({ orderBy: { createdAt: "desc" } });
  const stats = {
    total: comments.length,
    new: comments.filter((c) => c.status === "new").length,
    sensitive: comments.filter(
      (c) => ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"].includes(c.category)
    ).length,
    replied: comments.filter((c) => c.status === "replied").length,
    escalated: comments.filter((c) => c.status === "escalated").length,
  };
  return NextResponse.json({ comments, stats });
}

// Classify a single comment via CommentModerationAgent
export async function POST(req: Request) {
  await ensureSeeded();

  // ALO Agent Runtime — creates traceable AgentRun
  const agentRun = await db.aIAgentRun.create({
    data: {
      agentId: "comment_moderation",
      status: "running",
      inputBrief: "Comment classification/reply",
      startedAt: new Date(),
    },
  });

  const { id, action } = await req.json().catch(() => ({ id: "", action: "classify" }));

  if (action === "classify") {
    const c = await db.commentInbox.findUnique({ where: { id } });
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    const res = await classifyComment(c.text);
    const updated = await db.commentInbox.update({
      where: { id },
      data: {
        category: res.data.category,
        riskLevel: res.data.riskLevel,
        status: "classified",
      },
    });
    await db.auditLog.create({
      data: {
        actor: "CommentModerationAgent",
        action: "comment.classify",
        detail: `Comment ${id} → ${res.data.category} (${res.data.riskLevel}) via ${res.provider}`,
        severity: res.data.riskLevel === "high" ? "warn" : "info",
      },
    });
    return NextResponse.json({ comment: updated, rationale: res.data.rationale, autoReplyAllowed: res.data.autoReplyAllowed, provider: res.provider, usedFallback: res.usedFallback });
  }

  if (action === "draft") {
    const c = await db.commentInbox.findUnique({ where: { id } });
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Sensitive comments must NOT get auto-replies — enforce server-side
    const SENSITIVE_CATEGORIES = ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency", "toxic"];
    if (SENSITIVE_CATEGORIES.includes(c.category)) {
      return NextResponse.json({
        error: "Sensitive comments require human response — auto-reply not allowed",
        status: "needs_human_response",
      }, { status: 403 });
    }
    const res = await draftReply(c.text, c.category);
    const updated = await db.commentInbox.update({
      where: { id },
      data: { draftReply: res.data.reply },
    });
    return NextResponse.json({ comment: updated, tone: res.data.tone, provider: res.provider, usedFallback: res.usedFallback });
  }

  if (action === "send") {
    const c = await db.commentInbox.findUnique({ where: { id } });
    if (!c || !c.draftReply) return NextResponse.json({ error: "no draft" }, { status: 400 });
    // Double-check: sensitive comments cannot be auto-replied
    const SENSITIVE_CATEGORIES = ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency", "toxic"];
    if (SENSITIVE_CATEGORIES.includes(c.category)) {
      return NextResponse.json({
        error: "Sensitive comments require human response — send not allowed",
        status: "needs_human_response",
      }, { status: 403 });
    }
    const updated = await db.commentInbox.update({
      where: { id },
      data: { status: "replied", repliedAt: new Date() },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "comment.reply_sent", detail: `Replied to ${id}`, severity: "info" },
    });
    return NextResponse.json({ comment: updated });
  }

  if (action === "escalate") {
    const updated = await db.commentInbox.update({
      where: { id },
      data: { status: "escalated" },
    });
    await db.notification.create({
      data: {
        title: "মন্তব্য এসকেলেটেড",
        body: `একটি ${updated.category} মন্তব্য মানব পর্যালোচনায় পাঠানো হয়েছে`,
        kind: "warn",
      },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "comment.escalate", detail: `Escalated ${id}`, severity: "warn" },
    });
    return NextResponse.json({ comment: updated });
  }

  if (action === "ignore") {
    const updated = await db.commentInbox.update({
      where: { id },
      data: { status: "ignored" },
    });
    return NextResponse.json({ comment: updated });
  }


  // Update AgentRun with success
  await db.aIAgentRun.update({
    where: { id: agentRun.id },
    data: { status: "success", finishedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      actor: "comment_moderation",
      action: "agent.comment_classification/reply",
      detail: `AgentRun ${agentRun.id}: Comment classification/reply → success`,
      severity: "info",
    },
  });

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
