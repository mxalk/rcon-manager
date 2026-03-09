export const accountRoles = ["admin", "user"] as const;

export type AccountRole = (typeof accountRoles)[number];

export interface ServerPermission {
  serverId: string;
}

export interface PublicUser {
  id: string;
  username: string;
  role: AccountRole;
  isReservedAdmin?: boolean;
  serverPermissions: ServerPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredUser extends PublicUser {
  passwordHash: string;
}

export interface LegacyStoredUser {
  id: string;
  username: string;
  role?: "admin" | "operator" | "viewer" | "user";
  passwordHash: string;
  serverPermissions?: ServerPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicServer {
  id: string;
  name: string;
  host: string;
  port: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredServer extends PublicServer {
  password: string;
}

export interface ConsoleEntry {
  id: string;
  serverId: string;
  userId: string;
  username: string;
  command: string;
  response: string;
  status: "ok" | "error";
  error?: string;
  timestamp: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: AccountRole;
  serverPermissions: ServerPermission[];
}

export interface LoginRequestBody {
  username: string;
  password: string;
}

export interface ServerPayload {
  name?: string;
  host?: string;
  port?: number | string;
  password?: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: AccountRole;
  serverPermissions?: ServerPermission[];
}

export interface UpdateUserPayload {
  username?: string;
  role?: AccountRole;
  serverPermissions?: ServerPermission[];
}

export interface UpdatePasswordPayload {
  password: string;
}

export type ConsoleServerMessage =
  | {
      type: "ready";
      serverId: string;
      user: AuthUser;
      canRunCommands: boolean;
    }
  | {
      type: "status";
      serverId: string;
      rconConnected: boolean;
    }
  | { type: "history"; serverId: string; entries: ConsoleEntry[] }
  | { type: "entry"; serverId: string; entry: ConsoleEntry }
  | { type: "pong"; at: string }
  | { type: "error"; message: string };
