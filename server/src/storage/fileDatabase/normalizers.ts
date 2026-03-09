import type { LegacyStoredUser, ServerPermission, StoredUser } from "../../types.js";

function normalizeServerPermissions(serverPermissions: ServerPermission[] | undefined): ServerPermission[] {
  if (!Array.isArray(serverPermissions)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: ServerPermission[] = [];

  for (const permission of serverPermissions) {
    if (!permission || typeof permission.serverId !== "string") {
      continue;
    }

    if (seen.has(permission.serverId)) {
      continue;
    }

    seen.add(permission.serverId);
    normalized.push({
      serverId: permission.serverId
    });
  }

  return normalized;
}

export function normalizeUser(user: LegacyStoredUser): StoredUser {
  return {
    id: user.id,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role === "admin" ? "admin" : "user",
    serverPermissions: normalizeServerPermissions(user.serverPermissions),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
