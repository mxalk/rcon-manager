import { apiRequest } from "../api.js";
import type { ServerPayload, ServerResponse, ServersResponse } from "../types.js";

export function listServersQuery(token: string) {
  return apiRequest<ServersResponse>("/api/servers", { token });
}

export function createServerQuery(token: string, body: Required<ServerPayload>) {
  return apiRequest<ServerResponse>("/api/servers", {
    token,
    method: "POST",
    body
  });
}

export function updateServerQuery(token: string, serverId: string, body: Required<ServerPayload>) {
  return apiRequest<ServerResponse>(`/api/servers/${serverId}`, {
    token,
    method: "PUT",
    body
  });
}

export function deleteServerQuery(token: string, serverId: string) {
  return apiRequest<void>(`/api/servers/${serverId}`, {
    token,
    method: "DELETE"
  });
}
