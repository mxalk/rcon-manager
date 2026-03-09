export function TabBar({
  activeTab,
  showUsers,
  onChange
}: {
  activeTab: "console" | "servers" | "users";
  showUsers: boolean;
  onChange: (tab: "console" | "servers" | "users") => void;
}) {
  return (
    <div className="tab-row">
      <button className={activeTab === "console" ? "active" : ""} onClick={() => onChange("console")}>
        Console
      </button>
      <button className={activeTab === "servers" ? "active" : ""} onClick={() => onChange("servers")}>
        Servers
      </button>
      {showUsers ? (
        <button className={activeTab === "users" ? "active" : ""} onClick={() => onChange("users")}>
          Users
        </button>
      ) : null}
    </div>
  );
}
