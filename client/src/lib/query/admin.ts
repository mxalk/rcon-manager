import { apiRequest } from "../api.js";
import type { CleanupArtifactsResponse, CleanupArtifactsStatusResponse } from "../types.js";

export function cleanupArtifactsStatusQuery(token: string) {
  return apiRequest<CleanupArtifactsStatusResponse>("/api/admin/cleanup-artifacts", {
    token
  });
}

export function cleanupArtifactsQuery(token: string) {
  return apiRequest<CleanupArtifactsResponse>("/api/admin/cleanup-artifacts", {
    token,
    method: "POST"
  });
}
