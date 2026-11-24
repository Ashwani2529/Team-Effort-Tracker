const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
export class ApiError extends Error { constructor(public status: number, public payload: any) { super(payload?.message || payload?.error || `Request failed (${status})`); } }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new ApiError(response.status, payload); }
  if (response.status === 204) return undefined as T; return response.json() as Promise<T>;
}
