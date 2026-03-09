import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  cleanupArtifactsQuery,
  cleanupArtifactsStatusQuery,
  currentUserQuery,
  listServersQuery,
  listUsersQuery
} from "../../lib/query/index.js";
import type { ConsoleEntry, PublicUser, ServerRecord } from "../../lib/types.js";

export function useDataLoader({
  token,
  setToken,
  setUser,
  selectedServerId,
  setSelectedServerId,
  setConsoleEntries
}: {
  token: string;
  setToken: (value: string) => void;
  setUser: (user: PublicUser | null) => void;
  selectedServerId: string;
  setSelectedServerId: (id: string) => void;
  setConsoleEntries: Dispatch<SetStateAction<ConsoleEntry[]>>;
}) {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [busyCleanupArtifacts, setBusyCleanupArtifacts] = useState(false);
  const [hasCleanupArtifacts, setHasCleanupArtifacts] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    if (!token) {
      localStorage.removeItem("rcon_token");
      setUser(null);
      setServers([]);
      setUsers([]);
      setSelectedServerId("");
      setConsoleEntries([]);
      setHasCleanupArtifacts(false);
      return;
    }

    localStorage.setItem("rcon_token", token);
  }, [token, setConsoleEntries, setSelectedServerId, setUser]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let canceled = false;

    async function bootstrap() {
      setBusyRefresh(true);
      setGlobalError("");
      try {
        const me = await currentUserQuery(token);
        const serverResponse = await listServersQuery(token);

        if (canceled) {
          return;
        }

        setUser(me.user);
        setServers(serverResponse.servers || []);

        const hasSelectedServer = serverResponse.servers.some((item) => item.id === selectedServerId);
        if (serverResponse.servers.length === 0) {
          setSelectedServerId("");
        } else if (!hasSelectedServer) {
          setSelectedServerId(serverResponse.servers[0]!.id);
        }

        if (me.user.role === "admin") {
          const usersResponse = await listUsersQuery(token);
          const artifactsStatus = await cleanupArtifactsStatusQuery(token);
          if (!canceled) {
            setUsers(usersResponse.users || []);
            setHasCleanupArtifacts((artifactsStatus.count || 0) > 0);
          }
        } else if (!canceled) {
          setHasCleanupArtifacts(false);
        }
      } catch (error: unknown) {
        if (!canceled) {
          setGlobalError(error instanceof Error ? error.message : "Failed to load data");
          setToken("");
        }
      } finally {
        if (!canceled) {
          setBusyRefresh(false);
        }
      }
    }

    void bootstrap();

    return () => {
      canceled = true;
    };
  }, [token, selectedServerId, setSelectedServerId, setToken, setUser]);

  async function refreshServers() {
    if (!token) {
      return;
    }

    try {
      const response = await listServersQuery(token);
      setServers(response.servers || []);
      if (response.servers.length === 0) {
        setSelectedServerId("");
      } else if (!response.servers.some((item) => item.id === selectedServerId)) {
        setSelectedServerId(response.servers[0]!.id);
      }
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to refresh servers");
    }
  }

  async function refreshUsers() {
    if (!token) {
      return;
    }

    try {
      const response = await listUsersQuery(token);
      setUsers(response.users || []);
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to refresh users");
    }
  }

  async function cleanupArtifacts() {
    if (!token) {
      return;
    }

    if (!window.confirm("Delete all .bk and .migrated files from the data directory?")) {
      return;
    }

    setBusyCleanupArtifacts(true);
    setGlobalError("");
    try {
      const response = await cleanupArtifactsQuery(token);
      const message =
        response.count > 0
          ? `Removed ${response.count} file(s): ${response.deleted.join(", ")}`
          : "No .bk or .migrated files found.";
      setHasCleanupArtifacts(false);
      window.alert(message);
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to clean data artifacts");
    } finally {
      setBusyCleanupArtifacts(false);
    }
  }

  return {
    servers,
    setServers,
    users,
    setUsers,
    busyRefresh,
    busyCleanupArtifacts,
    hasCleanupArtifacts,
    globalError,
    setGlobalError,
    refreshServers,
    refreshUsers,
    cleanupArtifacts
  };
}
