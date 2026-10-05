import { useMemo, useState, type FormEvent } from "react";

import type { AccountRole, PublicUser, ServerRecord } from "../lib/types.js";
import type { UserFormState } from "../app/model/formTypes.js";
import { hasServerPermission } from "../lib/format.js";
import { RefreshButton } from "./RefreshButton.js";

export function UsersPanel({
  users,
  servers,
  currentUserId,
  userForm,
  lastTemporaryPassword,
  onDismissTemporaryPassword,
  passwordDrafts,
  onRefresh,
  onCreateUser,
  onUserFormChange,
  onUpdateUserRole,
  onUpdateUserServerPermission,
  onPasswordDraftChange,
  onUpdateUserPassword,
  onDeleteUser
}: {
  users: PublicUser[];
  servers: ServerRecord[];
  currentUserId: string;
  userForm: UserFormState;
  lastTemporaryPassword: { username: string; password: string } | null;
  onDismissTemporaryPassword: () => void;
  passwordDrafts: Record<string, string>;
  onRefresh: () => void;
  onCreateUser: (event: FormEvent<HTMLFormElement>) => void;
  onUserFormChange: (patch: Partial<UserFormState>) => void;
  onUpdateUserRole: (userId: string, role: AccountRole) => void;
  onUpdateUserServerPermission: (user: PublicUser, serverId: string, hasAccess: boolean) => void;
  onPasswordDraftChange: (userId: string, value: string) => void;
  onUpdateUserPassword: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}) {
  const [accessEditorUserId, setAccessEditorUserId] = useState<string>("");
  const accessEditorUser = useMemo(
    () => users.find((userItem) => userItem.id === accessEditorUserId) || null,
    [users, accessEditorUserId]
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Users</h2>
        <RefreshButton onClick={onRefresh} />
      </div>

      <form className="editor editor-inline" onSubmit={onCreateUser}>
        <label className="inline-field">
          <span>Create User</span>
          <input
            value={userForm.username}
            onChange={(event) => onUserFormChange({ username: event.target.value })}
            placeholder="username"
            required
          />
        </label>
        <label className="inline-field">
          <span>Password</span>
          <input
            type="password"
            value={userForm.password}
            onChange={(event) => onUserFormChange({ password: event.target.value })}
            placeholder="empty = generate one"
          />
        </label>
        <button type="submit">Create User</button>
      </form>

      <p className="line-muted">
        New users and passwords you set for others are temporary: they choose their own at their next login.
      </p>

      {lastTemporaryPassword ? (
        <div className="banner temp-password">
          <span>
            Temporary password for <strong>{lastTemporaryPassword.username}</strong>:{" "}
            <code>{lastTemporaryPassword.password}</code> (shown once; send it to them)
          </span>
          <button type="button" onClick={onDismissTemporaryPassword}>
            Done
          </button>
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Admin</th>
              <th>Access</th>
              <th>Password Reset</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((userItem) => (
              <tr key={userItem.id}>
                <td>
                  {userItem.username}
                  {userItem.mustChangePassword ? <span className="line-muted"> (temporary password)</span> : null}
                </td>
                <td className="account-cell">
                  {userItem.isReservedAdmin ? (
                    <strong>admin</strong>
                  ) : (
                    <label className="user-role-toggle">
                      <input
                        type="checkbox"
                        checked={userItem.role === "admin"}
                        onChange={(event) => {
                          if (event.target.checked && !window.confirm(`Grant admin access to ${userItem.username}?`)) {
                            return;
                          }
                          onUpdateUserRole(userItem.id, event.target.checked ? "admin" : "user");
                        }}
                      />
                    </label>
                  )}
                </td>
                <td>
                  {userItem.role === "admin" ? (
                    <span>full</span>
                  ) : (
                    <button
                      type="button"
                      className="permissions-trigger"
                      onClick={() => setAccessEditorUserId(userItem.id)}
                    >
                      {userItem.serverPermissions.length} / {servers.length} servers
                    </button>
                  )}
                </td>
                <td>
                  <input
                    type="password"
                    value={passwordDrafts[userItem.id] || ""}
                    onChange={(event) => onPasswordDraftChange(userItem.id, event.target.value)}
                    placeholder="new password"
                  />
                </td>
                <td className="actions-cell">
                  <div className="user-actions">
                    <button onClick={() => onUpdateUserPassword(userItem.id)}>Set Password</button>
                    <button
                      className={`danger ${
                        userItem.isReservedAdmin || userItem.id === currentUserId ? "button-placeholder" : ""
                      }`}
                      onClick={() => onDeleteUser(userItem.id)}
                      disabled={userItem.isReservedAdmin || userItem.id === currentUserId}
                      tabIndex={userItem.isReservedAdmin || userItem.id === currentUserId ? -1 : 0}
                      aria-hidden={userItem.isReservedAdmin || userItem.id === currentUserId}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {accessEditorUser ? (
        <div className="permissions-modal-backdrop" onClick={() => setAccessEditorUserId("")}>
          <div className="permissions-modal" onClick={(event) => event.stopPropagation()}>
            <div className="permissions-modal-header">
              <h3>Server Access: {accessEditorUser.username}</h3>
              <button type="button" onClick={() => setAccessEditorUserId("")}>
                Close
              </button>
            </div>
            <div className="permissions-grid">
              {servers.map((serverItem) => (
                <label key={`${accessEditorUser.id}-${serverItem.id}`} className="permission-item">
                  <input
                    type="checkbox"
                    checked={hasServerPermission(accessEditorUser, serverItem.id)}
                    onChange={(event) =>
                      onUpdateUserServerPermission(accessEditorUser, serverItem.id, event.target.checked)
                    }
                  />
                  {" "}
                  <span>{serverItem.name}</span>
                </label>
              ))}
              {servers.length === 0 ? (
                <div className="line-muted">No servers available.</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
