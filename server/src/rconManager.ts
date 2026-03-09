import { Rcon } from "rcon-client";

import type { StoredServer } from "./types.js";

type ConnectedState = {
  client: Rcon;
  connectingPromise?: undefined;
  lastUsedAt: number;
};

type ConnectingState = {
  client?: undefined;
  connectingPromise: Promise<Rcon>;
  lastUsedAt: number;
};

type ConnectionState = ConnectedState | ConnectingState;

export class RconManager {
  private timeoutMs: number;
  private idleTimeoutMs: number;
  private connections = new Map<string, ConnectionState>();
  private cleanupTimer: NodeJS.Timeout;

  constructor({ timeoutMs = 8000, idleTimeoutMs = 120000 }: { timeoutMs?: number; idleTimeoutMs?: number } = {}) {
    this.timeoutMs = timeoutMs;
    this.idleTimeoutMs = idleTimeoutMs;

    this.cleanupTimer = setInterval(() => {
      void this.cleanupIdleConnections();
    }, Math.max(15000, Math.floor(this.idleTimeoutMs / 2)));

    this.cleanupTimer.unref();
  }

  async execute(serverConfig: StoredServer, command: string): Promise<string> {
    const client = await this.getConnection(serverConfig, false);

    try {
      const output = await client.send(command);
      this.touch(serverConfig.id);
      return output;
    } catch {
      const refreshed = await this.getConnection(serverConfig, true);
      const output = await refreshed.send(command);
      this.touch(serverConfig.id);
      return output;
    }
  }

  async checkConnection(serverConfig: StoredServer): Promise<boolean> {
    try {
      await this.getConnection(serverConfig, false);
      this.touch(serverConfig.id);
      return true;
    } catch {
      await this.disconnect(serverConfig.id);
      return false;
    }
  }

  private async getConnection(serverConfig: StoredServer, forceReconnect: boolean): Promise<Rcon> {
    const existing = this.connections.get(serverConfig.id);

    if (existing && !forceReconnect) {
      if (existing.client) {
        return existing.client;
      }

      if (existing.connectingPromise) {
        return existing.connectingPromise;
      }
    }

    if (existing?.client && forceReconnect) {
      await this.disconnect(serverConfig.id);
    }

    const connectingPromise = Rcon.connect({
      host: serverConfig.host,
      port: serverConfig.port,
      password: serverConfig.password,
      timeout: this.timeoutMs
    })
      .then((client) => {
        client.on("end", () => {
          this.connections.delete(serverConfig.id);
        });

        client.on("error", () => {
          this.connections.delete(serverConfig.id);
        });

        this.connections.set(serverConfig.id, {
          client,
          lastUsedAt: Date.now()
        });

        return client;
      })
      .catch((error: unknown) => {
        this.connections.delete(serverConfig.id);
        throw error;
      });

    this.connections.set(serverConfig.id, {
      connectingPromise,
      lastUsedAt: Date.now()
    });

    return connectingPromise;
  }

  private touch(serverId: string): void {
    const existing = this.connections.get(serverId);
    if (!existing) {
      return;
    }

    this.connections.set(serverId, {
      ...existing,
      lastUsedAt: Date.now()
    });
  }

  async disconnect(serverId: string): Promise<void> {
    const existing = this.connections.get(serverId);
    this.connections.delete(serverId);

    if (!existing?.client) {
      return;
    }

    try {
      await existing.client.end();
    } catch {
      // Ignore close errors.
    }
  }

  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();

    for (const [serverId, connection] of this.connections.entries()) {
      if (!connection.client) {
        continue;
      }

      if (now - connection.lastUsedAt > this.idleTimeoutMs) {
        await this.disconnect(serverId);
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupTimer);
    const ids = [...this.connections.keys()];
    for (const id of ids) {
      await this.disconnect(id);
    }
  }
}
