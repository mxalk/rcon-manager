import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Application } from "express";
import express from "express";

export function registerStaticClient(app: Application): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, "..", "..", "..", "client", "dist");

  if (!existsSync(clientDistPath)) {
    return;
  }

  // Only files that exist: "/" (index.html) and the built assets. The client keeps its state in the query string
  // (?view=, ?server=), so it needs no catch-all fallback; anything else falls through to the 404 handler.
  // redirect: false keeps directories like /assets from answering with a redirect.
  app.use(express.static(clientDistPath, { redirect: false }));
}
