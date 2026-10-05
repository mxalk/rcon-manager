import { useState, type FormEvent } from "react";

/** Shown after logging in with a temporary password: nothing else is available until a new one is set. */
export function ChangePasswordScreen({
  username,
  onChangePassword,
  onLogout
}: {
  username: string;
  onChangePassword: (password: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("The password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await onChangePassword(password);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not change the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="glow" />
      <form className="login-card" onSubmit={submit}>
        <h1>Choose your password</h1>
        <p>
          Hi {username}, you signed in with a temporary password. Pick your own to continue.
        </p>
        <label>
          New password
          <input
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Repeat it
          <input
            autoComplete="new-password"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>
        <p className="line-muted password-note">(your password is sent and stored encrypted)</p>
        {error ? <div className="error-box">{error}</div> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Set password"}
        </button>
        <button type="button" className="link-button" onClick={onLogout}>
          Log out
        </button>
      </form>
    </div>
  );
}
