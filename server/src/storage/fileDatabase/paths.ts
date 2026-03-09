import { promises as fsPromises, constants as fsConstants } from "node:fs";
import path from "node:path";

import { DEFAULT_CONSOLE_MAX_LINES } from "./constants.js";

const { access, mkdir } = fsPromises;

export async function resolveDataDir(): Promise<string> {
  const candidates: string[] = [];

  if (process.env.DATA_DIR) {
    candidates.push(process.env.DATA_DIR);
  }

  candidates.push("/data");
  candidates.push(path.resolve(process.cwd(), "..", "data"));
  candidates.push(path.resolve(process.cwd(), "data"));

  for (const candidate of candidates) {
    try {
      await mkdir(candidate, { recursive: true, mode: 0o700 });
      await access(candidate, fsConstants.R_OK | fsConstants.W_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Failed to find a writable data directory. Set DATA_DIR explicitly.");
}

export function resolveConsoleMaxLines(): number {
  const parsed = Number.parseInt(process.env.CONSOLE_MAX_LINES || "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_CONSOLE_MAX_LINES;
  }
  return parsed;
}
