import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8081/api/v1').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

// Keep CSRF retrieval isolated from legacyApiBridge's global Axios interceptors.
const csrfApi = axios.create({
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export const getCsrfToken = async (force = false): Promise<string> => {
  if (force) csrfToken = null;
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = csrfApi
      .get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true })
      .then((response) => {
        csrfToken = response.data.data.csrf_token as string;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
};

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers.set('X-CSRF-Token', await getCsrfToken());
  }
  config.headers.delete('Authorization');
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 419) {
      csrfToken = null;
    }
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('admin:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export const apiMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: { message?: string } } | undefined;
    return payload?.error?.message || fallback;
  }
  return fallback;
};
