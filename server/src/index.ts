// Source-available: commercial use requires explicit written permission from the Licensor.
// See LICENSE and NOTICE in the repository root.
import http from "node:http";

import express from "express";

import { authMiddleware, verifyToken } from "./auth.js";
import type { TokenExpiry } from "./auth.js";
import { ensureDefaultAdminUser } from "./app/bootstrap.js";
import { registerBaseHttpMiddleware, registerNotFoundHandler } from "./app/httpMiddleware.js";
import { LoginRateLimiter } from "./app/loginRateLimiter.js";
import { hasServerAccess } from "./app/permissions.js";
import { registerStaticClient } from "./app/staticClient.js";
import { config, canRunCommands } from "./config.js";
import { setupConsoleSocket } from "./consoleSocket.js";
import { RconManager } from "./rconManager.js";
import { createApiRouter } from "./routes/index.js";
import { createDatabase } from "./storage/index.js";
import type { StoredServer } from "./types.js";

const app = express();
const server = http.createServer(app);
const db = createDatabase();
const hardAdminUsername = config.defaultAdminUsername;

const rconManager = new RconManager({
  timeoutMs: config.rconTimeoutMs,
  idleTimeoutMs: config.rconIdleTimeoutMs
});

const loginRateLimiter = new LoginRateLimiter({
  maxAttempts: config.loginRateLimitMaxAttempts,
  windowMs: config.loginRateLimitWindowMs,
  maxTrackedKeys: config.loginRateLimitMaxTrackedKeys
});

async function findServerById(serverId: string): Promise<StoredServer | undefined> {
  const servers = await db.readServers();
  return servers.find((item) => item.id === serverId);
}

const socketHub = setupConsoleSocket({
  httpServer: server,
  verifyToken: (token: string) => verifyToken(token, db, config.jwtSecret),
  db,
  findServerById,
  hasServerAccess,
  canRunCommands,
  checkConnection: (serverConfig: StoredServer) => rconManager.checkConnection(serverConfig),
  executeCommand: (serverConfig: StoredServer, command: string) => rconManager.execute(serverConfig, command),
  maxCommandLength: config.maxCommandLength,
  maxPayloadBytes: config.wsMaxPayloadBytes,
  allowedOrigins: config.allowedOrigins
});

// behind a reverse proxy, req.ip (login rate limiting, auth logs) must be the real client, not the proxy
app.set("trust proxy", config.trustProxy);
registerBaseHttpMiddleware(app, config.allowedOrigins);
app.use(express.json({ limit: "64kb", strict: true, type: "application/json" }));

const requireAuth = authMiddleware(db, config.jwtSecret);
app.use(
  "/api",
  createApiRouter({
    db,
    requireAuth,
    hardAdminUsername,
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn as TokenExpiry,
    loginRateLimiter,
    rconManager,
    socketHub,
    maxCommandLength: config.maxCommandLength
  })
);

registerStaticClient(app);
registerNotFoundHandler(app);

async function start(): Promise<void> {
  const dataDir = await db.init();
  await ensureDefaultAdminUser({
    db,
    hardAdminUsername,
    defaultAdminPassword: config.defaultAdminPassword
  });

  server.listen(config.port, () => {
    console.log(`RCON manager backend listening on :${config.port}`);
    console.log(`Using data directory: ${dataDir}`);
  });
}

async function shutdown(): Promise<void> {
  await socketHub.close();
  await rconManager.shutdown();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
