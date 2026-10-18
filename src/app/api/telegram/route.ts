import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { ADMIN_COMMANDS } from "@/lib/platforms";
import { generateIdeas } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "private, no-store" };
const SENSITIVE_COMMENT_CATEGORIES = ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"];

function parseCommandId(command: string): string | null {
  const id = command.trim().split(/\s+/, 2)[1];
  return id && id.length <= 191 ? id : null;
}

function isIdea(value: unknown): value is { topic: string; hook: string; angle: string; audience: string } {
  if (!value || typeof value !== "object") return false;
  const idea = value as Record<string, unknown>;
  return ["topic", "hook", "angle", "audience"].every(
    (field) => typeof idea[field] === "string" && (idea[field] as string).trim().length > 0,
  );
}

export async function GET() {
  await ensureSeeded();
  const commands = await db.telegramCommand.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({
    commands,
    commandList: ADMIN_COMMANDS,
    integration: "admin-console-only; no Telegram webhook or message delivery is configured",
  }, { headers: CACHE_HEADERS });
}

/**
 * Admin-only command console. Production requests are gated by the global
 * NextAuth middleware. This route does not accept Telegram webhook updates,
 * send Telegram messages, or schedule reports.
 */
export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => null) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_json_object" }, { status: 400, headers: CACHE_HEADERS });
  }

  const rawCommand = (body as Record<string, unknown>).command;
  if (typeof rawCommand !== "string" || rawCommand.length > 512) {
    return NextResponse.json({ error: "command_must_be_a_string_under_512_characters" }, { status: 400, headers: CACHE_HEADERS });
  }
  const command = rawCommand.trim();
  const commandName = command.split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  const known = ADMIN_COMMANDS.find((entry) => entry.cmd.split(" ", 1)[0] === commandName);
  if (!known) {
    return NextResponse.json({ error: "unsupported_command" }, { status: 400, headers: CACHE_HEADERS });
  }

  let status = "received";
  let response = "";

  if (commandName === "/start") {
    response = "ALO admin command console is available. It is not connected to Telegram.";
  } else if (commandName === "/help") {
    response = `Supported console commands: ${ADMIN_COMMANDS.map((entry) => entry.cmd).join(", ")}`;
  } else if (commandName === "/ideas") {
    const result = await generateIdeas("প্যারেন্টিং", 3);
    const ideas = result.data.filter(isIdea).slice(0, 3);
    if (ideas.length === 0) {
      status = "failed";
      response = "No valid idea records were returned; nothing was saved.";
    } else {
      let savedCount = 0;
      for (const idea of ideas) {
        await db.contentIdea.create({
          data: {
            topic: idea.topic.trim().slice(0, 191),
            hook: idea.hook.trim().slice(0, 5000),
            angle: idea.angle.trim().slice(0, 5000),
            audience: idea.audience.trim().slice(0, 191),
            status: "idea",
          },
        });
        savedCount += 1;
      }
      status = result.usedFallback ? "fallback_saved_for_review" : "drafted_saved_for_review";
      response = `${savedCount} idea draft(s) saved for human review via ${result.provider}; no content was published.`;
    }
  } else if (commandName === "/status") {
    const [pending, queued] = await Promise.all([
      db.approvalItem.count({ where: { status: "pending" } }),
      db.publishedPost.count({ where: { status: "queued" } }),
    ]);
    response = `${pending} stored item(s) await approval; ${queued} post record(s) are queued. Queue delivery is not verified.`;
  } else if (commandName === "/review") {
    const items = await db.approvalItem.findMany({ where: { status: "pending" }, take: 5 });
    response = items.length > 0
      ? `Pending review (${items.length}): ${items.map((item) => item.title.slice(0, 80)).join("; ")}`
      : "No stored approval items are currently pending.";
  } else if (commandName === "/approve" || commandName === "/reject") {
    const id = parseCommandId(command);
    if (!id) {
      status = "invalid_input";
      response = `Usage: ${commandName} <ID>`;
    } else {
      const item = await db.approvalItem.findFirst({ where: { id } });
      if (!item) {
        status = "not_found";
        response = "Approval item not found.";
      } else {
        const nextStatus = commandName === "/approve" ? "approved" : "rejected";
        await db.approvalItem.update({ where: { id: item.id }, data: { status: nextStatus, reviewedAt: new Date() } });
        await db.auditLog.create({
          data: {
            actor: "admin-console",
            action: `approval.${nextStatus}`,
            detail: `Approval item ${item.id} ${nextStatus} through the administrator command console.`,
            severity: commandName === "/reject" ? "warn" : "info",
          },
        });
        status = nextStatus;
        response = `Approval item ${item.id} marked ${nextStatus}.`;
      }
    }
  } else if (commandName === "/publish") {
    const id = parseCommandId(command);
    if (!id) {
      status = "invalid_input";
      response = "Usage: /publish <ID>. This command never publishes externally.";
    } else {
      const post = await db.publishedPost.findFirst({ where: { id } });
      if (!post) {
        status = "not_found";
        response = "Post record not found.";
      } else {
        await db.publishedPost.update({ where: { id: post.id }, data: { status: "external_setup_required" } });
        status = "blocked_external_setup";
        response = `Post ${post.id} marked external_setup_required. No external publication was attempted.`;
      }
    }
  } else if (commandName === "/analytics") {
    const snapshots = await db.analyticsSnapshot.findMany({ orderBy: { capturedAt: "desc" }, take: 10 });
    response = snapshots.length
      ? `${snapshots.length} recent analytics snapshot row(s) are stored; this console does not fetch platform analytics.`
      : "No analytics snapshot rows are stored.";
  } else if (commandName === "/connections") {
    const connections = await db.socialConnection.findMany();
    const markedConnected = connections.filter((connection) => connection.status === "connected").length;
    response = `${markedConnected}/${connections.length} connection record(s) are marked connected in ALO; provider connectivity is not probed.`;
  } else if (commandName === "/failures") {
    const failed = await db.aIAgentRun.count({ where: { status: "failed" } });
    response = `${failed} stored agent run(s) are marked failed.`;
  } else if (commandName === "/comments") {
    const sensitive = await db.commentInbox.count({ where: { category: { in: SENSITIVE_COMMENT_CATEGORIES } } });
    response = `${sensitive} stored sensitive comment(s) are marked for human review.`;
  }

  const row = await db.telegramCommand.create({
    data: {
      command: command.slice(0, 191),
      args: command.slice(commandName.length).trim().slice(0, 5000) || null,
      senderId: "admin-console",
      status,
      response: response.slice(0, 5000),
    },
  });
  await db.auditLog.create({
    data: {
      actor: "admin-console",
      action: "admin.command.executed",
      detail: `${commandName} -> ${status}`,
      severity: ["failed", "invalid_input", "not_found", "blocked_external_setup"].includes(status) ? "warn" : "info",
    },
  });

  return NextResponse.json({ row, status, response }, { headers: CACHE_HEADERS });
}
