import { apiRequest } from "../api.js";
import { assertPasswordPolicy, hashPasswordForTransport } from "../security/password.js";
import type {
  AccountRole,
  CreateUserPayload,
  ServerPermission,
  UserResponse,
  UsersResponse
} from "../types.js";

export function listUsersQuery(token: string) {
  return apiRequest<UsersResponse>("/api/users", { token });
}

export async function createUserQuery(token: string, body: CreateUserPayload) {
  assertPasswordPolicy(body.password);
  const hashedPassword = await hashPasswordForTransport(body.password);
  return apiRequest<UserResponse>("/api/users", {
    token,
    method: "POST",
    body: {
      ...body,
      password: hashedPassword
    }
  });
}

export function updateUserRoleQuery(token: string, userId: string, role: AccountRole) {
  return apiRequest<UserResponse>(`/api/users/${userId}`, {
    token,
    method: "PUT",
    body: { role }
  });
}

export function updateUserServerPermissionsQuery(
  token: string,
  userId: string,
  serverPermissions: ServerPermission[]
) {
  return apiRequest<UserResponse>(`/api/users/${userId}`, {
    token,
    method: "PUT",
    body: { serverPermissions }
  });
}

export async function updateUserPasswordQuery(token: string, userId: string, password: string) {
  assertPasswordPolicy(password);
  const hashedPassword = await hashPasswordForTransport(password);
  return apiRequest<void>(`/api/users/${userId}/password`, {
    token,
    method: "PUT",
    body: { password: hashedPassword }
  });
}

export function deleteUserQuery(token: string, userId: string) {
  return apiRequest<void>(`/api/users/${userId}`, {
    token,
    method: "DELETE"
  });
}
