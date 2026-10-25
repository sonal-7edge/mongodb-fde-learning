/**
 * @typedef {Object} CallResult
 * @property {number} status
 * @property {number} roundTripMs   measured in the browser
 * @property {number|null} serverMs from the "Server-Timing: app;dur=<ms>" header
 * @property {any} body
 */

/**
 * Call the API and measure how long it takes.
 * @param {{method: string, path: string, body?: string, token?: string|null}} request
 * @returns {Promise<CallResult>}
 */
export async function callApi({ method, path, body, token }) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const hasBody = body && method !== "GET" && method !== "DELETE";
  if (hasBody) headers["Content-Type"] = "application/json";

  const startedAt = performance.now();
  const response = await fetch(path, { method, headers, body: hasBody ? body : undefined });
  const text = await response.text();
  const roundTripMs = performance.now() - startedAt;

  return {
    status: response.status,
    roundTripMs,
    serverMs: parseServerTiming(response.headers.get("server-timing")),
    body: parseJson(text),
  };
}

/** "app;dur=12.3" → 12.3 */
function parseServerTiming(header) {
  const match = /app;dur=([\d.]+)/.exec(header ?? "");
  return match ? Number(match[1]) : null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Read the expiry from a JWT without verifying it (display only; the server verifies).
 * @param {string} token
 * @returns {Date|null}
 */
export function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}
