/**
 * Realtime event type definitions for the ALO Learning Journey platform.
 */

export const REALTIME_EVENTS = {
  // Workforce
  WORKFORCE_MESSAGE: "workforce:message",
  WORKFORCE_TYPING: "workforce:typing",
  WORKFORCE_STATUS: "workforce:status",

  // AI Agents
  AGENT_RESPONSE: "agent:response",
  AGENT_STATUS: "agent:status",
  AGENT_ERROR: "agent:error",

  // Voice
  VOICE_STREAM: "voice:stream",
  VOICE_TRANSCRIPT: "voice:transcript",

  // Notifications
  NOTIFICATION: "notification",
  ALERT: "alert",

  // System
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  HEARTBEAT: "heartbeat",
} as const;

export type RealtimeEventType = typeof REALTIME_EVENTS[keyof typeof REALTIME_EVENTS];

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  payload: T;
  timestamp: string;
  source?: string;
}

export function createEvent<T>(type: RealtimeEventType, payload: T): RealtimeEvent<T> {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}

export default REALTIME_EVENTS;
