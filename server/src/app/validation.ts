import type { PublicServer, ServerPayload, StoredServer } from "../types.js";

export function sanitizeServer(serverConfig: StoredServer): PublicServer {
  const { password: _password, ...safe } = serverConfig;
  return safe;
}

function normalizePort(rawPort: number | string | undefined): number | null {
  const value = Number.parseInt(String(rawPort), 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return null;
  }

  return value;
}

export function validateServerPayload(
  payload: ServerPayload,
  { partial = false }: { partial?: boolean } = {}
): {
  errors: string[];
  value: { name: string; host: string; port: number | null; password: string };
} {
  const errors: string[] = [];

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const host = typeof payload.host === "string" ? payload.host.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const port = payload.port;

  if (!partial || payload.name !== undefined) {
    if (!name) {
      errors.push("name is required");
    }
  }

  if (!partial || payload.host !== undefined) {
    if (!host) {
      errors.push("host is required");
    }
  }

  if (!partial || payload.port !== undefined) {
    if (normalizePort(port) === null) {
      errors.push("port must be a valid TCP port");
    }
  }

  if (!partial || payload.password !== undefined) {
    if (!password) {
      errors.push("password is required");
    }
  }

  return {
    errors,
    value: {
      name,
      host,
      port: normalizePort(port),
      password
    }
  };
}

export function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(username);
}

export function validatePassword(password: string): boolean {
  return password.length >= 8;
}
