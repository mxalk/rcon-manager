import { useState, type FormEvent } from "react";

import type { UserFormState } from "../model/formTypes.js";
import { buildServerPermissions } from "../../lib/format.js";
import {
  createUserQuery,
  deleteUserQuery,
  updateUserPasswordQuery,
  updateUserRoleQuery,
  updateUserServerPermissionsQuery
} from "../../lib/query/index.js";
import type { AccountRole, PublicUser } from "../../lib/types.js";
import { EMPTY_USER_FORM } from "../model/state.js";

export function useUserActions({
  token,
  refreshUsers,
  setGlobalError
}: {
  token: string;
  refreshUsers: () => Promise<void>;
  setGlobalError: (value: string) => void;
}) {
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  /** The last temporary password set by this admin, shown once (generated, or typed for a new user / a reset). */
  const [lastTemporaryPassword, setLastTemporaryPassword] = useState<{ username: string; password: string } | null>(null);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      const created = await createUserQuery(token, userForm);
      setLastTemporaryPassword({
        username: created.user.username,
        password: created.temporaryPassword || userForm.password
      });
      setUserForm(EMPTY_USER_FORM);
      await refreshUsers();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to create user");
    }
  }

  async function updateUserRole(userId: string, role: AccountRole) {
    if (!token) {
      return;
    }

    try {
      await updateUserRoleQuery(token, userId, role);
      await refreshUsers();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to update user");
    }
  }

  async function updateUserServerPermission(userItem: PublicUser, serverId: string, hasAccess: boolean) {
    if (!token) {
      return;
    }

    try {
      await updateUserServerPermissionsQuery(
        token,
        userItem.id,
        buildServerPermissions(userItem, serverId, hasAccess)
      );
      await refreshUsers();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to update server access");
    }
  }

  async function deleteUser(userId: string) {
    if (!token) {
      return;
    }

    if (!window.confirm("Delete this user?")) {
      return;
    }

    try {
      await deleteUserQuery(token, userId);
      await refreshUsers();
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to delete user");
    }
  }

  async function updateUserPassword(userId: string) {
    const password = passwordDrafts[userId] || "";
    if (!password || !token) {
      return;
    }

    try {
      await updateUserPasswordQuery(token, userId, password);
      setPasswordDrafts((previous) => ({ ...previous, [userId]: "" }));
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : "Failed to update password");
    }
  }

  return {
    userForm,
    setUserForm,
    lastTemporaryPassword,
    dismissTemporaryPassword: () => setLastTemporaryPassword(null),
    passwordDrafts,
    setPasswordDrafts,
    createUser,
    updateUserRole,
    updateUserServerPermission,
    updateUserPassword,
    deleteUser
  };
}
