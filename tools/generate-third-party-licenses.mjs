import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LOCK_PATH = path.join(ROOT, "package-lock.json");
const OUTPUT_PATH = path.join(ROOT, "THIRD_PARTY_LICENSES.md");

function packageNameFromLockPath(lockPackagePath) {
  const parts = lockPackagePath.split("node_modules/");
  return parts[parts.length - 1];
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const lock = await readJson(LOCK_PATH);
  const packages = lock.packages || {};
  const entries = new Map();

  for (const [lockPackagePath, meta] of Object.entries(packages)) {
    if (!lockPackagePath.startsWith("node_modules/")) {
      continue;
    }

    const name = packageNameFromLockPath(lockPackagePath);
    if (name === "rcon-manager-client" || name === "rcon-manager-server") {
      continue;
    }

    const version = typeof meta.version === "string" ? meta.version : "UNKNOWN";
    const license = typeof meta.license === "string" ? meta.license : "UNKNOWN";
    const key = `${name}@${version}`;
    const homepage = typeof meta.homepage === "string" ? meta.homepage : "";
    const repository =
      meta.repository && typeof meta.repository === "object" && typeof meta.repository.url === "string"
        ? meta.repository.url
        : "";

    entries.set(key, {
      name,
      version,
      license,
      source: homepage || repository || ""
    });
  }

  const rows = [...entries.values()].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    return byName !== 0 ? byName : a.version.localeCompare(b.version);
  });

  const generatedAt = new Date().toISOString();
  const lines = [
    "# Third-Party Licenses",
    "",
    `Generated from \`package-lock.json\` on ${generatedAt}.`,
    "",
    "This file lists third-party npm packages used by this project and their declared licenses.",
    "",
    "| Package | Version | License | Source |",
    "| --- | --- | --- | --- |"
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.name} | ${row.version} | ${row.license} | ${row.source ? row.source : "-"} |`
    );
  }

  lines.push("");
  await fs.writeFile(OUTPUT_PATH, `${lines.join("\n")}`, "utf8");
  console.log(`Wrote ${rows.length} entries to ${OUTPUT_PATH}`);
}

await main();
