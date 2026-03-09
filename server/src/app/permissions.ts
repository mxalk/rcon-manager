import type { AccountRole, ServerPermission, StoredServer, StoredUser } from "../types.js";

export function hasServerAccess(
  user: { role: AccountRole; serverPermissions: ServerPermission[] },
  serverId: string
): boolean {
  if (user.role === "admin") {
    return true;
  }

  return user.serverPermissions.some((permission) => permission.serverId === serverId);
}

export function canAccessServer(
  user: { role: AccountRole; serverPermissions: ServerPermission[] },
  serverId: string
): boolean {
  return hasServerAccess(user, serverId);
}

export function countAdmins(users: StoredUser[]): number {
  return users.filter((user) => user.role === "admin").length;
}

export function validateServerPermissions(
  permissions: ServerPermission[] | undefined,
  knownServers: StoredServer[]
): { errors: string[]; permissions: ServerPermission[] } {
  if (permissions === undefined) {
    return { errors: [], permissions: [] };
  }

  if (!Array.isArray(permissions)) {
    return { errors: ["serverPermissions must be an array"], permissions: [] };
  }

  const serverIds = new Set(knownServers.map((serverConfig) => serverConfig.id));
  const seen = new Set<string>();
  const errors: string[] = [];
  const normalized: ServerPermission[] = [];

  for (const permission of permissions) {
    if (!permission || typeof permission.serverId !== "string") {
      errors.push("serverPermissions entries must include serverId");
      continue;
    }

    if (!serverIds.has(permission.serverId)) {
      errors.push(`unknown server ${permission.serverId}`);
      continue;
    }

    if (seen.has(permission.serverId)) {
      errors.push(`duplicate permission for server ${permission.serverId}`);
      continue;
    }

    seen.add(permission.serverId);
    normalized.push({
      serverId: permission.serverId
    });
  }

  return { errors, permissions: normalized };
}
