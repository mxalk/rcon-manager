import { apiRequest } from "../api.js";
import { hashPasswordForTransport } from "../security/password.js";
import type { LoginResponse, MeResponse } from "../types.js";

export async function loginQuery(credentials: { username: string; password: string }) {
  const hashedPassword = await hashPasswordForTransport(credentials.password);
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: {
      username: credentials.username,
      password: hashedPassword
    }
  });
}

export function currentUserQuery(token: string) {
  return apiRequest<MeResponse>("/api/auth/me", { token });
}
