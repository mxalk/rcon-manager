import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler, type Response } from "express";

import { requireRoles } from "../auth.js";
import { sanitizeConsoleEntry } from "../app/consoleSanitization.js";
import { canAccessServer, hasServerAccess } from "../app/permissions.js";
import { sanitizeServer, validateServerPayload } from "../app/validation.js";
import type { RconManager } from "../rconManager.js";
import type { AppDatabase } from "../storage/database.js";
import type { ConsoleEntry, ServerPayload, StoredServer } from "../types.js";
import { canRunCommands } from "../config.js";

interface SocketHub {
  broadcastEntry: (serverId: string, entry: ConsoleEntry) => void;
}

interface ServerRoutesDeps {
  db: AppDatabase;
  requireAuth: RequestHandler;
  rconManager: RconManager;
  socketHub: SocketHub;
  maxCommandLength: number;
}

export function registerServerRoutes(appRouter: Router, deps: ServerRoutesDeps): void {
  const { db, requireAuth, rconManager, socketHub, maxCommandLength } = deps;

  async function findServerById(serverId: string): Promise<StoredServer | undefined> {
    const servers = await db.readServers();
    return servers.find((item) => item.id === serverId);
  }

  appRouter.get("/servers", requireAuth, async (req: Request, res: Response) => {
    const servers = await db.readServers();
    const visibleServers =
      req.user!.role === "admin"
        ? servers
        : servers.filter((serverConfig) => canAccessServer(req.user!, serverConfig.id));

    res.json({
      servers: visibleServers.map((item) => sanitizeServer(item))
    });
  });

  appRouter.post("/servers", requireAuth, requireRoles("admin"), async (req: Request<{}, {}, ServerPayload>, res: Response) => {
    const { errors, value } = validateServerPayload(req.body);
    if (errors.length > 0 || value.port === null) {
      res.status(400).json({ error: errors.join(", ") });
      return;
    }

    const servers = await db.readServers();
    const now = new Date().toISOString();
    const serverConfig: StoredServer = {
      id: randomUUID(),
      name: value.name,
      host: value.host,
      port: value.port,
      password: value.password,
      createdAt: now,
      updatedAt: now
    };

    servers.push(serverConfig);
    await db.writeServers(servers);

    res.status(201).json({ server: sanitizeServer(serverConfig) });
  });

  appRouter.put(
    "/servers/:id",
    requireAuth,
    requireRoles("admin"),
    async (req: Request<{ id: string }, {}, ServerPayload>, res: Response) => {
      const updates = req.body || {};
      const { errors, value } = validateServerPayload(updates, { partial: true });
      if (errors.length > 0) {
        res.status(400).json({ error: errors.join(", ") });
        return;
      }

      const servers = await db.readServers();
      const index = servers.findIndex((item) => item.id === req.params.id);

      if (index === -1) {
        res.status(404).json({ error: "Server not found" });
        return;
      }

      const current = servers[index]!;
      servers[index] = {
        ...current,
        ...(updates.name !== undefined ? { name: value.name } : {}),
        ...(updates.host !== undefined ? { host: value.host } : {}),
        ...(updates.port !== undefined && value.port !== null ? { port: value.port } : {}),
        ...(updates.password !== undefined ? { password: value.password } : {}),
        updatedAt: new Date().toISOString()
      };

      await db.writeServers(servers);
      await rconManager.disconnect(req.params.id);

      res.json({ server: sanitizeServer(servers[index]!) });
    }
  );

  appRouter.delete("/servers/:id", requireAuth, requireRoles("admin"), async (req: Request<{ id: string }>, res: Response) => {
    const servers = await db.readServers();
    const next = servers.filter((item) => item.id !== req.params.id);

    if (next.length === servers.length) {
      res.status(404).json({ error: "Server not found" });
      return;
    }

    await db.writeServers(next);
    const users = await db.readUsers();
    const updatedUsers = users.map((user) => ({
      ...user,
      serverPermissions: user.serverPermissions.filter((permission) => permission.serverId !== req.params.id)
    }));
    await db.writeUsers(updatedUsers);
    await rconManager.disconnect(req.params.id);
    res.status(204).send();
  });

  appRouter.get(
    "/servers/:id/history",
    requireAuth,
    async (req: Request<{ id: string }, {}, {}, { limit?: string }>, res: Response) => {
      const serverConfig = await findServerById(req.params.id);
      if (!serverConfig) {
        res.status(404).json({ error: "Server not found" });
        return;
      }

      if (!canAccessServer(req.user!, req.params.id)) {
        res.status(403).json({ error: "Not authorized for this server" });
        return;
      }

      const limit = Number.parseInt(req.query.limit || "250", 10);
      const entries = await db.readConsoleEntries(req.params.id, Math.min(1000, Math.max(1, limit || 250)));
      res.json({ entries });
    }
  );

  appRouter.post(
    "/servers/:id/command",
    requireAuth,
    async (req: Request<{ id: string }, {}, { command?: string }>, res: Response) => {
      const command = String(req.body?.command || "").trim();
      if (!command) {
        res.status(400).json({ error: "command is required" });
        return;
      }
      if (command.length > maxCommandLength) {
        res.status(400).json({ error: `command exceeds ${maxCommandLength} characters` });
        return;
      }

      const serverConfig = await findServerById(req.params.id);
      if (!serverConfig) {
        res.status(404).json({ error: "Server not found" });
        return;
      }

      if (!canRunCommands(req.user!.role, hasServerAccess(req.user!, req.params.id))) {
        res.status(403).json({ error: "Not authorized for this server" });
        return;
      }

      const startedAt = new Date().toISOString();

      try {
        const response = await rconManager.execute(serverConfig, command);
        const entry: ConsoleEntry = {
          id: randomUUID(),
          serverId: req.params.id,
          userId: req.user!.id,
          username: req.user!.username,
          command,
          response,
          status: "ok",
          timestamp: startedAt
        };
        const safeEntry = sanitizeConsoleEntry(entry);

        await db.appendConsoleEntry(safeEntry);
        socketHub.broadcastEntry(req.params.id, safeEntry);

        res.json({ entry: safeEntry });
      } catch (error: unknown) {
        const entry: ConsoleEntry = {
          id: randomUUID(),
          serverId: req.params.id,
          userId: req.user!.id,
          username: req.user!.username,
          command,
          response: "",
          status: "error",
          error: error instanceof Error ? error.message : "Command failed",
          timestamp: startedAt
        };
        const safeEntry = sanitizeConsoleEntry(entry);

        await db.appendConsoleEntry(safeEntry);
        socketHub.broadcastEntry(req.params.id, safeEntry);

        res.status(500).json({ entry: safeEntry, error: safeEntry.error });
      }
    }
  );
}
