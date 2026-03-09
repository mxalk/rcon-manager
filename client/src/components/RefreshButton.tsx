export function RefreshButton({
  onClick,
  busy = false
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button type="button" className="refresh-button" onClick={onClick} disabled={busy}>
      <span>Refresh</span>
    </button>
  );
}
