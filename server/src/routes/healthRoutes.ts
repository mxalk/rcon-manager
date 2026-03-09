import { Router, type Request, type Response } from "express";

export function registerHealthRoutes(appRouter: Router): void {
  appRouter.get("/health", async (_req: Request, res: Response) => {
    res.json({ ok: true, at: new Date().toISOString() });
  });
}
