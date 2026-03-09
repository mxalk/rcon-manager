export type AccountRole = "admin" | "user";

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

export interface ServerRecord {
  id: string;
  name: string;
  host: string;
  port: number;
  createdAt: string;
  updatedAt: string;
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

export interface LoginResponse {
  token: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}

export interface ServersResponse {
  servers: ServerRecord[];
}

export interface UsersResponse {
  users: PublicUser[];
}

export interface ServerResponse {
  server: ServerRecord;
}

export interface CleanupArtifactsResponse {
  deleted: string[];
  count: number;
}

export interface CleanupArtifactsStatusResponse {
  files: string[];
  count: number;
}

export interface ServerPayload {
  name?: string;
  host?: string;
  port?: number | string;
  password?: string;
}

export interface UserResponse {
  user: PublicUser;
}

interface ReadyMessage {
  type: "ready";
  serverId: string;
  user: Pick<PublicUser, "id" | "username" | "role" | "serverPermissions">;
  canRunCommands: boolean;
}

interface HistoryMessage {
  type: "history";
  serverId: string;
  entries: ConsoleEntry[];
}

interface StatusMessage {
  type: "status";
  serverId: string;
  rconConnected: boolean;
}

interface EntryMessage {
  type: "entry";
  serverId: string;
  entry: ConsoleEntry;
}

interface PongMessage {
  type: "pong";
  at: string;
}

interface ErrorMessage {
  type: "error";
  message: string;
}

export type ConsoleServerMessage =
  | ReadyMessage
  | StatusMessage
  | HistoryMessage
  | EntryMessage
  | PongMessage
  | ErrorMessage;

export interface CreateUserPayload {
  username: string;
  password: string;
  role: AccountRole;
  serverPermissions?: ServerPermission[];
}
