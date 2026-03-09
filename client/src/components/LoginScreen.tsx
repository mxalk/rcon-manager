import { useState, type FormEvent } from "react";

export function LoginScreen({
  onLogin,
  busy,
  error
}: {
  onLogin: (credentials: { username: string; password: string }) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin({ username, password });
  }

  return (
    <div className="login-shell">
      <div className="glow" />
      <form className="login-card" onSubmit={submit}>
        <h1>RCON Manager</h1>
        <p>Sign in to manage servers and run commands.</p>
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <div className="error-box">{error}</div> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
