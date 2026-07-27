/**
 * Central API client helper for Pramana frontend.
 */

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://pramana-api-50044352049.development.catalystappsail.in";

export const PROXY_BASE = BACKEND;

export function buildUrl(path: string, token?: string | null): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = `${BACKEND}${cleanPath}`;
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

export function getAuthHeaders(): HeadersInit {
  // Returns empty headers for simple GET requests to avoid triggering CORS OPTIONS preflights
  return {};
}
