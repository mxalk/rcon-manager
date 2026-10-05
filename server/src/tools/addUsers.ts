// Adds users from the command line, each with a temporary password they must change at their first login.
//
//   docker exec rcon-manager node server/dist/tools/addUsers.js [--admin] [--server <name|id>]... <username>...
//   docker exec rcon-manager node server/dist/tools/addUsers.js --reset <username>...
//
// --server (repeatable) gives the new users access to that server (by name or id); --admin makes them admins.
// --reset gives existing users a new temporary password instead. Prints "username  password" per user.
import { randomUUID } from "node:crypto";

import { hashPassword } from "../auth.js";
import { generateTemporaryPassword } from "../app/temporaryPassword.js";
import { validateUsername } from "../app/validation.js";
import { createDatabase } from "../storage/index.js";
import type { ServerPermission, StoredUser } from "../types.js";

function usage(message?: string): never {
  if (message) {
    console.error(message);
  }
  console.error("usage: addUsers.js [--admin] [--server <name|id>]... <username>...");
  console.error("       addUsers.js --reset <username>...");
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let admin = false;
  let reset = false;
  const serverRefs: string[] = [];
  const usernames: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--admin") admin = true;
    else if (arg === "--reset") reset = true;
    else if (arg === "--server") serverRefs.push(args[++index] ?? usage("--server needs a server name or id"));
    else if (arg.startsWith("-")) usage(`unknown option ${arg}`);
    else usernames.push(arg);
  }
  if (usernames.length === 0) usage();

  const db = createDatabase();
  await db.init();
  const users = await db.readUsers();
  const servers = await db.readServers();
  const permissions: ServerPermission[] = [];
  for (const ref of serverRefs) {
    const server = servers.find((item) => item.id === ref || item.name.toLowerCase() === ref.toLowerCase());
    if (!server) usage(`no server called "${ref}" (servers: ${servers.map((item) => item.name).join(", ") || "none"})`);
    permissions.push({ serverId: server.id });
  }

  const now = new Date().toISOString();
  const lines: string[] = [];
  let failed = false;
  for (const username of usernames) {
    const existing = users.find((item) => item.username === username);
    const password = generateTemporaryPassword();
    if (reset) {
      if (!existing) {
        console.error(`${username}: no such user`);
        failed = true;
        continue;
      }
      existing.passwordHash = await hashPassword(password);
      existing.mustChangePassword = true;
      existing.updatedAt = now;
    } else {
      if (existing) {
        console.error(`${username}: already exists (use --reset for a new temporary password)`);
        failed = true;
        continue;
      }
      if (!validateUsername(username)) {
        console.error(`${username}: usernames are 3-32 chars [a-zA-Z0-9_.-]`);
        failed = true;
        continue;
      }
      const user: StoredUser = {
        id: randomUUID(),
        username,
        passwordHash: await hashPassword(password),
        role: admin ? "admin" : "user",
        serverPermissions: admin ? [] : permissions,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now
      };
      users.push(user);
    }
    lines.push(`${username}  ${password}`);
  }
  await db.writeUsers(users);
  if (lines.length > 0) {
    console.log("Temporary passwords (each user sets their own at first login):");
    for (const line of lines) console.log(`  ${line}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
