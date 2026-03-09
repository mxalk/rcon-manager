import { promises as fsPromises, constants as fsConstants } from "node:fs";
import path from "node:path";

import type { AppDatabase } from "../database.js";
import type { ConsoleEntry, LegacyStoredUser, StoredServer, StoredUser } from "../../types.js";
import {
  DEFAULT_CONSOLE_MAX_LINES,
  DEFAULT_SERVERS,
  DEFAULT_USERS,
  STORAGE_VERSION,
  type VersionedFile,
  type VersionedServersFile,
  type VersionedUsersFile
} from "./constants.js";
import { sanitizeConsoleEntry } from "../../app/consoleSanitization.js";
import { normalizeUser } from "./normalizers.js";
import { resolveConsoleMaxLines, resolveDataDir } from "./paths.js";
import {
  parseVersionedFile,
  parseVersionedServersFile,
  parseVersionedUsersFile,
} from "./versioning.js";

const { access, appendFile, chmod, copyFile, readFile, readdir, rename, unlink, writeFile } = fsPromises;

export class FileDatabase implements AppDatabase {
  dataDir = "";
  usersPath = "";
  serversPath = "";
  consolePath = "";
  consoleEntryCount = 0;
  consoleMaxLines = DEFAULT_CONSOLE_MAX_LINES;
  writeQueue: Promise<void> = Promise.resolve();

  async init(): Promise<string> {
    this.dataDir = await resolveDataDir();
    this.usersPath = path.join(this.dataDir, "users.json");
    this.serversPath = path.join(this.dataDir, "servers.json");
    this.consolePath = path.join(this.dataDir, "console.jsonl");
    const legacyConsolePath = path.join(this.dataDir, "console.json");

    await this.ensureUsersFile();
    this.consoleMaxLines = resolveConsoleMaxLines();
    await this.ensureServersFile();
    await this.ensureConsoleLogFile(legacyConsolePath);
    await this.lockDownPermissions();

    return this.dataDir;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  async readUsers(): Promise<StoredUser[]> {
    const users = await this.readVersionedUsersJson(this.usersPath, DEFAULT_USERS);
    return users.map(normalizeUser);
  }

  async writeUsers(users: StoredUser[]): Promise<void> {
    await this.enqueueWrite(async () =>
      this.writeJsonAtomic(this.usersPath, {
        version: STORAGE_VERSION,
        users
      })
    );
  }

  private async ensureUsersFile(): Promise<void> {
    try {
      await access(this.usersPath, fsConstants.F_OK);
    } catch {
      await this.writeJsonAtomic(this.usersPath, DEFAULT_USERS);
      return;
    }

    await this.readVersionedUsersJson(this.usersPath, DEFAULT_USERS);
  }

  async readServers(): Promise<StoredServer[]> {
    return this.readVersionedServersJson(this.serversPath, DEFAULT_SERVERS);
  }

  async writeServers(servers: StoredServer[]): Promise<void> {
    await this.enqueueWrite(async () =>
      this.writeJsonAtomic(this.serversPath, {
        version: STORAGE_VERSION,
        servers
      })
    );
  }

  private async ensureServersFile(): Promise<void> {
    try {
      await access(this.serversPath, fsConstants.F_OK);
    } catch {
      await this.writeJsonAtomic(this.serversPath, DEFAULT_SERVERS);
      return;
    }

    await this.readVersionedServersJson(this.serversPath, DEFAULT_SERVERS);
  }

  async readConsoleEntries(serverId: string, limit = 200): Promise<ConsoleEntry[]> {
    const entries = await this.readConsoleLogEntries();
    const filtered = entries.filter((entry) => entry.serverId === serverId);
    return filtered.slice(Math.max(0, filtered.length - limit));
  }

  async appendConsoleEntry(entry: ConsoleEntry, maxEntries = this.consoleMaxLines): Promise<void> {
    await this.enqueueWrite(async () => {
      const safeEntry = sanitizeConsoleEntry(entry);
      await appendFile(this.consolePath, `${JSON.stringify(safeEntry)}\n`, {
        encoding: "utf8",
        mode: 0o600
      });
      this.consoleEntryCount += 1;

      if (this.consoleEntryCount > maxEntries) {
        const entries = await this.readConsoleLogEntries();
        if (entries.length > maxEntries) {
          await this.writeConsoleLogEntries(entries.slice(entries.length - maxEntries));
        } else {
          this.consoleEntryCount = entries.length;
        }
      }
    });
  }

  async deleteBackupArtifacts(): Promise<string[]> {
    const deleted: string[] = [];
    const artifacts = await this.listBackupArtifacts();

    for (const artifactName of artifacts) {
      const fullPath = path.join(this.dataDir, artifactName);
      try {
        await unlink(fullPath);
        deleted.push(artifactName);
      } catch {
        // Ignore transient file errors and continue best-effort cleanup.
      }
    }

    return deleted.sort();
  }

  async listBackupArtifacts(): Promise<string[]> {
    const artifacts: string[] = [];
    const entries = await readdir(this.dataDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      if (!entry.name.endsWith(".bk") && !entry.name.endsWith(".migrated")) {
        continue;
      }
      artifacts.push(entry.name);
    }

    return artifacts.sort();
  }

  private async ensureConsoleLogFile(legacyConsolePath: string): Promise<void> {
    try {
      await access(this.consolePath, fsConstants.F_OK);
      this.consoleEntryCount = await this.countConsoleEntries();
      return;
    } catch {
      // Continue to migration/bootstrap path.
    }

    try {
      await access(legacyConsolePath, fsConstants.F_OK);
      const legacy = await this.readVersionedJson(
        legacyConsolePath,
        { version: STORAGE_VERSION, data: { entries: [] as ConsoleEntry[] } }
      );
      await this.writeConsoleLogEntries(Array.isArray(legacy.entries) ? legacy.entries : []);
      await rename(legacyConsolePath, `${legacyConsolePath}.migrated`);
      return;
    } catch {
      // No legacy file or migration failed, bootstrap empty log.
    }

    await writeFile(this.consolePath, "", {
      encoding: "utf8",
      mode: 0o600
    });
    this.consoleEntryCount = 0;
  }

  private async readConsoleLogEntries(): Promise<ConsoleEntry[]> {
    try {
      const raw = await readFile(this.consolePath, "utf8");
      if (!raw.trim()) {
        return [];
      }
      const entries: ConsoleEntry[] = [];
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          entries.push(sanitizeConsoleEntry(JSON.parse(trimmed) as ConsoleEntry));
        } catch {
          // Skip malformed lines instead of failing all reads.
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  private async writeConsoleLogEntries(entries: ConsoleEntry[]): Promise<void> {
    const payload = entries.map((entry) => JSON.stringify(entry)).join("\n");
    await writeFile(this.consolePath, payload.length > 0 ? `${payload}\n` : "", {
      encoding: "utf8",
      mode: 0o600
    });
    this.consoleEntryCount = entries.length;
  }

  private async countConsoleEntries(): Promise<number> {
    const entries = await this.readConsoleLogEntries();
    return entries.length;
  }

  private async readVersionedJson<T>(
    filePath: string,
    fallback: VersionedFile<T>
  ): Promise<T> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const { version, data } = parseVersionedFile<T>(parsed);

      if (version !== STORAGE_VERSION) {
        throw new Error(`Unsupported storage version ${version} for ${path.basename(filePath)}; expected ${STORAGE_VERSION}`);
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unsupported storage version")) {
        throw error;
      }

      return fallback.data;
    }
  }

  private async readVersionedServersJson(
    filePath: string,
    fallback: VersionedServersFile
  ): Promise<StoredServer[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const normalized = parseVersionedServersFile(parsed, fallback);

      if (normalized.version !== STORAGE_VERSION) {
        throw new Error(
          `Unsupported storage version ${normalized.version} for ${path.basename(filePath)}; expected ${STORAGE_VERSION}`
        );
      }

      // Canonicalize on disk to { version, servers } (no "data" wrapper).
      if (!normalized.isCanonical) {
        await this.writeJsonAtomic(filePath, {
          version: STORAGE_VERSION,
          servers: normalized.servers
        });
      }

      return normalized.servers;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unsupported storage version")) {
        throw error;
      }

      return fallback.servers;
    }
  }

  private async readVersionedUsersJson(
    filePath: string,
    fallback: VersionedUsersFile
  ): Promise<LegacyStoredUser[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const normalized = parseVersionedUsersFile(parsed, fallback);

      if (normalized.version !== STORAGE_VERSION) {
        throw new Error(
          `Unsupported storage version ${normalized.version} for ${path.basename(filePath)}; expected ${STORAGE_VERSION}`
        );
      }

      // Canonicalize on disk to { version, users } (no "data" wrapper).
      if (!normalized.isCanonical) {
        await this.writeJsonAtomic(filePath, {
          version: STORAGE_VERSION,
          users: normalized.users
        });
      }

      return normalized.users;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unsupported storage version")) {
        throw error;
      }

      return fallback.users;
    }
  }

  private async backupAndRewriteVersionedFile<T>(filePath: string, payload: VersionedFile<T>): Promise<void> {
    const backupPath = `${filePath}.bk`;

    try {
      await unlink(backupPath);
    } catch {
      // Ignore missing backup.
    }

    await rename(filePath, backupPath);

    try {
      await this.writeJsonAtomic(filePath, payload);
    } catch (error) {
      await copyFile(backupPath, filePath);
      throw error;
    }
  }

  private async writeJsonAtomic<T>(filePath: string, data: T): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    await writeFile(tempPath, payload, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(tempPath, filePath);
    try {
      await unlink(tempPath);
    } catch {
      // Ignore; temp file may not exist after rename.
    }
  }

  private async lockDownPermissions(): Promise<void> {
    await this.ensurePathMode(this.dataDir, 0o700);
    await this.ensurePathMode(this.usersPath, 0o600);
    await this.ensurePathMode(this.serversPath, 0o600);
    await this.ensurePathMode(this.consolePath, 0o600);
  }

  private async ensurePathMode(filePath: string, mode: number): Promise<void> {
    try {
      await chmod(filePath, mode);
    } catch {
      // Best-effort only; ignore filesystems that do not support chmod semantics.
    }
  }

  private async enqueueWrite(task: () => Promise<void>): Promise<void> {
    const pending = this.writeQueue.then(task, task);
    this.writeQueue = pending.then(
      () => undefined,
      () => undefined
    );
    return pending;
  }
}
