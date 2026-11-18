/**
 * Realtime client stub for WebSocket/SSE connections.
 * Used by workforce chat, voice agents, and live dashboards.
 */

/** Listener invoked with the decoded payload of a server event. */
export type RealtimeListener = (data: unknown) => void;

export interface RealtimeClientOptions {
  url?: string;
  token?: string;
  reconnect?: boolean;
}

export class RealtimeClient {
  private url: string;
  private token: string;
  private reconnect: boolean;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<RealtimeListener>> = new Map();

  constructor(options: RealtimeClientOptions = {}) {
    this.url = options.url || process.env.NEXT_PUBLIC_APP_URL || "https://learn.alolabs.net";
    this.token = options.token || "";
    this.reconnect = options.reconnect ?? true;
  }

  connect(): void {
    if (typeof WebSocket === "undefined") return;
    try {
      const wsUrl = this.url.replace(/^http/, "ws") + "/ws";
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type || "message", data);
        } catch { /* ignore non-JSON */ }
      };
      this.ws.onclose = () => {
        if (this.reconnect) setTimeout(() => this.connect(), 5000);
      };
    } catch { /* server-side no-op */ }
  }

  disconnect(): void {
    this.reconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  on(event: string, callback: RealtimeListener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: RealtimeListener): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(data); } catch { /* swallow */ }
    });
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export function createRealtimeClient(options?: RealtimeClientOptions): RealtimeClient {
  return new RealtimeClient(options);
}

export default RealtimeClient;
