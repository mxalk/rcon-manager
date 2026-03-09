import { useMemo } from "react";

import type { AppViewModel } from "../model/viewModel.js";
import { useAuthSession } from "./useAuthSession.js";
import { useConsoleState } from "./useConsoleState.js";
import { useDataLoader } from "./useDataLoader.js";
import { useNavigationState } from "./useNavigationState.js";
import { useServerActions } from "./useServerActions.js";
import { useUserActions } from "./useUserActions.js";

export function useAppController(): AppViewModel {
  const auth = useAuthSession();
  const navigation = useNavigationState(auth.user);
  const consoleState = useConsoleState({
    token: auth.token,
    selectedServerId: navigation.selectedServerId
  });

  const data = useDataLoader({
    token: auth.token,
    setToken: auth.setToken,
    setUser: auth.setUser,
    selectedServerId: navigation.selectedServerId,
    setSelectedServerId: navigation.setSelectedServerId,
    setConsoleEntries: consoleState.setConsoleEntries
  });

  const serverActions = useServerActions({
    token: auth.token,
    refreshServers: data.refreshServers,
    refreshUsers: data.refreshUsers,
    setGlobalError: data.setGlobalError,
    setActiveTab: navigation.setActiveTab
  });

  const userActions = useUserActions({
    token: auth.token,
    refreshUsers: data.refreshUsers,
    setGlobalError: data.setGlobalError
  });

  const isAdmin = auth.user?.role === "admin";
  const selectedServer = useMemo(
    () => data.servers.find((item) => item.id === navigation.selectedServerId) || null,
    [data.servers, navigation.selectedServerId]
  );

  return {
    token: auth.token,
    user: auth.user,
    servers: data.servers,
    users: data.users,
    activeTab: navigation.activeTab,
    selectedServerId: navigation.selectedServerId,
    selectedServer,
    consoleEntries: consoleState.consoleEntries,
    commandInput: consoleState.commandInput,
    rconConnected: consoleState.rconConnected,
    socketError: consoleState.socketError,
    canRunSocketCommand: consoleState.canRunSocketCommand,
    authError: auth.authError,
    busyLogin: auth.busyLogin,
    busyRefresh: data.busyRefresh,
    busyCleanupArtifacts: data.busyCleanupArtifacts,
    hasCleanupArtifacts: data.hasCleanupArtifacts,
    globalError: data.globalError,
    serverForm: serverActions.serverForm,
    serverEditorOpen: serverActions.serverEditorOpen,
    userForm: userActions.userForm,
    passwordDrafts: userActions.passwordDrafts,
    isAdmin,
    consoleBottomRef: consoleState.consoleBottomRef,
    actions: {
      login: auth.login,
      logout: auth.logout,
      cleanupArtifacts: async () => {
        if (!isAdmin) {
          return;
        }
        await data.cleanupArtifacts();
      },
      setActiveTab: navigation.setActiveTab,
      setSelectedServerId: navigation.setSelectedServerId,
      refreshServers: data.refreshServers,
      setCommandInput: consoleState.setCommandInput,
      sendCommand: consoleState.sendCommand,
      beginCreateServer: serverActions.beginCreateServer,
      beginEditServer: serverActions.beginEditServer,
      deleteServer: serverActions.deleteServer,
      submitServerForm: serverActions.submitServerForm,
      setServerForm: serverActions.setServerForm,
      cancelServerEdit: serverActions.cancelServerEdit,
      refreshUsers: async () => {
        if (!isAdmin) {
          return;
        }
        await data.refreshUsers();
      },
      createUser: userActions.createUser,
      setUserForm: userActions.setUserForm,
      updateUserRole: userActions.updateUserRole,
      updateUserServerPermission: userActions.updateUserServerPermission,
      setPasswordDrafts: userActions.setPasswordDrafts,
      updateUserPassword: userActions.updateUserPassword,
      deleteUser: userActions.deleteUser
    }
  };
}
