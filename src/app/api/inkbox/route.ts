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
      core: "ALO AI Agents + Orchestrator + Database",
      adapter: "Inkbox (OPTIONAL communication/identity layer)",
      fallback: "Internal DB channel (active when Inkbox unavailable)",
      principle: "If Inkbox is disconnected, ALO continues operating. Only communication capabilities become BLOCKED_EXTERNAL_SETUP.",
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
        detail: `${body.senderAgentId} → ${body.recipientAgentId}: "${body.objective?.slice(0, 50)}" via ${result.channel}${result.fallbackUsed ? " (fallback)" : ""}`,
        severity: "info",
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
      message: result.fallbackUsed
        ? "ALO continued operating without Inkbox. Message delivered via internal fallback channel."
        : "Inkbox was available. Message delivered via Inkbox.",
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
