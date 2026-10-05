import { randomBytes } from "node:crypto";
import { accessSync, chmodSync, constants as fsConstants, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { accountRoles, type AccountRole } from "./types.js";

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const origins = new Set<string>();
  for (const item of value.split(",")) {
    const candidate = item.trim();
    if (!candidate) {
      continue;
    }

    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }
      origins.add(parsed.origin);
    } catch {
      // Ignore invalid origin entries.
    }
  }

  return [...origins];
}

/**
 * Express "trust proxy": which hops in front of the app may set X-Forwarded-For. Unset = none (the socket address
 * is the client). A number = that many hops; "true" = any (only safe when nothing else can reach the app);
 * otherwise addresses/subnets, comma-separated (e.g. the reverse proxy's IP).
 */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  const raw = value?.trim();
  if (!raw || raw === "false") {
    return false;
  }
  if (raw === "true") {
    return true;
  }
  if (/^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }
  return raw;
}

function resolveWritableDataDir(): string | null {
  const candidates: string[] = [];

  if (process.env.DATA_DIR) {
    candidates.push(process.env.DATA_DIR);
  }

  candidates.push("/data");
  candidates.push(path.resolve(process.cwd(), "..", "data"));
  candidates.push(path.resolve(process.cwd(), "data"));

  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true, mode: 0o700 });
      accessSync(candidate, fsConstants.R_OK | fsConstants.W_OK);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function readPersistedSecret(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const value = readFileSync(filePath, "utf8").trim();
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function persistSecret(filePath: string, secret: string): void {
  writeFileSync(filePath, `${secret}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best-effort only for filesystems without chmod semantics.
  }
}

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    return configured;
  }

  const dataDir = resolveWritableDataDir();
  if (dataDir) {
    const secretPath = path.join(dataDir, "jwt-secret");
    const persisted = readPersistedSecret(secretPath);
    if (persisted) {
      console.warn(`[config] JWT_SECRET not set; using persisted secret from ${secretPath}.`);
      return persisted;
    }

    const generated = randomBytes(32).toString("base64url");
    persistSecret(secretPath, generated);
    console.warn(`[config] JWT_SECRET not set; generated and persisted secret at ${secretPath}.`);
    return generated;
  }

  const fallback = randomBytes(32).toString("base64url");
  console.warn("[config] JWT_SECRET not set and no writable data directory found; using ephemeral secret.");
  return fallback;
}

export const config = {
  port: parsePositiveInteger(process.env.PORT, 3001),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || "admin",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "",
  rconTimeoutMs: parsePositiveInteger(process.env.RCON_TIMEOUT_MS, 8000),
  rconIdleTimeoutMs: parsePositiveInteger(process.env.RCON_IDLE_TIMEOUT_MS, 120000),
  maxCommandLength: parsePositiveInteger(process.env.MAX_COMMAND_LENGTH, 512),
  wsMaxPayloadBytes: parsePositiveInteger(process.env.WS_MAX_PAYLOAD_BYTES, 64 * 1024),
  loginRateLimitMaxAttempts: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 10),
  loginRateLimitWindowMs: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  loginRateLimitMaxTrackedKeys: parsePositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX_TRACKED_KEYS, 10000),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY)
};

export { accountRoles };

export function canRunCommands(role: AccountRole, hasServerAccess: boolean): boolean {
  return role === "admin" || hasServerAccess;
}
