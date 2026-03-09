const API_PREFIX = "/api";

interface ApiRequestOptions {
  token?: string;
  method?: string;
  body?: unknown;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function apiRequest<T>(
  path: string,
  { token, method = "GET", body }: ApiRequestOptions = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path === "/api" ? "" : path;
  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? authHeaders(token) : {})
    }
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_PREFIX}${normalizedPath}`, requestInit);

  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  if (!response.ok) {
    throw new Error(typeof parsed.error === "string" ? parsed.error : `Request failed (${response.status})`);
  }

  return parsed as T;
}
