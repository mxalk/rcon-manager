import type { ConsoleEntry } from "../types.js";

const HTML_SPECIALS = /[&<>"']/g;

const HTML_ESCAPE_TABLE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

function sanitizeConsoleText(value: unknown, maxLength: number): string {
  const raw = String(value ?? "");
  const truncated = raw.slice(0, maxLength);
  const stripped = [...truncated]
    .filter((character) => {
      const code = character.charCodeAt(0);
      if (code === 9 || code === 10 || code === 13) {
        return true;
      }
      if (code < 32 || code === 127) {
        return false;
      }
      return true;
    })
    .join("");
  return stripped.replace(HTML_SPECIALS, (character) => HTML_ESCAPE_TABLE[character] || character);
}

export function sanitizeConsoleEntry(entry: ConsoleEntry): ConsoleEntry {
  const sanitized: ConsoleEntry = {
    ...entry,
    command: sanitizeConsoleText(entry.command, 4096),
    response: sanitizeConsoleText(entry.response, 65536)
  };

  if (entry.error !== undefined) {
    sanitized.error = sanitizeConsoleText(entry.error, 65536);
  }

  return sanitized;
}
