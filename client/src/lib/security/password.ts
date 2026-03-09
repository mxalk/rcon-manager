const TRANSPORT_PASSWORD_PREFIX = "sha256:";

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPasswordForTransport(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const digestBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const digestHex = toHex(new Uint8Array(digestBuffer));
  return `${TRANSPORT_PASSWORD_PREFIX}${digestHex}`;
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }
}
