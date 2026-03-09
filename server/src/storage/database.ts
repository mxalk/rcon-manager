import type { ConsoleEntry, StoredServer, StoredUser } from "../types.js";

export interface AppDatabase {
  init(): Promise<string>;
  getDataDir(): string;
  readUsers(): Promise<StoredUser[]>;
  writeUsers(users: StoredUser[]): Promise<void>;
  readServers(): Promise<StoredServer[]>;
  writeServers(servers: StoredServer[]): Promise<void>;
  readConsoleEntries(serverId: string, limit?: number): Promise<ConsoleEntry[]>;
  appendConsoleEntry(entry: ConsoleEntry, maxEntries?: number): Promise<void>;
  deleteBackupArtifacts(): Promise<string[]>;
  listBackupArtifacts(): Promise<string[]>;
}
