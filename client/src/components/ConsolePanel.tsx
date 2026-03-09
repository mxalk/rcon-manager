import type { FormEvent, MutableRefObject } from "react";

import { formatTimestamp } from "../lib/format.js";
import type { ConsoleEntry, ServerRecord } from "../lib/types.js";
import { RefreshButton } from "./RefreshButton.js";

export function ConsolePanel({
  servers,
  selectedServerId,
  selectedServer,
  isRefreshing,
  rconConnected,
  socketError,
  consoleEntries,
  commandInput,
  canRunSocketCommand,
  consoleBottomRef,
  onSelectedServerChange,
  onRefreshServers,
  onCommandInputChange,
  onSendCommand
}: {
  servers: ServerRecord[];
  selectedServerId: string;
  selectedServer: ServerRecord | null;
  isRefreshing: boolean;
  rconConnected: boolean;
  socketError: string;
  consoleEntries: ConsoleEntry[];
  commandInput: string;
  canRunSocketCommand: boolean;
  consoleBottomRef: MutableRefObject<HTMLDivElement | null>;
  onSelectedServerChange: (serverId: string) => void;
  onRefreshServers: () => void;
  onCommandInputChange: (value: string) => void;
  onSendCommand: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const maxEndpointLength = servers.reduce((max, serverItem) => {
    const endpoint = `${serverItem.host}:${serverItem.port}`;
    return Math.max(max, endpoint.length);
  }, 0);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="console-title">
          <span className={`console-light ${rconConnected ? "online" : "offline"}`} aria-hidden="true" />
          <span>Live Console</span>
        </h2>
        <RefreshButton onClick={onRefreshServers} busy={isRefreshing} />
      </div>

      <div className="inline-controls">
        <select
          className="server-select"
          value={selectedServerId}
          onChange={(event) => onSelectedServerChange(event.target.value)}
        >
          {servers.map((serverItem) => {
            const endpoint = `${serverItem.host}:${serverItem.port}`;
            return (
              <option key={serverItem.id} value={serverItem.id}>
                {`${endpoint.padEnd(maxEndpointLength, " ")}  |  ${serverItem.name}`}
              </option>
            );
          })}
        </select>
      </div>

      {!selectedServer ? (
        <div className="banner">No server configured yet or you have no access assigned.</div>
      ) : (
        <>
          {socketError ? <div className="error-box">{socketError}</div> : null}

          <div className="console-log">
            {consoleEntries.length === 0 ? (
              <div className="line-muted">No entries yet.</div>
            ) : (
              consoleEntries.map((entry) => (
                <div key={entry.id} className={`console-entry ${entry.status}`}>
                  <div className="entry-meta">
                    [{formatTimestamp(entry.timestamp)}] {entry.username}
                  </div>
                  <div className="entry-command">$ {entry.command}</div>
                  <pre className="entry-response">
                    {entry.status === "error" ? entry.error : entry.response || "(empty response)"}
                  </pre>
                </div>
              ))
            )}
            <div ref={consoleBottomRef} />
          </div>

          <form className="command-row" onSubmit={onSendCommand}>
            <input
              placeholder={canRunSocketCommand ? "Enter RCON command..." : "You do not have access to run commands"}
              value={commandInput}
              onChange={(event) => onCommandInputChange(event.target.value)}
              disabled={!canRunSocketCommand}
            />
            <button type="submit" disabled={!canRunSocketCommand || !rconConnected}>
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
