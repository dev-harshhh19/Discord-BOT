import { store } from './state.js';
import { showToast } from './components/toast.js';

/**
 * Robust API Client with DDoS Rate Limit Interceptor and Token Injection
 */

export async function apiRequest(endpoint, options = {}) {
  const { token } = store.getState();
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    // Handle 429 Too Many Requests (DDoS & Rate Limit protection)
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const retryAfter = res.headers.get('Retry-After') || '60';
      const msg = data.error || `Rate limit reached. Please wait ${retryAfter}s.`;
      showToast(msg, 'warning', 6000);
      return { success: false, rateLimited: true, error: msg, retryAfter: Number(retryAfter) };
    }

    // Handle 401 Unauthorized / 403 Forbidden
    if (res.status === 401 || res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (token && endpoint !== '/api/auth/login') {
        // Token was invalid or expired
        store.clearToken();
        showToast('Admin session expired or credentials invalid.', 'warning');
      }
      return { success: false, unauthorized: true, error: data.error || 'Unauthorized' };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || `Request failed (${res.status})` };
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    return { success: false, error: 'Network error or server unavailable.' };
  }
}

export const api = {
  // Auth
  login: (password) => apiRequest('/api/auth/login', { method: 'POST', body: { password } }),
  checkAuth: () => apiRequest('/api/auth/check'),

  // Status & Telemetry
  getStatus: () => apiRequest('/api/status'),
  getMembers: () => apiRequest('/api/members'),
  getAccessControl: () => apiRequest('/api/access-control'),
  getLogs: (limit = 100) => apiRequest(`/api/logs?limit=${limit}`),
  getDevInfo: () => apiRequest('/api/dev'),

  // Server Control Actions (Admin Gated)
  startServer: () => apiRequest('/api/action/start', { method: 'POST' }),
  stopServer: () => apiRequest('/api/action/stop', { method: 'POST' }),
  restartServer: () => apiRequest('/api/action/restart', { method: 'POST' }),
  pollServer: () => apiRequest('/api/action/poll', { method: 'POST' }),
};
