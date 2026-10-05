import { AppHeader } from "../../components/AppHeader.js";
import { ChangePasswordScreen } from "../../components/ChangePasswordScreen.js";
import { ConsolePanel } from "../../components/ConsolePanel.js";
import { LoginScreen } from "../../components/LoginScreen.js";
import { ServersPanel } from "../../components/ServersPanel.js";
import { TabBar } from "../../components/TabBar.js";
import { UsersPanel } from "../../components/UsersPanel.js";
import type { AppViewModel } from "../model/viewModel.js";

export function AppView(model: AppViewModel) {
  if (!model.token) {
    return (
      <LoginScreen
        onLogin={model.actions.login}
        busy={model.busyLogin}
        error={model.authError}
      />
    );
  }

  if (model.user?.mustChangePassword) {
    return (
      <ChangePasswordScreen
        username={model.user.username}
        onChangePassword={model.actions.changeOwnPassword}
        onLogout={model.actions.logout}
      />
    );
  }

  return (
    <div className="app-shell">
      <AppHeader
        user={model.user}
        showCleanupArtifacts={model.hasCleanupArtifacts}
        cleanupBusy={model.busyCleanupArtifacts}
        onCleanupArtifacts={() => void model.actions.cleanupArtifacts()}
        onLogout={model.actions.logout}
      />
      <TabBar activeTab={model.activeTab} showUsers={model.isAdmin} onChange={model.actions.setActiveTab} />

      <section className="workspace">
        {model.globalError ? <div className="error-box">{model.globalError}</div> : null}

        {model.activeTab === "console" ? (
          <ConsolePanel
            servers={model.servers}
            selectedServerId={model.selectedServerId}
            selectedServer={model.selectedServer}
            isRefreshing={model.busyRefresh}
            rconConnected={model.rconConnected}
            socketError={model.socketError}
            consoleEntries={model.consoleEntries}
            commandInput={model.commandInput}
            canRunSocketCommand={model.canRunSocketCommand}
            consoleBottomRef={model.consoleBottomRef}
            onSelectedServerChange={model.actions.setSelectedServerId}
            onRefreshServers={() => void model.actions.refreshServers()}
            onCommandInputChange={model.actions.setCommandInput}
            onSendCommand={model.actions.sendCommand}
          />
        ) : null}

        {model.activeTab === "servers" ? (
          <ServersPanel
            servers={model.servers}
            isAdmin={model.isAdmin}
            serverForm={model.serverForm}
            isEditorOpen={model.serverEditorOpen}
            onRefresh={() => void model.actions.refreshServers()}
            onOpenCreateEditor={model.actions.beginCreateServer}
            onEditServer={model.actions.beginEditServer}
            onDeleteServer={(serverId) => void model.actions.deleteServer(serverId)}
            onSubmitServerForm={model.actions.submitServerForm}
            onServerFormChange={(patch) => model.actions.setServerForm((previous) => ({ ...previous, ...patch }))}
            onCancelEdit={model.actions.cancelServerEdit}
          />
        ) : null}

        {model.activeTab === "users" && model.isAdmin ? (
          <UsersPanel
            users={model.users}
            servers={model.servers}
            currentUserId={model.user?.id || ""}
            userForm={model.userForm}
            lastTemporaryPassword={model.lastTemporaryPassword}
            onDismissTemporaryPassword={model.actions.dismissTemporaryPassword}
            passwordDrafts={model.passwordDrafts}
            onRefresh={() => void model.actions.refreshUsers()}
            onCreateUser={model.actions.createUser}
            onUserFormChange={(patch) => model.actions.setUserForm((previous) => ({ ...previous, ...patch }))}
            onUpdateUserRole={(userId, role) => void model.actions.updateUserRole(userId, role)}
            onUpdateUserServerPermission={(userItem, serverId, hasAccess) =>
              void model.actions.updateUserServerPermission(userItem, serverId, hasAccess)
            }
            onPasswordDraftChange={(userId, value) =>
              model.actions.setPasswordDrafts((previous) => ({
                ...previous,
                [userId]: value
              }))
            }
            onUpdateUserPassword={(userId) => void model.actions.updateUserPassword(userId)}
            onDeleteUser={(userId) => void model.actions.deleteUser(userId)}
          />
        ) : null}
      </section>
    </div>
  );
}
