import { Router, type RequestHandler } from "express";

import type { TokenExpiry } from "../auth.js";
import { LoginRateLimiter } from "../app/loginRateLimiter.js";
import type { RconManager } from "../rconManager.js";
import type { AppDatabase } from "../storage/database.js";
import type { ConsoleEntry } from "../types.js";
import { registerAdminRoutes } from "./adminRoutes.js";
import { registerAuthRoutes } from "./authRoutes.js";
import { registerHealthRoutes } from "./healthRoutes.js";
import { registerServerRoutes } from "./serverRoutes.js";
import { registerUserRoutes } from "./userRoutes.js";

interface SocketHub {
  broadcastEntry: (serverId: string, entry: ConsoleEntry) => void;
}

interface ApiRoutesDeps {
  db: AppDatabase;
  requireAuth: RequestHandler;
  hardAdminUsername: string;
  jwtSecret: string;
  jwtExpiresIn: TokenExpiry;
  loginRateLimiter: LoginRateLimiter;
  rconManager: RconManager;
  socketHub: SocketHub;
  maxCommandLength: number;
}

export function createApiRouter(deps: ApiRoutesDeps): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Vary", "Authorization");
    next();
  });

  registerHealthRoutes(router);
  registerAuthRoutes(router, {
    db: deps.db,
    hardAdminUsername: deps.hardAdminUsername,
    jwtSecret: deps.jwtSecret,
    jwtExpiresIn: deps.jwtExpiresIn,
    requireAuth: deps.requireAuth,
    loginRateLimiter: deps.loginRateLimiter
  });
  registerAdminRoutes(router, {
    db: deps.db,
    requireAuth: deps.requireAuth
  });
  registerServerRoutes(router, {
    db: deps.db,
    requireAuth: deps.requireAuth,
    rconManager: deps.rconManager,
    socketHub: deps.socketHub,
    maxCommandLength: deps.maxCommandLength
  });
  registerUserRoutes(router, {
    db: deps.db,
    requireAuth: deps.requireAuth,
    hardAdminUsername: deps.hardAdminUsername
  });

  return router;
}
