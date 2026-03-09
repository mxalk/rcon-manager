import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Application, Request, Response } from "express";
import express from "express";

export function registerStaticClient(app: Application): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, "..", "..", "..", "client", "dist");

  if (!existsSync(clientDistPath)) {
    return;
  }

  app.use(express.static(clientDistPath));
  app.get("*", (req: Request, res: Response, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}
