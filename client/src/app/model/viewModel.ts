import type { Dispatch, FormEvent, MutableRefObject, SetStateAction } from "react";

import type { ServerFormState, UserFormState } from "./formTypes.js";
import type { AccountRole, ConsoleEntry, PublicUser, ServerRecord } from "../../lib/types.js";
import type { AppTab } from "./state.js";

interface AppViewActions {
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  changeOwnPassword: (password: string) => Promise<void>;
  dismissTemporaryPassword: () => void;
  cleanupArtifacts: () => Promise<void>;
  setActiveTab: (tab: AppTab) => void;
  setSelectedServerId: (serverId: string) => void;
  refreshServers: () => Promise<void>;
  setCommandInput: (value: string) => void;
  sendCommand: (event: FormEvent<HTMLFormElement>) => void;
  beginCreateServer: () => void;
  beginEditServer: (server: ServerRecord) => void;
  deleteServer: (serverId: string) => Promise<void>;
  submitServerForm: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setServerForm: Dispatch<SetStateAction<ServerFormState>>;
  cancelServerEdit: () => void;
  refreshUsers: () => Promise<void>;
  createUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setUserForm: Dispatch<SetStateAction<UserFormState>>;
  updateUserRole: (userId: string, role: AccountRole) => Promise<void>;
  updateUserServerPermission: (user: PublicUser, serverId: string, hasAccess: boolean) => Promise<void>;
  setPasswordDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  updateUserPassword: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

export interface AppViewModel {
  token: string;
  user: PublicUser | null;
  servers: ServerRecord[];
  users: PublicUser[];
  activeTab: AppTab;
  selectedServerId: string;
  selectedServer: ServerRecord | null;
  consoleEntries: ConsoleEntry[];
  commandInput: string;
  rconConnected: boolean;
  socketError: string;
  canRunSocketCommand: boolean;
  authError: string;
  busyLogin: boolean;
  busyRefresh: boolean;
  busyCleanupArtifacts: boolean;
  hasCleanupArtifacts: boolean;
  globalError: string;
  serverForm: ServerFormState;
  serverEditorOpen: boolean;
  userForm: UserFormState;
  lastTemporaryPassword: { username: string; password: string } | null;
  passwordDrafts: Record<string, string>;
  isAdmin: boolean;
  consoleBottomRef: MutableRefObject<HTMLDivElement | null>;
  actions: AppViewActions;
}
