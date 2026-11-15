import { Platform } from 'react-native';
import { sellerTokenStorage } from './authStorage';

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if ((host === 'localhost' || host === '127.0.0.1') && envUrl?.startsWith('http://192.168.')) {
      return 'http://localhost:3001';
    }
  }
  if (envUrl && envUrl.trim()) {
    return envUrl.replace(/\/+$/, '');
  }
  // Default for local emulator / simulator testing
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }
  return 'http://localhost:3001';
}

type ClerkTokenGetter = () => Promise<string | null>;

let clerkTokenGetter: ClerkTokenGetter | null = null;

export function registerClerkTokenGetter(getter: ClerkTokenGetter | null) {
  clerkTokenGetter = getter;
}

export class ApiError extends Error {
  status: number;
  code: string;
  data?: unknown;

  constructor(status: number, code: string, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function generateIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function resolveBearerToken(): Promise<{ token: string | null; kind: 'clerk' | 'seller' | null }> {
  if (clerkTokenGetter) {
    try {
      const clerkJwt = await clerkTokenGetter();
      if (clerkJwt) {
        return { token: clerkJwt, kind: 'clerk' };
      }
    } catch {
      // fall back to seller token
    }
  }
  const sellerTokens = await sellerTokenStorage.get();
  if (sellerTokens?.accessToken) {
    return { token: sellerTokens.accessToken, kind: 'seller' };
  }
  return { token: null, kind: null };
}

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    idempotent?: boolean;
    idempotencyKey?: string;
    tokenOverride?: string;
    skipAuth?: boolean;
  } = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.idempotent || options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey ?? generateIdempotencyKey();
  }

  let tokenKind: 'clerk' | 'seller' | null = null;
  if (!options.skipAuth) {
    if (options.tokenOverride) {
      headers.Authorization = `Bearer ${options.tokenOverride}`;
    } else {
      const resolved = await resolveBearerToken();
      tokenKind = resolved.kind;
      if (resolved.token) {
        headers.Authorization = `Bearer ${resolved.token}`;
      }
    }
  }

  const doRequest = async (reqHeaders: Record<string, string>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: reqHeaders,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Cannot reach backend at ${baseUrl} (timed out). Check Wi-Fi or firewall.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      json = { message: text };
    }
    return { res, json };
  };

  let { res, json } = await doRequest(headers);

  // Automatic Seller refresh token rotation on 401
  if (res.status === 401 && tokenKind === 'seller' && !options.skipAuth) {
    const sellerTokens = await sellerTokenStorage.get();
    if (sellerTokens?.refreshToken) {
      const refreshRes = await fetch(`${baseUrl}/auth/seller/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: sellerTokens.refreshToken,
          deviceFingerprint: sellerTokens.deviceFingerprint,
        }),
      });
      if (refreshRes.ok) {
        const refreshed = (await refreshRes.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        await sellerTokenStorage.set({
          ...sellerTokens,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        });
        headers.Authorization = `Bearer ${refreshed.accessToken}`;
        const retried = await doRequest(headers);
        res = retried.res;
        json = retried.json;
      } else {
        await sellerTokenStorage.clear();
      }
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      String(json.error ?? 'API_ERROR'),
      String(json.message ?? json.error ?? `Request failed with status ${res.status}`),
      json
    );
  }

  return json as T;
}
