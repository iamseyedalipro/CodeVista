export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: {
    signal?: AbortSignal;
    method?: string;
    body?: unknown;
    csrf?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
    method: options.method ?? "GET",
    headers: {
      ...(options.csrf ? { "x-csrf-token": options.csrf } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const value = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("codevista-session-ended"));
    throw new RequestError(
      response.status,
      value.error?.code ?? "REQUEST_FAILED",
      value.error?.message ?? "The request failed. Retry later.",
    );
  }
  return value as T;
}
export const message = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The request could not be completed.";
export interface SessionInfo {
  user: { login: string } | null;
  csrf?: string;
  configured: boolean;
  installationUrl: string | null;
}
export interface RepositoryInfo {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  selectedBranch: string;
  lastVisitedAt: string | null;
  disconnected: boolean;
}
