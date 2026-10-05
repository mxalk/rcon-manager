import { randomUUID } from "node:crypto";

import { Router, type Request, type RequestHandler, type Response } from "express";

import { hashPassword, requireRoles, sanitizeUser } from "../auth.js";
import { clearBootstrapPasswordStateForUser } from "../app/bootstrapPasswordState.js";
import { accountRoles } from "../config.js";
import { countAdmins, validateServerPermissions } from "../app/permissions.js";
import { generateTemporaryPassword } from "../app/temporaryPassword.js";
import { validatePassword, validateUsername } from "../app/validation.js";
import type { AppDatabase } from "../storage/database.js";
import type {
  AccountRole,
  CreateUserPayload,
  StoredUser,
  UpdatePasswordPayload,
  UpdateUserPayload
} from "../types.js";

interface UserRoutesDeps {
  db: AppDatabase;
  requireAuth: RequestHandler;
  hardAdminUsername: string;
}

export function registerUserRoutes(appRouter: Router, deps: UserRoutesDeps): void {
  const { db, requireAuth, hardAdminUsername } = deps;

  appRouter.get("/users", requireAuth, requireRoles("admin"), async (_req: Request, res: Response) => {
    const users = await db.readUsers();
    res.json({ users: users.map((user) => sanitizeUser(user, hardAdminUsername)) });
  });

  appRouter.post("/users", requireAuth, requireRoles("admin"), async (req: Request<{}, {}, CreateUserPayload>, res: Response) => {
    const username = String(req.body?.username || "").trim();
    // no password given: generate a temporary one (returned once below); either way the user must change it
    const typedPassword = String(req.body?.password || "");
    const generated = typedPassword ? "" : generateTemporaryPassword();
    const password = typedPassword || generated;
    const role = String(req.body?.role || "user") as AccountRole;

    if (username === hardAdminUsername && role !== "admin") {
      res.status(400).json({ error: `The "${hardAdminUsername}" user must have role admin` });
      return;
    }

    if (!validateUsername(username)) {
      res.status(400).json({ error: "username must be 3-32 chars [a-zA-Z0-9_.-]" });
      return;
    }

    if (!validatePassword(password)) {
      res.status(400).json({ error: "password must be at least 8 characters" });
      return;
    }

    if (!accountRoles.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${accountRoles.join(", ")}` });
      return;
    }

    const servers = await db.readServers();
    const { errors: permissionErrors, permissions } = validateServerPermissions(req.body?.serverPermissions, servers);
    if (permissionErrors.length > 0) {
      res.status(400).json({ error: permissionErrors.join(", ") });
      return;
    }

    const users = await db.readUsers();
    if (users.some((item) => item.username === username)) {
      res.status(409).json({ error: "username already exists" });
      return;
    }

    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      username,
      passwordHash: await hashPassword(password),
      role,
      serverPermissions: role === "admin" ? [] : permissions,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now
    };

    users.push(user);
    await db.writeUsers(users);
    res.status(201).json({
      user: sanitizeUser(user, hardAdminUsername),
      ...(generated ? { temporaryPassword: generated } : {})
    });
  });

  appRouter.put(
    "/users/:id",
    requireAuth,
    requireRoles("admin"),
    async (req: Request<{ id: string }, {}, UpdateUserPayload>, res: Response) => {
      const username = req.body?.username;
      const role = req.body?.role;
      const serverPermissions = req.body?.serverPermissions;

      const users = await db.readUsers();
      const index = users.findIndex((item) => item.id === req.params.id);

      if (index === -1) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (username !== undefined) {
        if (!validateUsername(username)) {
          res.status(400).json({ error: "username must be 3-32 chars [a-zA-Z0-9_.-]" });
          return;
        }
        if (users.some((item) => item.username === username && item.id !== req.params.id)) {
          res.status(409).json({ error: "username already exists" });
          return;
        }
      }

      if (role !== undefined && !accountRoles.includes(role)) {
        res.status(400).json({ error: `role must be one of: ${accountRoles.join(", ")}` });
        return;
      }

      const servers = await db.readServers();
      const {
        errors: permissionErrors,
        permissions
      } = validateServerPermissions(serverPermissions, servers);
      if (permissionErrors.length > 0) {
        res.status(400).json({ error: permissionErrors.join(", ") });
        return;
      }

      const currentUser = users[index]!;
      if (currentUser.username === hardAdminUsername) {
        if (username !== undefined && String(username).trim() !== hardAdminUsername) {
          res.status(400).json({ error: `The "${hardAdminUsername}" username is reserved` });
          return;
        }
        if (role !== undefined && role !== "admin") {
          res.status(400).json({ error: `The "${hardAdminUsername}" user cannot be demoted` });
          return;
        }
      }

      const nextRole = role !== undefined ? role : currentUser.role;
      if (req.user?.id === req.params.id && currentUser.role === "admin" && nextRole !== "admin") {
        res.status(400).json({ error: "You cannot change your own admin role" });
        return;
      }
      if (currentUser.role === "admin" && nextRole !== "admin" && countAdmins(users) <= 1) {
        res.status(400).json({ error: "Cannot demote the last admin user" });
        return;
      }

      users[index] = {
        ...currentUser,
        ...(username !== undefined ? { username: String(username).trim() } : {}),
        ...(role !== undefined ? { role: nextRole } : {}),
        ...(serverPermissions !== undefined
          ? {
              serverPermissions: nextRole === "admin" ? [] : permissions
            }
          : {}),
        updatedAt: new Date().toISOString()
      };

      await db.writeUsers(users);
      res.json({ user: sanitizeUser(users[index]!, hardAdminUsername) });
    }
  );

  appRouter.put(
    "/users/:id/password",
    requireAuth,
    async (req: Request<{ id: string }, {}, UpdatePasswordPayload>, res: Response) => {
      const password = String(req.body?.password || "");
      if (!validatePassword(password)) {
        res.status(400).json({ error: "password must be at least 8 characters" });
        return;
      }

      if (req.user?.role !== "admin" && req.user?.id !== req.params.id) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const users = await db.readUsers();
      const index = users.findIndex((item) => item.id === req.params.id);

      if (index === -1) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const targetUser = users[index]!;
      if (targetUser.username === hardAdminUsername && req.user?.id !== targetUser.id) {
        res.status(403).json({ error: `Only "${hardAdminUsername}" can change this password` });
        return;
      }

      users[index] = {
        ...targetUser,
        passwordHash: await hashPassword(password),
        // own password: a real one now; set by an admin for someone else: temporary, to be changed at login
        mustChangePassword: req.user?.id !== targetUser.id,
        updatedAt: new Date().toISOString()
      };

      await db.writeUsers(users);
      if (targetUser.username === hardAdminUsername) {
        clearBootstrapPasswordStateForUser(targetUser.id);
      }
      res.status(204).send();
    }
  );

  appRouter.delete("/users/:id", requireAuth, requireRoles("admin"), async (req: Request<{ id: string }>, res: Response) => {
    if (req.user?.id === req.params.id) {
      res.status(400).json({ error: "You cannot delete your own user" });
      return;
    }

    const users = await db.readUsers();
    const targetUser = users.find((item) => item.id === req.params.id);
    const next = users.filter((item) => item.id !== req.params.id);

    if (next.length === users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser?.role === "admin" && countAdmins(users) <= 1) {
      res.status(400).json({ error: "Cannot delete the last admin user" });
      return;
    }
    if (targetUser?.username === hardAdminUsername) {
      res.status(400).json({ error: `The "${hardAdminUsername}" user cannot be deleted` });
      return;
    }

    await db.writeUsers(next);
    res.status(204).send();
  });
}
