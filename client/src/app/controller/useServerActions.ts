import { useState, type FormEvent } from "react";

import type { ServerFormState } from "../model/formTypes.js";
import {
  createServerQuery,
  deleteServerQuery,
  updateServerQuery
} from "../../lib/query/index.js";
import type { ServerPayload, ServerRecord } from "../../lib/types.js";
import { EMPTY_SERVER_FORM } from "../model/state.js";

export function useServerActions({
  token,
  refreshServers,
  refreshUsers,
  setGlobalError,
  setActiveTab
}: {
  token: string;
  refreshServers: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  setGlobalError: (value: string) => void;
  setActiveTab: (value: "console" | "servers" | "users") => void;
}) {
  const [serverForm, setServerForm] = useState<ServerFormState>(EMPTY_SERVER_FORM);
  const [serverEditorOpen, setServerEditorOpen] = useState(false);

  async function submitServerForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const body: Required<ServerPayload> = {
      name: serverForm.name,
      host: serverForm.host,
      port: Number(serverForm.port),
      password: serverForm.password
    };

    try {
      if (serverForm.id) {
        await updateServerQuery(token, serverForm.id, body);
      } else {
        await createServerQuery(token, body);
      }

      setServerForm(EMPTY_SERVER_FORM);
      setServerEditorOpen(false);
      await refreshServers();
      await refreshUsers();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to save server");
    }
  }

  function beginEditServer(serverItem: ServerRecord) {
    setServerForm({
      id: serverItem.id,
      name: serverItem.name,
      host: serverItem.host,
      port: String(serverItem.port),
      password: ""
    });
    setActiveTab("servers");
    setServerEditorOpen(true);
  }

  function beginCreateServer() {
    setServerForm(EMPTY_SERVER_FORM);
    setActiveTab("servers");
    setServerEditorOpen(true);
  }

  function cancelServerEdit() {
    setServerForm(EMPTY_SERVER_FORM);
    setServerEditorOpen(false);
  }

  async function deleteServer(serverId: string) {
    if (!token) {
      return;
    }

    if (!window.confirm("Delete this server?")) {
      return;
    }

    try {
      await deleteServerQuery(token, serverId);
      await refreshServers();
      await refreshUsers();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to delete server");
    }
  }

  return {
    serverForm,
    setServerForm,
    serverEditorOpen,
    submitServerForm,
    beginEditServer,
    beginCreateServer,
    cancelServerEdit,
    deleteServer
  };
}
