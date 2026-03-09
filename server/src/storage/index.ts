import { FileDatabase } from "./fileDatabase.js";
import type { AppDatabase } from "./database.js";

export function createDatabase(): AppDatabase {
  const provider = (process.env.DB_PROVIDER || "file").trim().toLowerCase();

  if (provider === "file") {
    return new FileDatabase();
  }

  throw new Error(`Unsupported DB_PROVIDER "${provider}". Supported providers: file`);
}
