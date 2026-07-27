/**
 * apiFetch — direct, CORS-safe fetch client for Pramana frontend on Slate.
 *
 * Strategy:
 *   Direct backend URL with token in query parameter (?token=...)
 *   - For GET: NO custom headers (no Authorization, no Content-Type).
 *     This keeps GET as a "CORS Simple Request" — the browser NEVER sends an
 *     OPTIONS preflight, bypassing Zoho ZGS CORS preflight interception completely.
 *   - For POST: use form-urlencoded or query parameters.
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
  const { method = "GET", body, token = "" } = options;

  const isGet = method.toUpperCase() === "GET";
  const separator = path.includes("?") ? "&" : "?";
  const tokenParam = token ? `${separator}token=${encodeURIComponent(token)}` : "";
  const url = `${BACKEND}${path}${tokenParam}`;

  try {
    // For GET: NO custom headers. Guarantees a CORS Simple Request (no preflight OPTIONS sent by browser).
    // For POST: send Content-Type application/x-www-form-urlencoded
    const headers: HeadersInit = isGet
      ? {}
      : { "Content-Type": options.contentType || "application/x-www-form-urlencoded" };

    const res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data !== null) {
        return { ok: true, status: res.status, data };
      }
    }
    const errData = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: errData };
  } catch (err: any) {
    console.warn(`[apiFetch] Network or fetch error for ${url}:`, err);
    return { ok: false, status: 0, data: {} };
  }
}
