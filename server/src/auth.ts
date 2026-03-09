import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { AppDatabase } from "./storage/database.js";
import type { AccountRole, AuthUser, PublicUser, StoredUser } from "./types.js";

export type TokenExpiry = NonNullable<jwt.SignOptions["expiresIn"]>;

interface TokenPayload extends jwt.JwtPayload {
  sub: string;
  username: string;
  role: AccountRole;
}

const TRANSPORT_PASSWORD_PREFIX = "sha256:";
const DUMMY_PASSWORD_DIGEST = createHash("sha256").update("rcon-manager-dummy-password").digest("hex");

// Timing-safe fallback hash used when username does not exist, to reduce account enumeration signal.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(DUMMY_PASSWORD_DIGEST, 10);

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function normalizePasswordInput(password: string): string {
  if (password.startsWith(TRANSPORT_PASSWORD_PREFIX)) {
    const digest = password.slice(TRANSPORT_PASSWORD_PREFIX.length);
    if (isSha256Hex(digest)) {
      return digest.toLowerCase();
    }
  }

  return createHash("sha256").update(password).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(normalizePasswordInput(password), 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const normalized = normalizePasswordInput(password);
  if (await bcrypt.compare(normalized, hash)) {
    return true;
  }

  // Compatibility path for older password hashes produced before transport normalization.
  return bcrypt.compare(password, hash);
}

export function createToken(user: AuthUser, jwtSecret: string, jwtExpiresIn: TokenExpiry): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: jwtExpiresIn
    }
  );
}

export async function verifyToken(
  token: string,
  db: AppDatabase,
  jwtSecret: string
): Promise<AuthUser> {
  const decoded = jwt.verify(token, jwtSecret, {
    algorithms: ["HS256"]
  }) as TokenPayload;
  const users = await db.readUsers();
  const user = users.find((item) => item.id === decoded.sub);

  if (!user) {
    throw new Error("User does not exist");
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    serverPermissions: user.serverPermissions
  };
}

export function authMiddleware(db: AppDatabase, jwtSecret: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization || "";
      const [scheme, token] = header.split(" ");

      if (scheme !== "Bearer" || !token) {
        res.status(401).json({ error: "Missing Bearer token" });
        return;
      }

      req.user = await verifyToken(token, db, jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

export function requireRoles(...allowedRoles: AccountRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    next();
  };
}

export function sanitizeUser(user: StoredUser, reservedAdminUsername?: string): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    ...(reservedAdminUsername ? { isReservedAdmin: user.username === reservedAdminUsername } : {}),
    serverPermissions: user.serverPermissions,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
