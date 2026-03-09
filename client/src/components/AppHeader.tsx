import type { PublicUser } from "../lib/types.js";

export function AppHeader({
  user,
  showCleanupArtifacts,
  cleanupBusy,
  onCleanupArtifacts,
  onLogout
}: {
  user: PublicUser | null;
  showCleanupArtifacts: boolean;
  cleanupBusy: boolean;
  onCleanupArtifacts: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="app-header">
      <div>
        <h1>RCON Manager</h1>
        <p>
          Logged in as <strong>{user?.username}</strong>
          {user?.role === "admin" ? " (admin)" : ""}
        </p>
      </div>
      <div className="header-actions">
        {user?.role === "admin" && showCleanupArtifacts ? (
          <button onClick={onCleanupArtifacts} disabled={cleanupBusy}>
            {cleanupBusy ? "Cleaning..." : "Clean Data Artifacts"}
          </button>
        ) : null}
        <button onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
