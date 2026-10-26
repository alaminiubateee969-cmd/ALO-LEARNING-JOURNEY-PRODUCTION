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

// No verified Inkbox HTTP adapter or dispatcher exists in this repository.
// A stored "connected" flag is metadata only and must never be treated as a probe.
export async function checkInkboxHealth(): Promise<InkboxHealthResult> {
  const integrations = await db.inkboxIntegration.findMany();
  const hasSavedConfiguration = integrations.length > 0;
  return {
    available: false,
    status: "not_connected",
    endpoint: null,
    channels: [],
    lastError: hasSavedConfiguration
      ? "Saved Inkbox settings have not been probed; no verified API adapter or message dispatcher is configured."
      : "Inkbox API adapter is not configured. Internal messages can be queued but are not delivered.",
    fallbackActive: true,
  };
}

// Store an A2A request for visibility. No external transport or internal worker
// exists, so a created message remains pending until a dispatcher is implemented.
export async function sendAgentMessage(input: AgentMessageInput): Promise<AgentMessageResult> {
  const health = await checkInkboxHealth();

  if (input.taskId) {
    const existingHops = await db.agentMessage.count({ where: { taskId: input.taskId } });
    if (existingHops >= MAX_HOPS) {
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

  return fallbackToInternal(input, health.lastError ?? "No verified message dispatcher is configured.");
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
      status: "pending", // persisted to DB; no worker has dispatched or delivered it
      channel: "internal",
      inkboxMessageId: null,
      deliveredAt: null,
    },
  });

  return {
    messageId: msg.id,
    status: "pending",
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
  // Keep non-secret connection metadata only. apiKey is intentionally not stored;
  // no endpoint probe or live delivery implementation exists.
  if (!agentId.trim() || !name.trim()) {
    return { ok: false, status: "error", message: "Agent id and display name are required." };
  }
  const existing = await db.inkboxIntegration.findFirst({ where: { agentId: agentId.trim() } });

  const data = {
    name: name.trim(),
    agentId: agentId.trim(),
    inkboxIdentityId: null,
    channels: JSON.stringify(config.channels ?? []),
    status: "not_connected" as InkboxStatus,
    configJson: config.endpoint ? JSON.stringify({ endpoint: config.endpoint }) : null,
    lastHealthCheck: null,
    lastError: "Settings are unverified metadata only; no Inkbox adapter or message dispatcher is installed.",
  };

  if (existing) {
    await db.inkboxIntegration.update({ where: { id: existing.id }, data });
  } else {
    await db.inkboxIntegration.create({ data });
  }

  return {
    ok: true,
    status: "not_connected",
    message: "Connection metadata saved, but it is unverified. No Inkbox connection or automatic delivery attempt will occur until a verified adapter is implemented.",
  };
}

// Get all agent identities and their Inkbox status
export async function getAgentIdentities() {
  return db.inkboxIntegration.findMany();
}

// Get A2A message log
export async function getMessageLog(limit = 20) {
  return db.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
