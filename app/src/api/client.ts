/**
 * Typed REST client for the production API. Every request carries the Entra
 * access token as a bearer header; the backend validates it and enforces RBAC.
 *
 * This is the seam that replaces the demo's localStorage store: swap the
 * zustand persistence layer to read/write through these calls against the
 * NestJS backend. See docs/02-data-flow.md.
 */
import { getAccessToken } from './auth';

const BASE = (import.meta.env.VITE_API_BASE as string) || '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail: unknown;
    try { detail = await res.json(); } catch { /* non-JSON error */ }
    throw new ApiError(res.status, `${method} ${path} → ${res.status}`, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Convenience typed endpoints (extend per collection). */
export interface Me {
  id: string;
  name: string;
  type: 'chair' | 'office' | 'sector' | 'sysadmin';
  scope: string;
  all: boolean;
  permissions: Record<string, string[]>;
}

export const authApi = {
  me: () => api.get<Me>('/auth/me'),
};

export const projectsApi = {
  list: () => api.get<unknown[]>('/projects'),
  get: (id: string) => api.get<unknown>(`/projects/${id}`),
  create: (dto: unknown) => api.post<unknown>('/projects', dto),
  update: (id: string, dto: unknown) => api.patch<unknown>(`/projects/${id}`, dto),
  remove: (id: string) => api.del<void>(`/projects/${id}`),
  submit: (id: string) => api.post<unknown>(`/projects/${id}/submit`),
  decide: (id: string, decision: 'approve' | 'return', note?: string) =>
    api.post<unknown>(`/projects/${id}/decision`, { decision, note }),
};
