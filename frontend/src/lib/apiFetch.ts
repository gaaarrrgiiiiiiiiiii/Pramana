/**
 * apiFetch — works in BOTH static export and SSR proxy deployments.
 *
 * Strategy:
 *   1. Try /api/proxy/* (Next.js SSR proxy) — works when SSR build is deployed
 *   2. Fall back to direct backend URL with token in query param — works in static build
 *      (GET with query param = simple request = no CORS preflight)
 */

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://pramana-api-50044352049.development.catalystappsail.in";

type FetchOptions = {
  method?: string;
  body?: string;
  contentType?: string;
  token?: string;
};

export async function apiFetch(
  path: string, // e.g. "/api/sessions" or "/api/query"
  options: FetchOptions = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const { method = "GET", body, contentType = "application/json", token = "" } = options;

  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";

  // --- Strategy 1: Next.js SSR proxy (no CORS issues at all) ---
  try {
    const headers: HeadersInit = { "Content-Type": contentType };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const r = await fetch(`/api/proxy${path}${tokenParam}`, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });

    // If the proxy responds (even 4xx/5xx), use it
    if (r.status !== 404 && r.status !== 502 && r.status !== 503) {
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data };
    }
  } catch {
    // proxy not available — fall through to direct
  }

  // --- Strategy 2: Direct backend with token in query param ---
  // GET with query param is a "simple request" — no CORS preflight needed
  const directHeaders: HeadersInit = { "Content-Type": contentType };
  // DON'T send Authorization header for GET (that triggers a preflight)
  // token is sent via ?token= query param — the backend accepts both

  const url = `${BACKEND}${path}${tokenParam}`;
  const r2 = await fetch(url, {
    method,
    headers: directHeaders,
    body: body || undefined,
    cache: "no-store",
  });
  const data2 = await r2.json().catch(() => ({}));
  return { ok: r2.ok, status: r2.status, data: data2 };
}
