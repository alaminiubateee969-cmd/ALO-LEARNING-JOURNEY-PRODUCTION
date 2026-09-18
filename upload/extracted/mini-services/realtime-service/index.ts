// ─── AISMH Real-Time Service ─────────────────────────────────────────────────────
// Socket.io WebSocket server on port 3004
// Handles: notifications, messages, conversations, dashboard, AI replies,
//           worker status, queue updates, presence tracking, typing indicators
// ────────────────────────────────────────────────────────────────────────────────

import { createServer } from "http";
import { Server, Socket } from "socket.io";

// ─── Configuration ────────────────────────────────────────────────────────────────

const PORT = 3004;
const JWT_SECRET = process.env.JWT_SECRET || "alolabs-secret-key-2025";
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_EVENTS = 120; // max events per window per connection
const PRESENCE_HEARTBEAT_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────────

interface AuthenticatedUser {
  userId: string;
  email: string;
  companyId: string;
  role: string;
  isSuperAdmin: boolean;
}

interface ConnectedClient {
  socketId: string;
  user: AuthenticatedUser;
  rooms: Set<string>;
  joinedAt: number;
  lastActivity: number;
  eventCount: number;
  eventCountResetAt: number;
}

interface TypingState {
  userId: string;
  conversationId: string;
  userName: string;
  timestamp: number;
}

// ─── In-Memory State ──────────────────────────────────────────────────────────────

const clients = new Map<string, ConnectedClient>(); // socketId -> client
const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>
const typingStates = new Map<string, TypingState>(); // conversationId -> typing state

// ─── JWT Verification (pure JS, same logic as main app) ──────────────────────────

function toBase64Url(buffer: Uint8Array): string {
  const binary = Array.from(buffer)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function sha256(message: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = new Int32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const msgLen = message.length;
  const bitLen = msgLen * 8;
  const padLen = ((56 - (msgLen + 1) % 64) + 64) % 64;
  const totalLen = msgLen + 1 + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(message);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 8, bitLen >>> 0, false);

  for (let offset = 0; offset < totalLen; offset += 64) {
    const W = new Int32Array(64);
    for (let i = 0; i < 16; i++) {
      W[i] = view.getInt32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = [...H];

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e;
      e = (d + temp1) | 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    resultView.setUint32(i * 4, H[i] >>> 0, false);
  }
  return result;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) | 0;
}

function hmacSha256(message: string, key: string): string {
  const encoder = new TextEncoder();
  let keyBytes: Uint8Array;
  if (key.length > 64) {
    keyBytes = sha256(encoder.encode(key));
  } else {
    keyBytes = encoder.encode(key);
  }

  const paddedKey = new Uint8Array(64);
  paddedKey.set(keyBytes.subarray(0, 64));
  const messageBytes = encoder.encode(message);

  const innerData = new Uint8Array(64 + messageBytes.length);
  for (let i = 0; i < 64; i++) innerData[i] = paddedKey[i] ^ 0x36;
  innerData.set(messageBytes, 64);
  const innerHash = sha256(innerData);

  const outerData = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) outerData[i] = paddedKey[i] ^ 0x5c;
  outerData.set(innerHash, 64);
  const result = sha256(outerData);

  return Array.from(result).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function verifyJWT(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [, payloadB64, signatureB64] = parts;
    const data = `${parts[0]}.${payloadB64}`;
    const expectedSig = hmacSha256(data, JWT_SECRET);
    const actualSig = Array.from(fromBase64Url(signatureB64))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSig !== actualSig) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      userId: String(payload.userId || ""),
      email: String(payload.email || ""),
      companyId: String(payload.companyId || ""),
      role: String(payload.role || ""),
      isSuperAdmin: Boolean(payload.isSuperAdmin),
    };
  } catch {
    return null;
  }
}

// ─── Rate Limiter ─────────────────────────────────────────────────────────────────

function checkRateLimit(client: ConnectedClient): boolean {
  const now = Date.now();
  if (now - client.eventCountResetAt > RATE_LIMIT_WINDOW_MS) {
    client.eventCount = 0;
    client.eventCountResetAt = now;
  }
  client.eventCount++;
  client.lastActivity = now;
  return client.eventCount <= RATE_LIMIT_MAX_EVENTS;
}

// ─── Room Helpers ─────────────────────────────────────────────────────────────────

function buildRooms(user: AuthenticatedUser): string[] {
  const rooms: string[] = [
    `user:${user.userId}`,
    `company:${user.companyId}`,
    `notifications:${user.companyId}`,
  ];
  return rooms;
}

// ─── Presence ─────────────────────────────────────────────────────────────────────

function broadcastPresence(io: Server, userId: string, companyId: string, status: "online" | "offline") {
  io.to(`company:${companyId}`).emit("presence:change", {
    userId,
    status,
    timestamp: new Date().toISOString(),
  });
}

function getOnlineUsersForCompany(companyId: string): string[] {
  const onlineUsers: string[] = [];
  for (const [, client] of clients) {
    if (client.user.companyId === companyId) {
      if (!onlineUsers.includes(client.user.userId)) {
        onlineUsers.push(client.user.userId);
      }
    }
  }
  return onlineUsers;
}

// ─── Typing Indicators ────────────────────────────────────────────────────────────

const TYPING_TIMEOUT_MS = 4_000;

function handleTypingStart(io: Server, socket: Socket, data: { conversationId: string }) {
  const client = clients.get(socket.id);
  if (!client) return;

  const key = `${socket.id}:${data.conversationId}`;
  const existing = typingStates.get(key);
  if (existing) clearTimeout(existing.timestamp as unknown as number);

  typingStates.set(key, {
    userId: client.user.userId,
    conversationId: data.conversationId,
    userName: client.user.email,
    timestamp: Date.now(),
  });

  // Broadcast to all users in the company
  io.to(`company:${client.user.companyId}`).emit("typing:start", {
    userId: client.user.userId,
    conversationId: data.conversationId,
    userName: client.user.email,
  });

  // Auto-clear typing after timeout
  setTimeout(() => {
    typingStates.delete(key);
    io.to(`company:${client.user.companyId}`).emit("typing:stop", {
      userId: client.user.userId,
      conversationId: data.conversationId,
    });
  }, TYPING_TIMEOUT_MS);
}

function handleTypingStop(io: Server, socket: Socket, data: { conversationId: string }) {
  const client = clients.get(socket.id);
  if (!client) return;

  const key = `${socket.id}:${data.conversationId}`;
  typingStates.delete(key);

  io.to(`company:${client.user.companyId}`).emit("typing:stop", {
    userId: client.user.userId,
    conversationId: data.conversationId,
  });
}

// ─── HTTP Push Endpoint (separate server to avoid Socket.io path conflicts) ────────────
// API routes POST to http://localhost:3005/push to push events to connected clients

const PUSH_PORT = 3005;
const pushSecret = process.env.PUSH_SECRET || "aismh-push-secret-2025";

const pushServer = createServer((req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", clients: clients.size }));
    return;
  }

  // Only handle POST /push
  if (req.method !== "POST" || req.url !== "/push") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString());

      // Validate push secret to prevent unauthorized pushes
      const authHeader = req.headers["authorization"];
      if (!authHeader || authHeader !== `Bearer ${pushSecret}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized push" }));
        return;
      }

      const { target, event, data, targetId } = body as {
        target: "company" | "user" | "all" | "room";
        targetId?: string;
        event: string;
        data: unknown;
      };

      if (!event) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing event" }));
        return;
      }

      let recipientCount = 0;

      switch (target) {
        case "company":
          if (targetId) {
            io.to(`company:${targetId}`).emit(event, data);
            const room = io.sockets.adapter.rooms.get(`company:${targetId}`);
            recipientCount = room ? room.size : 0;
          }
          break;
        case "user":
          if (targetId) {
            const socketIds = userSockets.get(targetId);
            if (socketIds) {
              for (const sid of socketIds) {
                io.to(sid).emit(event, data);
                recipientCount++;
              }
            }
          }
          break;
        case "room":
          if (targetId) {
            io.to(targetId).emit(event, data);
            const room = io.sockets.adapter.rooms.get(targetId);
            recipientCount = room ? room.size : 0;
          }
          break;
        case "all":
          io.emit(event, data);
          recipientCount = io.sockets.sockets.size;
          break;
        default:
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid target" }));
          return;
      }

      console.log(`[PUSH] ${event} → ${target}${targetId ? `:${targetId}` : ""} (${recipientCount} recipients)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, recipientCount }));
    } catch (err) {
      console.error("[PUSH] Error:", err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
    }
  });
});

// ─── Socket.io Server Setup ───────────────────────────────────────────────────────

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// ─── Authentication Middleware ────────────────────────────────────────────────────

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("Authentication required: provide a JWT token"));
  }

  const user = verifyJWT(token);
  if (!user || !user.userId) {
    return next(new Error("Invalid or expired token"));
  }

  // Attach user to socket
  (socket.data as Record<string, unknown>).user = user;
  next();
});

// ─── Connection Handler ───────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  const user = socket.data.user as AuthenticatedUser;
  const now = Date.now();

  console.log(`[CONNECT] ${user.email} (${socket.id}) [${user.role}]`);

  // Register client
  const rooms = new Set<string>();
  const client: ConnectedClient = {
    socketId: socket.id,
    user,
    rooms,
    joinedAt: now,
    lastActivity: now,
    eventCount: 0,
    eventCountResetAt: now,
  };
  clients.set(socket.id, client);

  // Track user -> sockets mapping
  if (!userSockets.has(user.userId)) {
    userSockets.set(user.userId, new Set());
  }
  userSockets.get(user.userId)!.add(socket.id);

  // Join rooms
  const roomList = buildRooms(user);
  for (const room of roomList) {
    socket.join(room);
    rooms.add(room);
  }
  console.log(`[ROOMS] ${user.email} joined: ${roomList.join(", ")}`);

  // Broadcast presence
  broadcastPresence(io, user.userId, user.companyId, "online");

  // Send current online users to the newly connected client
  const onlineUsers = getOnlineUsersForCompany(user.companyId);
  socket.emit("presence:online", { userIds: onlineUsers });

  // ─── Client Event Handlers ──────────────────────────────────────────────────

  socket.on("typing:start", (data: { conversationId: string }) => {
    if (!checkRateLimit(client)) {
      socket.emit("error:rate-limit", { message: "Rate limit exceeded" });
      return;
    }
    handleTypingStart(io, socket, data);
  });

  socket.on("typing:stop", (data: { conversationId: string }) => {
    handleTypingStop(io, socket, data);
  });

  socket.on("presence:ping", () => {
    client.lastActivity = Date.now();
    socket.emit("presence:pong", { timestamp: new Date().toISOString() });
  });

  // ─── Chat Handlers ────────────────────────────────────────────────────────

  socket.on("chat:join", (data: { channel: string }) => {
    if (!data.channel || typeof data.channel !== "string") return;
    const roomName = `channel:${user.companyId}:${data.channel}`;
    socket.join(roomName);
    console.log(`[CHAT] ${user.email} joined channel: ${data.channel}`);
  });

  socket.on("chat:leave", (data: { channel: string }) => {
    if (!data.channel || typeof data.channel !== "string") return;
    const roomName = `channel:${user.companyId}:${data.channel}`;
    socket.leave(roomName);
    console.log(`[CHAT] ${user.email} left channel: ${data.channel}`);
  });

  socket.on("chat:message", (data: { channel: string; message: unknown }) => {
    if (!checkRateLimit(client)) {
      socket.emit("error:rate-limit", { message: "Rate limit exceeded" });
      return;
    }
    if (!data.channel || typeof data.channel !== "string") return;
    const roomName = `channel:${user.companyId}:${data.channel}`;
    // Broadcast to all users in this channel room
    io.to(roomName).emit("chat:message", data.message);
  });

  // ─── Reconnection Handling ─────────────────────────────────────────────────
  // On reconnect, client will re-join rooms via auth middleware above
  // We also emit missed events summary if needed

  socket.on("reconnect:sync", (data: { lastEventId?: string }) => {
    // Client can request a sync of events they missed
    // For now, we emit the current state
    const onlineUsers = getOnlineUsersForCompany(user.companyId);
    socket.emit("presence:online", { userIds: onlineUsers });
    socket.emit("reconnect:complete", { timestamp: new Date().toISOString() });
  });

  // ─── Disconnect Handler ────────────────────────────────────────────────────

  socket.on("disconnect", (reason) => {
    console.log(`[DISCONNECT] ${user.email} (${socket.id}) reason: ${reason}`);

    // Remove from clients map
    clients.delete(socket.id);

    // Remove from user sockets
    const sockets = userSockets.get(user.userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(user.userId);
        // User is fully offline
        broadcastPresence(io, user.userId, user.companyId, "offline");
      }
    }

    // Clean up typing states for this socket
    for (const [key, state] of typingStates) {
      if (key.startsWith(`${socket.id}:`)) {
        io.to(`company:${user.companyId}`).emit("typing:stop", {
          userId: user.userId,
          conversationId: state.conversationId,
        });
        typingStates.delete(key);
      }
    }

    // Leave all rooms
    for (const room of rooms) {
      socket.leave(room);
    }
  });

  socket.on("error", (err) => {
    console.error(`[ERROR] Socket ${socket.id}:`, err.message);
  });
});

// ─── Start Push HTTP Server ───────────────────────────────────────────────────────────

pushServer.listen(PUSH_PORT, () => {
  console.log(`[AISMH] Push API running on port ${PUSH_PORT}`);
});

// ─── Presence Heartbeat Cleanup ────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  const staleThreshold = now - (PRESENCE_HEARTBEAT_MS * 3); // 3 missed heartbeats
  let staleCount = 0;

  for (const [socketId, client] of clients) {
    if (client.lastActivity < staleThreshold) {
      // Force disconnect stale connections
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        staleCount++;
      }
    }
  }

  if (staleCount > 0) {
    console.log(`[HEALTH] Disconnected ${staleCount} stale connections`);
  }
}, PRESENCE_HEARTBEAT_MS);

// ─── Start Server ─────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[AISMH] Real-time service running on port ${PORT}`);
  console.log(`[AISMH] Push endpoint: POST http://localhost:${PUSH_PORT}/push`);
  console.log(`[AISMH] Rate limit: ${RATE_LIMIT_MAX_EVENTS} events/${RATE_LIMIT_WINDOW_MS / 1000}s per connection`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────────

function shutdown(signal: string) {
  console.log(`[AISMH] Received ${signal}, shutting down...`);
  io.close();
  httpServer.close();
  pushServer.close(() => {
    console.log("[AISMH] Servers closed");
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log("[AISMH] Forced exit after timeout");
    process.exit(1);
  }, 5_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));