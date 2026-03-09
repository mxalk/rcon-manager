import type { ServerFormState, UserFormState } from "./formTypes.js";

export type AppTab = "console" | "servers" | "users";

export const EMPTY_SERVER_FORM: ServerFormState = {
  id: "",
  name: "",
  host: "",
  port: "25575",
  password: ""
};

export const EMPTY_USER_FORM: UserFormState = {
  username: "",
  password: "",
  role: "user"
};

export function getViewFromUrl(): AppTab {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "servers" || view === "users") {
    return view;
  }
  return "console";
}

export function getSelectedServerFromUrl(): string {
  return new URLSearchParams(window.location.search).get("server") || "";
}

export function setViewInUrl(view: AppTab): void {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.replaceState({}, "", url.toString());
}

export function setSelectedServerInUrl(serverId: string, activeTab: AppTab): void {
  const url = new URL(window.location.href);
  if (activeTab === "console" && serverId) {
    url.searchParams.set("server", serverId);
  } else {
    url.searchParams.delete("server");
  }
  window.history.replaceState({}, "", url.toString());
}
