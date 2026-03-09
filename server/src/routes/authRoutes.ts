import { Router, type Request, type RequestHandler, type Response } from "express";

import { createToken, DUMMY_PASSWORD_HASH, sanitizeUser, verifyPassword } from "../auth.js";
import type { TokenExpiry } from "../auth.js";
import { LoginRateLimiter } from "../app/loginRateLimiter.js";
import type { AppDatabase } from "../storage/database.js";
import type { LoginRequestBody } from "../types.js";

interface AuthRoutesDeps {
  db: AppDatabase;
  hardAdminUsername: string;
  jwtSecret: string;
  jwtExpiresIn: TokenExpiry;
  requireAuth: RequestHandler;
  loginRateLimiter: LoginRateLimiter;
}

function sanitizeForLog(value: string, maxLength = 128): string {
  return value
    .slice(0, maxLength)
    .replace(/[\r\n\t]/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();
}

function logLoginAttempt({
  req,
  username,
  result,
  reason
}: {
  req: Request;
  username: string;
  result: "success" | "failure" | "rate_limited";
  reason: string;
}): void {
  const at = new Date().toISOString();
  const ip = sanitizeForLog(req.ip || req.socket.remoteAddress || "unknown", 64);
  const user = sanitizeForLog(username || "-", 64);
  const userAgent = sanitizeForLog(String(req.headers["user-agent"] || "-"), 160);
  console.log(
    `[auth] login attempt at=${at} result=${result} reason=${reason} ip=${ip} username=${user} ua="${userAgent}"`
  );
}

export function registerAuthRoutes(appRouter: Router, deps: AuthRoutesDeps): void {
  const {
    db,
    hardAdminUsername,
    jwtSecret,
    jwtExpiresIn,
    requireAuth,
    loginRateLimiter
  } = deps;

  appRouter.post("/auth/login", async (req: Request<{}, {}, LoginRequestBody>, res: Response) => {
    const nowMs = Date.now();
    const rateLimitKey = loginRateLimiter.getKey(req);
    if (loginRateLimiter.isLimited(rateLimitKey, nowMs)) {
      const username = String(req.body?.username || "").trim();
      logLoginAttempt({
        req,
        username,
        result: "rate_limited",
        reason: "too_many_attempts"
      });
      res.status(429).json({ error: "Too many login attempts. Please try again later." });
      return;
    }

    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      loginRateLimiter.registerFailure(rateLimitKey, nowMs);
      logLoginAttempt({
        req,
        username,
        result: "failure",
        reason: "missing_credentials"
      });
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const users = await db.readUsers();
    const user = users.find((item) => item.username === username);
    const validPassword = await verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user || !validPassword) {
      loginRateLimiter.registerFailure(rateLimitKey, nowMs);
      logLoginAttempt({
        req,
        username,
        result: "failure",
        reason: "invalid_credentials"
      });
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    loginRateLimiter.clear(rateLimitKey);
    logLoginAttempt({
      req,
      username,
      result: "success",
      reason: "authenticated"
    });
    const token = createToken(user, jwtSecret, jwtExpiresIn);
    res.json({ token, user: sanitizeUser(user, hardAdminUsername) });
  });

  appRouter.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
    const users = await db.readUsers();
    const user = users.find((item) => item.id === req.user?.id);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: sanitizeUser(user, hardAdminUsername) });
  });
}
