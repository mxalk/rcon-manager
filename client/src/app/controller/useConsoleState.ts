import { useEffect, useRef, useState, type FormEvent } from "react";

import { parseConsoleMessage } from "../../lib/format.js";
import type { ConsoleEntry } from "../../lib/types.js";

export function useConsoleState({
  token,
  selectedServerId
}: {
  token: string;
  selectedServerId: string;
}) {
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [rconConnected, setRconConnected] = useState(false);
  const [socketError, setSocketError] = useState("");
  const [canRunSocketCommand, setCanRunSocketCommand] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const consoleBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!token || !selectedServerId) {
      return;
    }

    const wsUrl = new URL("/ws", window.location.href);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.searchParams.set("serverId", selectedServerId);
    const ws = new WebSocket(wsUrl.toString(), ["rcon-manager.v1", `auth.${token}`]);

    socketRef.current = ws;

    ws.onopen = () => {
      setRconConnected(false);
      setSocketError("");
      setConsoleEntries([]);
    };

    ws.onclose = () => {
      setRconConnected(false);
    };

    ws.onerror = () => {
      setSocketError("Console websocket error");
    };

    ws.onmessage = (event) => {
      const payload = parseConsoleMessage(event.data);
      if (!payload) {
        return;
      }

      if (payload.type === "ready") {
        setCanRunSocketCommand(payload.canRunCommands);
        return;
      }

      if (payload.type === "status") {
        setRconConnected(payload.rconConnected);
        return;
      }

      if (payload.type === "history") {
        setConsoleEntries(payload.entries || []);
        return;
      }

      if (payload.type === "entry") {
        setConsoleEntries((previous) => [...previous, payload.entry]);
        return;
      }

      if (payload.type === "error") {
        setSocketError(payload.message || "Unknown websocket error");
      }
    };

    return () => {
      ws.close();
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
    };
  }, [token, selectedServerId]);

  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [consoleEntries]);

  function sendCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const command = commandInput.trim();
    if (!command) {
      return;
    }

    if (!rconConnected || !socketRef.current) {
      setSocketError("RCON is not connected");
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "command",
        command
      })
    );

    setCommandInput("");
  }

  return {
    consoleEntries,
    setConsoleEntries,
    commandInput,
    setCommandInput,
    rconConnected,
    socketError,
    setSocketError,
    canRunSocketCommand,
    consoleBottomRef,
    sendCommand
  };
}
