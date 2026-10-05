import { useState } from "react";

import { loginQuery, updateUserPasswordQuery } from "../../lib/query/index.js";
import type { PublicUser } from "../../lib/types.js";

export function useAuthSession() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("rcon_token") || "");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [busyLogin, setBusyLogin] = useState(false);

  async function login(credentials: { username: string; password: string }) {
    setBusyLogin(true);
    setAuthError("");

    try {
      const response = await loginQuery(credentials);
      setToken(response.token);
      setUser(response.user);
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setBusyLogin(false);
    }
  }

  /** Sets the user's own password (after a temporary one); the server then lifts the restriction. */
  async function changeOwnPassword(password: string) {
    if (!token || !user) {
      return;
    }
    await updateUserPasswordQuery(token, user.id, password);
    // the session stays (token in localStorage); reload so everything loads with the restriction lifted
    window.location.reload();
  }

  function logout() {
    setToken("");
    setUser(null);
  }

  return {
    token,
    setToken,
    user,
    setUser,
    authError,
    busyLogin,
    login,
    logout,
    changeOwnPassword
  };
}
