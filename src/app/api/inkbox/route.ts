import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { checkInkboxHealth, sendAgentMessage, configureInkboxIdentity, getAgentIdentities, getMessageLog } from "@/lib/inkbox";

export async function GET() {
  await ensureSeeded();
  const [health, identities, messages] = await Promise.all([
    checkInkboxHealth(),
    getAgentIdentities(),
    getMessageLog(20),
  ]);

  return NextResponse.json({
    health,
    identities,
    messages,
    architecture: {
      core: "ALO application and database",
      adapter: "Inkbox settings are metadata only; no verified API client is implemented",
      fallback: "Messages may be stored as pending in the internal database; no dispatcher is configured",
      principle: "A message is not reported delivered until a verified external or internal worker confirms delivery.",
    },
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));

  if (body.action === "send_message") {
    // Send A2A message — uses Inkbox if available, internal fallback otherwise
    const result = await sendAgentMessage({
      senderAgentId: body.senderAgentId || "master_orchestrator",
      recipientAgentId: body.recipientAgentId || "content_writer",
      objective: body.objective || "No objective specified",
      context: body.context,
      requiredOutput: body.requiredOutput,
      priority: body.priority || "normal",
      taskId: body.taskId,
    });

    await db.auditLog.create({
      data: {
        actor: body.senderAgentId || "system",
        action: "inkbox.a2a_message",
        detail: `${body.senderAgentId} → ${body.recipientAgentId}: "${String(body.objective ?? "").slice(0, 50)}" status=${result.status} via ${result.channel}; delivery is not confirmed.`,
        severity: result.status === "delivered" ? "info" : "warn",
      },
    });

    return NextResponse.json(result);
  }

  if (body.action === "configure_identity") {
    // Configure an Inkbox identity for an agent
    const result = await configureInkboxIdentity(
      body.agentId,
      body.name,
      { endpoint: body.endpoint, apiKey: body.apiKey, channels: body.channels }
    );

    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "inkbox.configure_identity",
        detail: `Configured Inkbox identity for agent "${body.agentId}": status=${result.status}`,
        severity: "info",
      },
    });

    return NextResponse.json(result);
  }

  if (body.action === "test_fallback") {
    // Test the graceful degradation: send a message when Inkbox is NOT available
    const result = await sendAgentMessage({
      senderAgentId: "master_orchestrator",
      recipientAgentId: "content_writer",
      objective: "Test: Inkbox fallback to internal channel",
      priority: "normal",
    });

    return NextResponse.json({
      ...result,
      test: "graceful_degradation",
      message: result.status === "pending"
        ? "Message was stored as pending in the internal database. No Inkbox request, dispatcher, or delivery occurred."
        : result.status === "escalated"
          ? "Message was escalated in the internal database; no notification was sent."
          : "Delivery status came from a configured transport.",
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
