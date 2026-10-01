import axios, { AxiosError } from 'axios';

/**
 * Single axios instance. The access token lives in memory only (set by
 * AuthProvider); the refresh token is an httpOnly cookie the browser sends
 * automatically. A 401 triggers one transparent refresh + retry.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function setOnAuthLost(fn: () => void) {
  onAuthLost = fn;
}

const PRINCIPAL_STORAGE_KEY = 'mla-fms:active-principal';

function readStoredPrincipal(): string | null {
  try {
    return localStorage.getItem(PRINCIPAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

let activePrincipalId: string | null = readStoredPrincipal();

/**
 * Which principal (MLA-S / MLA-N / MP) the signed-in user is currently acting
 * as - only meaningful for users with more than one. The server never trusts
 * this header alone; it's intersected with the user's actual principalIds
 * server-side, so this only narrows an already-authorized view, never widens it.
 */
export function setActivePrincipal(id: string | null) {
  activePrincipalId = id;
  try {
    if (id) localStorage.setItem(PRINCIPAL_STORAGE_KEY, id);
    else localStorage.removeItem(PRINCIPAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
export function getActivePrincipal(): string | null {
  return activePrincipalId;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (activePrincipalId) config.headers['X-Principal-Id'] = activePrincipalId;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  refreshing ??= axios
    .post('/api/auth/refresh', {}, { withCredentials: true })
    .then((r) => {
      accessToken = r.data.accessToken as string;
      return accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const url = original?.url ?? '';
    if (error.response?.status === 401 && original && !original._retried && !url.includes('/auth/')) {
      original._retried = true;
      const fresh = await refreshToken();
      if (fresh) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${fresh}`;
        return api(original);
      }
      onAuthLost?.();
    }
    return Promise.reject(error);
  },
);

/** Normalises an axios error into a user-facing message. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message ?? err.message ?? fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
