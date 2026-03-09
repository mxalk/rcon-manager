import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { sanitizeConsoleEntry } from "./app/consoleSanitization.js";
import type { AppDatabase } from "./storage/database.js";
import type {
  AuthUser,
  ConsoleEntry,
  ConsoleServerMessage,
  StoredServer
} from "./types.js";

interface SocketContext {
  token: string;
  user: AuthUser;
  serverId: string;
}

interface SetupConsoleSocketOptions {
  httpServer: HttpServer;
  verifyToken: (token: string) => Promise<AuthUser>;
  db: AppDatabase;
  findServerById: (serverId: string) => Promise<StoredServer | undefined>;
  hasServerAccess: (user: AuthUser, serverId: string) => boolean;
  canRunCommands: (role: AuthUser["role"], hasServerAccess: boolean) => boolean;
  checkConnection: (serverConfig: StoredServer) => Promise<boolean>;
  executeCommand: (serverConfig: StoredServer, command: string) => Promise<string>;
  maxCommandLength: number;
  maxPayloadBytes: number;
  allowedOrigins: string[];
}

function send(ws: WebSocket, payload: ConsoleServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function parseClientMessage(raw: WebSocket.RawData): unknown {
  try {
    return JSON.parse(raw.toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

function parseBearerHeader(authorizationHeader: string | string[] | undefined): string {
  const raw = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!raw) {
    return "";
  }

  const [scheme, token] = raw.split(" ");
  if ((scheme || "").toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

function parseProtocolToken(protocolHeader: string | string[] | undefined): string {
  const raw = Array.isArray(protocolHeader) ? protocolHeader.join(",") : protocolHeader;
  if (!raw) {
    return "";
  }

  const protocols = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const tokenProtocol = protocols.find((protocol) => protocol.startsWith("auth."));
  if (!tokenProtocol) {
    return "";
  }

  return tokenProtocol.slice("auth.".length).trim();
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) {
    return true;
  }

  if (!origin) {
    return false;
  }

  return allowedOrigins.includes(origin);
}

function destroyWithCode(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    ws.terminate();
  }
}

export function setupConsoleSocket({
  httpServer,
  verifyToken,
  db,
  findServerById,
  hasServerAccess,
  canRunCommands,
  checkConnection,
  executeCommand,
  maxCommandLength,
  maxPayloadBytes,
  allowedOrigins
}: SetupConsoleSocketOptions) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: maxPayloadBytes });
  const channels = new Map<string, Set<WebSocket>>();
  const contexts = new WeakMap<WebSocket, SocketContext>();

  function join(serverId: string, ws: WebSocket): void {
    if (!channels.has(serverId)) {
      channels.set(serverId, new Set());
    }
    channels.get(serverId)?.add(ws);
  }

  function leave(serverId: string, ws: WebSocket): void {
    const set = channels.get(serverId);
    if (!set) {
      return;
    }

    set.delete(ws);
    if (set.size === 0) {
      channels.delete(serverId);
    }
  }

  async function refreshAuthorization(ws: WebSocket): Promise<SocketContext | null> {
    const context = contexts.get(ws);
    if (!context) {
      destroyWithCode(ws, 4401, "Unauthorized");
      return null;
    }

    let user: AuthUser;
    try {
      user = await verifyToken(context.token);
    } catch {
      destroyWithCode(ws, 4401, "Unauthorized");
      return null;
    }

    if (user.role !== "admin" && !hasServerAccess(user, context.serverId)) {
      destroyWithCode(ws, 4403, "Forbidden");
      leave(context.serverId, ws);
      return null;
    }

    const updated: SocketContext = {
      ...context,
      user
    };
    contexts.set(ws, updated);
    return updated;
  }

  async function broadcastAuthorized(serverId: string, payload: ConsoleServerMessage): Promise<void> {
    const set = channels.get(serverId);
    if (!set) {
      return;
    }

    for (const client of [...set.values()]) {
      const context = await refreshAuthorization(client);
      if (!context) {
        continue;
      }
      if (context.serverId !== serverId) {
        leave(serverId, client);
        continue;
      }
      send(client, payload);
    }
  }

  async function sendHistory(ws: WebSocket, serverId: string, limit = 250): Promise<void> {
    const entries = await db.readConsoleEntries(serverId, limit);
    send(ws, {
      type: "history",
      serverId,
      entries
    });
  }

  async function sendConnectionStatus(ws: WebSocket, serverId: string): Promise<void> {
    const serverConfig = await findServerById(serverId);
    if (!serverConfig) {
      send(ws, {
        type: "status",
        serverId,
        rconConnected: false
      });
      return;
    }

    const rconConnected = await checkConnection(serverConfig);
    send(ws, {
      type: "status",
      serverId,
      rconConnected
    });
  }

  wss.on("connection", async (ws) => {
    const context = await refreshAuthorization(ws);
    if (!context) {
      return;
    }

    const { serverId, user } = context;

    join(serverId, ws);

    send(ws, {
      type: "ready",
      serverId,
      user,
      canRunCommands: canRunCommands(user.role, hasServerAccess(user, serverId))
    });

    await sendHistory(ws, serverId);
    await sendConnectionStatus(ws, serverId);

    ws.on("message", (raw) => {
      void (async () => {
        const authorized = await refreshAuthorization(ws);
        if (!authorized) {
          return;
        }

        const { serverId: activeServerId, user: activeUser } = authorized;

        const parsed = parseClientMessage(raw);
        if (!parsed || typeof parsed !== "object" || typeof (parsed as { type?: unknown }).type !== "string") {
          send(ws, { type: "error", message: "Invalid JSON payload" });
          return;
        }

        const type = (parsed as { type: string }).type;

        if (type === "ping") {
          send(ws, { type: "pong", at: new Date().toISOString() });
          return;
        }

        if (type === "history") {
          const candidateLimit = (parsed as { limit?: unknown }).limit;
          const limit =
            typeof candidateLimit === "number" && Number.isInteger(candidateLimit) ? candidateLimit : 250;
          await sendHistory(ws, activeServerId, Math.min(1000, Math.max(1, limit)));
          return;
        }

        if (!canRunCommands(activeUser.role, hasServerAccess(activeUser, activeServerId))) {
          send(ws, { type: "error", message: "You do not have command permission" });
          return;
        }

        if (type !== "command" || typeof (parsed as { command?: unknown }).command !== "string") {
          send(ws, { type: "error", message: "Unsupported message type" });
          return;
        }

        const command = (parsed as { command: string }).command.trim();
        if (!command) {
          send(ws, { type: "error", message: "Command is required" });
          return;
        }

        if (command.length > maxCommandLength) {
          send(ws, { type: "error", message: `Command exceeds ${maxCommandLength} characters` });
          return;
        }

        const serverConfig = await findServerById(activeServerId);
        if (!serverConfig) {
          send(ws, { type: "error", message: "Server not found" });
          return;
        }

        const startedAt = new Date().toISOString();

        try {
          const response = await executeCommand(serverConfig, command);
          const entry: ConsoleEntry = {
            id: randomUUID(),
            serverId: activeServerId,
            userId: activeUser.id,
            username: activeUser.username,
            command,
            response,
            status: "ok",
            timestamp: startedAt
          };
          const safeEntry = sanitizeConsoleEntry(entry);

          await db.appendConsoleEntry(safeEntry);
          await broadcastAuthorized(activeServerId, {
            type: "entry",
            serverId: activeServerId,
            entry: safeEntry
          });
          await broadcastAuthorized(activeServerId, {
            type: "status",
            serverId: activeServerId,
            rconConnected: true
          });
        } catch (error: unknown) {
          const entry: ConsoleEntry = {
            id: randomUUID(),
            serverId: activeServerId,
            userId: activeUser.id,
            username: activeUser.username,
            command,
            response: "",
            status: "error",
            error: error instanceof Error ? error.message : "Command failed",
            timestamp: startedAt
          };
          const safeEntry = sanitizeConsoleEntry(entry);

          await db.appendConsoleEntry(safeEntry);
          await broadcastAuthorized(activeServerId, {
            type: "entry",
            serverId: activeServerId,
            entry: safeEntry
          });
          await sendConnectionStatus(ws, activeServerId);
        }
      })().catch(() => {
        send(ws, { type: "error", message: "Unhandled websocket error" });
      });
    });

    ws.on("close", () => {
      leave(serverId, ws);
    });
  });

  httpServer.on("upgrade", async (req: IncomingMessage, socket, head) => {
    try {
      const origin = req.headers.origin;
      if (!isAllowedOrigin(origin, allowedOrigins)) {
        socket.destroy();
        return;
      }

      const url = new URL(req.url || "", "http://localhost");
      if (url.pathname !== "/ws") {
        socket.destroy();
        return;
      }

      const token =
        parseProtocolToken(req.headers["sec-websocket-protocol"]) ||
        parseBearerHeader(req.headers.authorization);

      if (!token) {
        socket.destroy();
        return;
      }

      const serverId = url.searchParams.get("serverId") || "";
      if (!serverId) {
        socket.destroy();
        return;
      }

      const serverConfig = await findServerById(serverId);
      if (!serverConfig) {
        socket.destroy();
        return;
      }

      const user = await verifyToken(token);
      if (user.role !== "admin" && !hasServerAccess(user, serverId)) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        contexts.set(ws, { token, user, serverId });
        wss.emit("connection", ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  return {
    broadcastEntry(serverId: string, entry: ConsoleEntry): void {
      void broadcastAuthorized(serverId, {
        type: "entry",
        serverId,
        entry
      });
    },
    async close(): Promise<void> {
      for (const clients of channels.values()) {
        for (const client of clients) {
          client.close();
        }
      }
      channels.clear();
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    }
  };
}
