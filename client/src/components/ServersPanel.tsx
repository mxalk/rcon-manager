import type { FormEvent } from "react";

import type { ServerFormState } from "../app/model/formTypes.js";
import { formatTimestamp } from "../lib/format.js";
import type { ServerRecord } from "../lib/types.js";
import { RefreshButton } from "./RefreshButton.js";

export function ServersPanel({
  servers,
  isAdmin,
  serverForm,
  isEditorOpen,
  onRefresh,
  onOpenCreateEditor,
  onEditServer,
  onDeleteServer,
  onSubmitServerForm,
  onServerFormChange,
  onCancelEdit
}: {
  servers: ServerRecord[];
  isAdmin: boolean;
  serverForm: ServerFormState;
  isEditorOpen: boolean;
  onRefresh: () => void;
  onOpenCreateEditor: () => void;
  onEditServer: (server: ServerRecord) => void;
  onDeleteServer: (serverId: string) => void;
  onSubmitServerForm: (event: FormEvent<HTMLFormElement>) => void;
  onServerFormChange: (patch: Partial<ServerFormState>) => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Servers</h2>
        <div className="actions">
          {isAdmin ? (
            <button type="button" onClick={onOpenCreateEditor}>
              Add Server
            </button>
          ) : null}
          <RefreshButton onClick={onRefresh} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Host</th>
              <th>Port</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((serverItem) => (
              <tr key={serverItem.id}>
                <td>{serverItem.name}</td>
                <td>{serverItem.host}</td>
                <td>{serverItem.port}</td>
                <td>{formatTimestamp(serverItem.updatedAt)}</td>
                <td className="actions-cell">
                  <div className="actions">
                    {isAdmin ? <button onClick={() => onEditServer(serverItem)}>Edit</button> : null}
                    {isAdmin ? (
                      <button className="danger" onClick={() => onDeleteServer(serverItem.id)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdmin && isEditorOpen ? (
        <div className="server-editor-backdrop" onClick={onCancelEdit}>
          <div className="server-editor-modal" onClick={(event) => event.stopPropagation()}>
            <form className="editor" onSubmit={onSubmitServerForm}>
              <div className="server-editor-header">
                <h3>{serverForm.id ? "Edit Server" : "Add Server"}</h3>
              </div>
              <label>
                Name
                <input
                  value={serverForm.name}
                  onChange={(event) => onServerFormChange({ name: event.target.value })}
                  required
                />
              </label>
              <label>
                Host
                <input
                  value={serverForm.host}
                  onChange={(event) => onServerFormChange({ host: event.target.value })}
                  required
                />
              </label>
              <label>
                Port
                <input
                  type="number"
                  value={serverForm.port}
                  onChange={(event) => onServerFormChange({ port: event.target.value })}
                  required
                />
              </label>
              <label>
                RCON Password
                <input
                  type="password"
                  value={serverForm.password}
                  onChange={(event) => onServerFormChange({ password: event.target.value })}
                  required
                />
              </label>
              <div className="actions">
                <button type="submit">{serverForm.id ? "Save" : "Create"}</button>
                <button type="button" onClick={onCancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
