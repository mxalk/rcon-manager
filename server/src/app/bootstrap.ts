import { randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "../auth.js";
import { setBootstrapPasswordState } from "./bootstrapPasswordState.js";
import type { AppDatabase } from "../storage/database.js";
import type { StoredUser } from "../types.js";

const BOOTSTRAP_TOKEN_BYTES = 36;

function generateBootstrapAdminToken(): string {
  return randomBytes(BOOTSTRAP_TOKEN_BYTES).toString("base64url");
}

export async function ensureDefaultAdminUser({
  db,
  hardAdminUsername,
  defaultAdminPassword
}: {
  db: AppDatabase;
  hardAdminUsername: string;
  defaultAdminPassword: string;
}): Promise<void> {
  const users = await db.readUsers();
  const now = new Date().toISOString();
  const hardAdminIndexes = users
    .map((user, index) => ({ user, index }))
    .filter(({ user }) => user.username === hardAdminUsername)
    .map(({ index }) => index);

  if (hardAdminIndexes.length === 0) {
    const configuredAdminPassword = defaultAdminPassword.trim();
    const bootstrapToken = configuredAdminPassword ? "" : generateBootstrapAdminToken();
    const initialPassword = configuredAdminPassword || bootstrapToken;
    const adminUser: StoredUser = {
      id: randomUUID(),
      username: hardAdminUsername,
      passwordHash: await hashPassword(initialPassword),
      role: "admin",
      serverPermissions: [],
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now
    };

    await db.writeUsers([...users, adminUser]);

    if (configuredAdminPassword) {
      console.log(`[auth] Bootstrapped admin user "${hardAdminUsername}" from DEFAULT_ADMIN_PASSWORD.`);
      return;
    }

    setBootstrapPasswordState(adminUser.id, bootstrapToken);

    console.log(`[auth] Bootstrapped admin user "${hardAdminUsername}" with startup token password.`);
    console.log(`[auth] Startup admin login token (memory-only): ${bootstrapToken}`);
    return;
  }

  let changed = false;
  for (const index of hardAdminIndexes) {
    const hardAdmin = users[index]!;
    if (hardAdmin.role !== "admin") {
      users[index] = {
        ...hardAdmin,
        role: "admin",
        updatedAt: now
      };
      changed = true;
    }
  }

  if (changed) {
    await db.writeUsers(users);
  }
}
