import type { LegacyStoredUser, StoredServer } from "../../types.js";

export const STORAGE_VERSION = 1;
export const DEFAULT_CONSOLE_MAX_LINES = 100;

export interface VersionedFile<T> {
  version: number;
  data: T;
}

export interface VersionedUsersFile {
  version: number;
  users: LegacyStoredUser[];
}

export interface VersionedServersFile {
  version: number;
  servers: StoredServer[];
}

export const DEFAULT_USERS: VersionedUsersFile = {
  version: STORAGE_VERSION,
  users: []
};

export const DEFAULT_SERVERS: VersionedServersFile = {
  version: STORAGE_VERSION,
  servers: []
};
