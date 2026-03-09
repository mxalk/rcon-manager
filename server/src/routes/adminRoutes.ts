import { Router, type Request, type RequestHandler, type Response } from "express";

import { requireRoles } from "../auth.js";
import type { AppDatabase } from "../storage/database.js";

export function registerAdminRoutes(
  appRouter: Router,
  { db, requireAuth }: { db: AppDatabase; requireAuth: RequestHandler }
): void {
  appRouter.post("/admin/cleanup-artifacts", requireAuth, requireRoles("admin"), async (_req: Request, res: Response) => {
    const deleted = await db.deleteBackupArtifacts();
    res.json({ deleted, count: deleted.length });
  });

  appRouter.get("/admin/cleanup-artifacts", requireAuth, requireRoles("admin"), async (_req: Request, res: Response) => {
    const artifacts = await db.listBackupArtifacts();
    res.json({ files: artifacts, count: artifacts.length });
  });
}
