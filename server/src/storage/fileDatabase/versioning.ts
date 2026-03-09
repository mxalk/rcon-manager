import type { LegacyStoredUser, StoredServer } from "../../types.js";
import type {
  VersionedFile,
  VersionedServersFile,
  VersionedUsersFile
} from "./constants.js";

export function parseVersionedFile<T>(parsed: unknown): VersionedFile<T> {
  if (parsed && typeof parsed === "object" && "version" in parsed && "data" in parsed) {
    const candidate = parsed as { version?: unknown; data?: unknown };
    if (typeof candidate.version === "number") {
      return {
        version: candidate.version,
        data: candidate.data as T
      };
    }
  }

  return {
    version: 1,
    data: parsed as T
  };
}

export function parseVersionedServersFile(
  parsed: unknown,
  fallback: VersionedServersFile
): { version: number; servers: StoredServer[]; isCanonical: boolean } {
  if (!parsed || typeof parsed !== "object") {
    return {
      version: 1,
      servers: fallback.servers,
      isCanonical: false
    };
  }

  const candidate = parsed as {
    version?: unknown;
    servers?: unknown;
    data?: { servers?: unknown };
  };

  if (typeof candidate.version === "number") {
    if (Array.isArray(candidate.servers)) {
      return {
        version: candidate.version,
        servers: candidate.servers as StoredServer[],
        isCanonical: true
      };
    }

    if (candidate.data && typeof candidate.data === "object" && Array.isArray(candidate.data.servers)) {
      return {
        version: candidate.version,
        servers: candidate.data.servers as StoredServer[],
        isCanonical: false
      };
    }
  }

  if (Array.isArray(candidate.servers)) {
    return {
      version: 1,
      servers: candidate.servers as StoredServer[],
      isCanonical: false
    };
  }

  return {
    version: 1,
    servers: fallback.servers,
    isCanonical: false
  };
}

export function parseVersionedUsersFile(
  parsed: unknown,
  fallback: VersionedUsersFile
): { version: number; users: LegacyStoredUser[]; isCanonical: boolean } {
  if (!parsed || typeof parsed !== "object") {
    return {
      version: 1,
      users: fallback.users,
      isCanonical: false
    };
  }

  const candidate = parsed as {
    version?: unknown;
    users?: unknown;
    data?: { users?: unknown };
  };

  if (typeof candidate.version === "number") {
    if (Array.isArray(candidate.users)) {
      return {
        version: candidate.version,
        users: candidate.users as LegacyStoredUser[],
        isCanonical: true
      };
    }

    if (candidate.data && typeof candidate.data === "object" && Array.isArray(candidate.data.users)) {
      return {
        version: candidate.version,
        users: candidate.data.users as LegacyStoredUser[],
        isCanonical: false
      };
    }
  }

  if (Array.isArray(candidate.users)) {
    return {
      version: 1,
      users: candidate.users as LegacyStoredUser[],
      isCanonical: false
    };
  }

  return {
    version: 1,
    users: fallback.users,
    isCanonical: false
  };
}
