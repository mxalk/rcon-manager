import type { ConsoleServerMessage, PublicUser, ServerPermission } from "./types.js";

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function parseConsoleMessage(raw: string): ConsoleServerMessage | null {
  try {
    return JSON.parse(raw) as ConsoleServerMessage;
  } catch {
    return null;
  }
}

export function hasServerPermission(user: PublicUser, serverId: string): boolean {
  return user.serverPermissions.some((permission) => permission.serverId === serverId);
}

export function buildServerPermissions(
  user: PublicUser,
  serverId: string,
  hasAccess: boolean
): ServerPermission[] {
  const permissions = user.serverPermissions.filter((permission) => permission.serverId !== serverId);

  if (!hasAccess) {
    return permissions;
  }

  return [...permissions, { serverId }].sort((left, right) => left.serverId.localeCompare(right.serverId));
}
