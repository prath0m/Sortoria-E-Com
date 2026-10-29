/**
 * Fetch wrapper for /api/v1. Access tokens live only in memory; the refresh token is an
 * httpOnly cookie the browser sends to /api/v1/auth/. A 401 triggers one silent refresh
 * (single-flight, shared by concurrent requests) and a single retry.
 */

const BASE = '/api/v1';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  data: unknown;
  code?: string;

  constructor(status: number, data: unknown) {
    super(ApiError.messageFrom(data, status));
    this.status = status;
    this.data = data;
    if (data && typeof data === 'object' && 'code' in data) {
      this.code = String((data as { code: unknown }).code);
    }
  }

  static messageFrom(data: unknown, status: number): string {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.detail === 'string') return record.detail;
      if (Array.isArray(record.non_field_errors)) return String(record.non_field_errors[0]);
      const first = Object.values(record)[0];
      if (Array.isArray(first) && first.length) return String(first[0]);
    }
    if (status === 0) return "We couldn't reach Sartoria. Please check your connection.";
    if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
    return 'That request could not be completed.';
  }

  /** Field-level errors from DRF validation, for mapping onto form inputs. */
  get fieldErrors(): FieldErrors {
    if (this.status !== 400 || !this.data || typeof this.data !== 'object') return {};
    const out: FieldErrors = {};
    for (const [key, value] of Object.entries(this.data as Record<string, unknown>)) {
      if (Array.isArray(value)) out[key] = value.map(String);
      else if (typeof value === 'string' && key !== 'detail' && key !== 'code') out[key] = [value];
    }
    return out;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const sessionListeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Notified when a refresh fails, so the auth store can sign the user out. */
export function onSessionChange(listener: (token: string | null) => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

const CLIENT_HEADER = { 'X-Sartoria-Client': '1' };

export async function refreshSession<T = unknown>(): Promise<{ access: string; user: T } | null> {
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: 'POST',
    credentials: 'include',
    headers: CLIENT_HEADER,
  });
  if (!res.ok) return null;
  return res.json();
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession()
      .then((data) => {
        const token = data?.access ?? null;
        setAccessToken(token);
        sessionListeners.forEach((fn) => fn(token));
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query | URLSearchParams;
  signal?: AbortSignal;
  /** Skip the refresh-and-retry dance (used by auth endpoints themselves). */
  noRetry?: boolean;
}

export function buildQuery(query?: Query | URLSearchParams): string {
  if (!query) return '';
  if (query instanceof URLSearchParams) {
    const s = query.toString();
    return s ? `?${s}` : '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

declare global {
  interface Window {
    /** First-load API responses inlined by the server, keyed by path + query. Each is used once. */
    __SARTORIA_DATA__?: Record<string, unknown>;
  }
}

/** Read inlined data without consuming it, for a query's initialData (so the first render already has it). */
export function peekInlined<T>(key: string): T | undefined {
  const store = typeof window !== 'undefined' ? window.__SARTORIA_DATA__ : undefined;
  return store && key in store ? (store[key] as T) : undefined;
}

function takeInlined<T>(key: string): T | undefined {
  const store = typeof window !== 'undefined' ? window.__SARTORIA_DATA__ : undefined;
  if (!store || !(key in store)) return undefined;
  const data = store[key] as T;
  delete store[key];
  return data;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, noRetry } = options;
  if (method === 'GET' && !accessToken) {
    // Inlined data is anonymous, so a signed-in session always asks the API.
    const inlined = takeInlined<T>(`${path}${buildQuery(query)}`);
    if (inlined !== undefined) return inlined;
  }
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const send = () => {
    const headers: Record<string, string> = { Accept: 'application/json', ...CLIENT_HEADER };
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${BASE}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal,
      credentials: 'include',
    });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && accessToken && !noRetry) {
      const token = await refreshAccessToken();
      if (token) res = await send();
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, null);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json() : await res.blob();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Download a binary response (invoices) with auth applied. */
export async function apiBlob(path: string): Promise<Blob> {
  return api<Blob>(path);
}
