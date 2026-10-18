import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// Unified activity timeline: merges recent agent runs, approvals, publishes,
// comments, and audit logs into a single chronological feed.
export async function GET() {
  await ensureSeeded();

  type Item = {
    id: string;
    kind: "agent_run" | "approval" | "publish" | "comment" | "audit";
    title: string;
    detail: string;
    icon: string;
    tone: "info" | "success" | "warn" | "danger";
    timestamp: string;
  };

  const items: Item[] = [];

  // Agent runs
  const runs = await db.aIAgentRun.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  for (const r of runs) {
    items.push({
      id: `run-${r.id}`,
      kind: "agent_run",
      title: r.agentId,
      detail: r.inputBrief || r.status,
      icon: "🤖",
      tone: r.status === "success" ? "success" : r.status === "failed" ? "danger" : "info",
      timestamp: r.createdAt.toISOString(),
    });
  }

  // Approvals
  const approvals = await db.approvalItem.findMany({ orderBy: { createdAt: "desc" }, take: 6 });
  for (const a of approvals) {
    items.push({
      id: `approval-${a.id}`,
      kind: "approval",
      title: a.title,
      detail: `${a.type} · ${a.status}`,
      icon: a.type === "comment" ? "💬" : a.type === "image" ? "🖼️" : a.type === "video" ? "🎬" : "📝",
      tone: a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : a.riskLevel === "high" ? "warn" : "info",
      timestamp: a.createdAt.toISOString(),
    });
  }

  // Published posts
  const posts = await db.publishedPost.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  for (const p of posts) {
    items.push({
      id: `post-${p.id}`,
      kind: "publish",
      title: `${p.platform} পোস্ট`,
      detail: p.status === "published" ? `প্রকাশিত · ${p.providerPostId}` : p.status,
      icon: "📤",
      tone: p.status === "published" ? "success" : p.status === "failed" ? "danger" : "info",
      timestamp: (p.publishedAt ?? p.createdAt).toISOString(),
    });
  }

  // Comments
  const comments = await db.commentInbox.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  for (const c of comments) {
    const isSensitive = ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"].includes(c.category);
    items.push({
      id: `comment-${c.id}`,
      kind: "comment",
      title: `${c.authorName} (${c.platform})`,
      detail: c.text.slice(0, 60),
      icon: isSensitive ? "⚠️" : "💬",
      tone: isSensitive ? "danger" : c.status === "replied" ? "success" : "info",
      timestamp: c.createdAt.toISOString(),
    });
  }

  // Audit logs (recent only, skip the ones already covered)
  const audit = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  for (const a of audit) {
    items.push({
      id: `audit-${a.id}`,
      kind: "audit",
      title: a.action,
      detail: a.detail ?? "",
      icon: "📋",
      tone: a.severity === "critical" || a.severity === "error" ? "danger" : a.severity === "warn" ? "warn" : "info",
      timestamp: a.createdAt.toISOString(),
    });
  }

  // Sort all by timestamp desc
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return NextResponse.json({
    items: items.slice(0, 25),
    total: items.length,
  });
}
