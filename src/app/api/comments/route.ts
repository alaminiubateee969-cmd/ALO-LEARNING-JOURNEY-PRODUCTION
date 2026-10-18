import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { classifyComment, draftReply } from "@/lib/ai";

const REVIEW_REQUIRED = ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency", "toxic", "review_required"];

async function storeModerationRun(agentId: string, task: string, provider: string, usedFallback: boolean, summary: Record<string, unknown>) {
  const finishedAt = new Date();
  const run = await db.aIAgentRun.create({
    data: {
      agentId,
      status: usedFallback ? "blocked_external_setup" : "success",
      inputBrief: task,
      outputJson: JSON.stringify(summary).slice(0, 1_500),
      errorMsg: usedFallback ? "Local moderation/reply model unavailable; human review required." : null,
      startedAt: finishedAt,
      finishedAt,
      costEstUsd: 0,
    },
  });
  await db.auditLog.create({
    data: {
      actor: agentId,
      action: "agent.comment_ai_pass",
      detail: `AgentRun ${run.id}: ${task} via ${provider}; ${usedFallback ? "fallback; human review required" : "complete"}`,
      severity: usedFallback ? "warn" : "info",
    },
  });
  return run.id;
}

export async function GET() {
  await ensureSeeded();
  const comments = await db.commentInbox.findMany({ orderBy: { createdAt: "desc" } });
  const stats = {
    total: comments.length,
    new: comments.filter((c) => c.status === "new").length,
    sensitive: comments.filter((c) => REVIEW_REQUIRED.includes(c.category)).length,
    replied: comments.filter((c) => c.status === "replied").length,
    escalated: comments.filter((c) => c.status === "escalated").length,
  };
  return NextResponse.json({ comments, stats });
}

// Comments can be classified and drafted locally, but are never sent without an official provider adapter.
export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "classify";
  if (!id || id.length > 128) return NextResponse.json({ error: "comment id is required" }, { status: 400 });

  if (action === "classify") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const result = await classifyComment(comment.text);
    const updated = await db.commentInbox.update({
      where: { id },
      data: {
        category: result.data.category,
        riskLevel: result.data.riskLevel,
        status: result.usedFallback ? "escalated" : "classified",
      },
    });
    const agentRunId = await storeModerationRun("comment_moderation", "Classify comment", result.provider, result.usedFallback, {
      category: result.data.category,
      riskLevel: result.data.riskLevel,
      autoReplyAllowed: result.data.autoReplyAllowed,
    });
    await db.auditLog.create({
      data: {
        actor: "CommentModerationAgent",
        action: "comment.classify",
        detail: `Comment ${id} → ${result.data.category} (${result.data.riskLevel}) via ${result.provider}`,
        severity: result.usedFallback || result.data.riskLevel !== "low" ? "warn" : "info",
      },
    });
    if (result.usedFallback) {
      await db.notification.create({ data: { title: "Moderation review required", body: "Local comment classifier unavailable; comment escalated for human review.", kind: "warn" } });
    }
    return NextResponse.json({ comment: updated, rationale: result.data.rationale, autoReplyAllowed: result.data.autoReplyAllowed, provider: result.provider, usedFallback: result.usedFallback, agentRunId });
  }

  if (action === "draft") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (REVIEW_REQUIRED.includes(comment.category)) {
      return NextResponse.json({ error: "Sensitive or unclassified comments require a human response.", status: "needs_human_response" }, { status: 403 });
    }
    const result = await draftReply(comment.text, comment.category);
    const updated = await db.commentInbox.update({ where: { id }, data: { draftReply: result.data.reply } });
    const agentRunId = await storeModerationRun("community_reply", "Draft comment reply", result.provider, result.usedFallback, { usedFallback: result.usedFallback });
    return NextResponse.json({ comment: updated, tone: result.data.tone, provider: result.provider, usedFallback: result.usedFallback, humanReviewRequired: true, agentRunId });
  }

  if (action === "save_draft") {
    const draftReply = typeof body.draftReply === "string" ? body.draftReply.trim() : "";
    if (!draftReply || draftReply.length > 5_000) {
      return NextResponse.json({ error: "draft_reply_must_contain_1_to_5000_characters" }, { status: 400 });
    }
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (REVIEW_REQUIRED.includes(comment.category)) {
      return NextResponse.json({ error: "Sensitive or unclassified comments require a human response.", status: "needs_human_response" }, { status: 403 });
    }
    const updated = await db.commentInbox.update({ where: { id }, data: { draftReply } });
    await db.auditLog.create({
      data: { actor: "admin", action: "comment.draft_save", detail: `Saved an unsent reply draft for comment ${id}.`, severity: "info" },
    });
    return NextResponse.json({ comment: updated, status: "draft_saved", deliveryAttempted: false, message: "Draft saved locally; no platform message was sent." });
  }

  if (action === "send") {
    const comment = await db.commentInbox.findUnique({ where: { id } });
    if (!comment?.draftReply) return NextResponse.json({ error: "no_draft" }, { status: 400 });
    if (REVIEW_REQUIRED.includes(comment.category)) {
      return NextResponse.json({ error: "Sensitive comments require a human response.", status: "needs_human_response" }, { status: 403 });
    }
    return NextResponse.json({
      error: "No official social OAuth reply adapter is configured. The draft was not sent and remains unsent.",
      status: "external_setup_required",
    }, { status: 503 });
  }

  if (action === "escalate") {
    const updated = await db.commentInbox.update({ where: { id }, data: { status: "escalated" } });
    await db.notification.create({ data: { title: "মন্তব্য এসকেলেটেড", body: "একটি মন্তব্য মানব পর্যালোচনায় পাঠানো হয়েছে", kind: "warn" } });
    await db.auditLog.create({ data: { actor: "admin", action: "comment.escalate", detail: `Escalated ${id}`, severity: "warn" } });
    return NextResponse.json({ comment: updated });
  }

  if (action === "ignore") {
    const updated = await db.commentInbox.update({ where: { id }, data: { status: "ignored" } });
    return NextResponse.json({ comment: updated });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
