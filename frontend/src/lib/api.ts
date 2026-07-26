/**
 * Central API client for Pramana frontend.
 *
 * All calls go through /api/proxy/... (Next.js server-side route) so the
 * browser never makes a cross-origin request and CORS preflights are
 * completely avoided.
 */

// Always use the Next.js proxy — empty string means same origin
export const PROXY_BASE = "";

export function buildUrl(path: string, token?: string | null): string {
  // path examples: "api/query", "api/sessions", "api/sessions/3"
  const base = `/api/proxy/${path}`;
  if (token) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}token=${encodeURIComponent(token)}`;
  }
  return base;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getAuthHeaders(token?: string | null): HeadersInit {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
