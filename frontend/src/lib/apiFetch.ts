/**
 * apiFetch — works in BOTH static export and SSR proxy deployments.
 *
 * Strategy:
 *   1. Direct backend URL with token in query param — simple CORS request for GET,
 *      no OPTIONS preflight, hits AppSail directly.
 *   2. Fall back to /api/proxy/* (Next.js SSR proxy) if direct backend fetch fails.
 *
 * CRITICAL: Do NOT send Content-Type header on GET requests.
 * Zoho ZGS gateway intercepts OPTIONS preflight and strips CORS headers,
 * causing the browser to block any request that triggers a preflight.
 * GET requests without Content-Type are "simple requests" — no preflight needed.
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

  const separator = path.includes("?") ? "&" : "?";
  const tokenParam = token ? `${separator}token=${encodeURIComponent(token)}` : "";

  // For GET requests: send NO Content-Type header.
  // This keeps it a CORS "simple request" — no preflight OPTIONS — bypassing ZGS interception.
  // For POST/PUT/PATCH etc: Content-Type is required.
  const isGet = method.toUpperCase() === "GET";

  // --- Strategy 1: Direct backend with token in query param ---
  try {
    const directHeaders: HeadersInit = isGet ? {} : { "Content-Type": contentType };
    const url = `${BACKEND}${path}${tokenParam}`;
    const r1 = await fetch(url, {
      method,
      headers: directHeaders,
      body: body || undefined,
      cache: "no-store",
    });

    if (r1.ok) {
      const data = await r1.json().catch(() => null);
      if (data !== null) {
        return { ok: true, status: r1.status, data };
      }
    }
  } catch {
    // direct fetch failed — fall through to proxy
  }

  // --- Strategy 2: Next.js SSR proxy fallback ---
  try {
    const headers: HeadersInit = isGet ? {} : { "Content-Type": contentType };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const r2 = await fetch(`/api/proxy${path}${tokenParam}`, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });

    if (r2.ok) {
      const data2 = await r2.json().catch(() => null);
      if (data2 !== null) {
        return { ok: true, status: r2.status, data: data2 };
      }
    }
    return { ok: r2.ok, status: r2.status, data: {} };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

