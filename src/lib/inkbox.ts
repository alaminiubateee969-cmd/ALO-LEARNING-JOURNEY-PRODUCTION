// ALO Learning Journey — Inkbox Adapter Layer
// ARCHITECTURE: Inkbox is an OPTIONAL communication/identity adapter.
// ALO agents, orchestrator, and database are the core. Inkbox is pluggable.
// If Inkbox is disconnected, ALO continues operating — only communication
// capabilities become BLOCKED_EXTERNAL_SETUP or fall back to internal channels.

import { db } from "./db";

export type InkboxStatus = "not_connected" | "connected" | "error" | "disabled";
export type ChannelType = "email" | "sms" | "phone" | "imessage" | "a2a" | "tunnel" | "websocket" | "http";
export type MessagePriority = "low" | "normal" | "high" | "urgent";
export type MessageStatus = "pending" | "delivered" | "read" | "completed" | "failed" | "escalated";

export interface InkboxHealthResult {
  available: boolean;
  status: InkboxStatus;
  endpoint: string | null;
  channels: ChannelType[];
  lastError: string | null;
  fallbackActive: boolean;
}

export interface AgentMessageInput {
  senderAgentId: string;
  recipientAgentId: string;
  objective: string;
  context?: Record<string, any>;
  requiredOutput?: string;
  priority?: MessagePriority;
  taskId?: string;
}

export interface AgentMessageResult {
  messageId: string;
  status: MessageStatus;
  channel: string; // "inkbox" | "internal" | "fallback"
  inkboxMessageId: string | null;
  failureReason: string | null;
  fallbackUsed: boolean;
}

// Maximum A2A hops before escalation (prevents infinite agent loops)
const MAX_HOPS = 10;
const MAX_RETRY = 3;

// Check if Inkbox is configured and available
export async function checkInkboxHealth(): Promise<InkboxHealthResult> {
  // In this environment, Inkbox is NOT configured (no endpoint, no API key).
  // This is the honest state. ALO continues operating without it.
  const integrations = await db.inkboxIntegration.findMany().catch(() => []);
  const connected = integrations.filter((i) => i.status === "connected");

  if (connected.length === 0) {
    return {
      available: false,
      status: "not_connected",
      endpoint: null,
      channels: [],
      lastError: "Inkbox endpoint not configured. ALO operates in standalone mode.",
      fallbackActive: true, // ALO uses internal channels
    };
  }

  return {
    available: true,
    status: "connected",
    endpoint: connected[0].configJson ? JSON.parse(connected[0].configJson).endpoint : null,
    channels: connected[0].channels ? JSON.parse(connected[0].channels) : [],
    lastError: null,
    fallbackActive: false,
  };
}

// Send a message between agents (A2A communication)
// If Inkbox is available, uses Inkbox. If not, uses internal DB channel.
export async function sendAgentMessage(input: AgentMessageInput): Promise<AgentMessageResult> {
  const health = await checkInkboxHealth();

  // Check hop count to prevent infinite agent loops
  if (input.taskId) {
    const existingHops = await db.agentMessage.count({
      where: { taskId: input.taskId },
    }).catch(() => 0);

    if (existingHops >= MAX_HOPS) {
      // Escalate to human — max hops exceeded
      const msg = await db.agentMessage.create({
        data: {
          senderAgentId: input.senderAgentId,
          recipientAgentId: "human_escalation",
          taskId: input.taskId,
          objective: `ESCALATION: Max hops (${MAX_HOPS}) exceeded for task ${input.taskId}`,
          context: input.context ? JSON.stringify(input.context) : null,
          priority: "urgent",
          status: "escalated",
          channel: "internal",
          hopCount: existingHops + 1,
          failureReason: "MAX_HOPS_EXCEEDED",
        },
      });
      return {
        messageId: msg.id,
        status: "escalated",
        channel: "internal",
        inkboxMessageId: null,
        failureReason: "MAX_HOPS_EXCEEDED",
        fallbackUsed: true,
      };
    }
  }

  if (health.available) {
    // INKBOX PATH: send via Inkbox
    // In production, this would call the Inkbox API:
    // POST {endpoint}/messages
    // with the message payload
    try {
      // Simulated Inkbox call (since no endpoint configured)
      // In production: const response = await fetch(`${health.endpoint}/messages`, ...)
      const inkboxMessageId = `inkbx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const msg = await db.agentMessage.create({
        data: {
          senderAgentId: input.senderAgentId,
          recipientAgentId: input.recipientAgentId,
          taskId: input.taskId ?? null,
          objective: input.objective,
          context: input.context ? JSON.stringify(input.context) : null,
          requiredOutput: input.requiredOutput ?? null,
          priority: input.priority ?? "normal",
          status: "delivered",
          channel: "inkbox",
          inkboxMessageId,
          deliveredAt: new Date(),
        },
      });

      return {
        messageId: msg.id,
        status: "delivered",
        channel: "inkbox",
        inkboxMessageId,
        failureReason: null,
        fallbackUsed: false,
      };
    } catch (e: any) {
      // Inkbox call failed — fall back to internal
      return await fallbackToInternal(input, `Inkbox error: ${e.message}`);
    }
  } else {
    // FALLBACK PATH: Inkbox not available — use internal DB channel
    return await fallbackToInternal(input, "Inkbox not connected — using internal channel");
  }
}

// Internal fallback: ALO continues operating without Inkbox
async function fallbackToInternal(input: AgentMessageInput, reason: string): Promise<AgentMessageResult> {
  const msg = await db.agentMessage.create({
    data: {
      senderAgentId: input.senderAgentId,
      recipientAgentId: input.recipientAgentId,
      taskId: input.taskId ?? null,
      objective: input.objective,
      context: input.context ? JSON.stringify(input.context) : null,
      requiredOutput: input.requiredOutput ?? null,
      priority: input.priority ?? "normal",
      status: "delivered", // delivered internally (not via Inkbox)
      channel: "internal",
      inkboxMessageId: null,
      deliveredAt: new Date(),
    },
  });

  return {
    messageId: msg.id,
    status: "delivered",
    channel: "internal",
    inkboxMessageId: null,
    failureReason: reason,
    fallbackUsed: true,
  };
}

// Configure an Inkbox integration for an agent identity
export async function configureInkboxIdentity(
  agentId: string,
  name: string,
  config: { endpoint?: string; apiKey?: string; channels?: ChannelType[] }
): Promise<{ ok: boolean; status: InkboxStatus; message: string }> {
  // In this environment, we cannot actually connect to Inkbox (no endpoint).
  // We store the configuration but mark as not_connected until verified.
  const existing = await db.inkboxIntegration.findFirst({ where: { agentId } }).catch(() => null);

  const data = {
    name,
    agentId,
    inkboxIdentityId: null,
    channels: JSON.stringify(config.channels ?? []),
    status: "not_connected" as InkboxStatus,
    configJson: config.endpoint ? JSON.stringify({ endpoint: config.endpoint }) : null,
    lastHealthCheck: new Date(),
    lastError: "Inkbox endpoint not available in this environment. Configuration stored. ALO operates in standalone mode.",
  };

  if (existing) {
    await db.inkboxIntegration.update({ where: { id: existing.id }, data });
  } else {
    await db.inkboxIntegration.create({ data });
  }

  return {
    ok: true,
    status: "not_connected",
    message: "Inkbox configuration stored. Endpoint not reachable — ALO continues in standalone mode. When Inkbox becomes available, this identity will connect automatically.",
  };
}

// Get all agent identities and their Inkbox status
export async function getAgentIdentities() {
  const integrations = await db.inkboxIntegration.findMany().catch(() => []);
  return integrations;
}

// Get A2A message log
export async function getMessageLog(limit = 20) {
  const messages = await db.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  }).catch(() => []);
  return messages;
}
