/**
 * All network calls to the tracking backend live here.
 * Every call that carries data uses the driver's JWT (Bearer token).
 */

import { API_BASE_URL } from './config';

async function request(path, { method = 'GET', token, body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function login(driverId, password) {
  return request('/api/driver/login', { method: 'POST', body: { driverId, password } });
}

export function fetchMe(token) {
  return request('/api/driver/me', { token });
}

/** Upload a batch of points. Returns {accepted, rejected, ...}. */
export function sendLocations(token, points) {
  return request('/api/locations', { method: 'POST', token, body: { points } });
}

export function ping() {
  return request('/health', { timeoutMs: 8000 });
}
