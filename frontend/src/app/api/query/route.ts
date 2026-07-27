import { NextRequest, NextResponse } from "next/server";

// Set max function duration — tells the platform to allow long LLM responses
// (Next.js / OpenNext route segment config)
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://pramana-api-50044352049.development.catalystappsail.in";

export async function POST(request: NextRequest) {
  try {
    // Extract token from Authorization header or URL query param
    const authHeader = request.headers.get("authorization") || "";
    const token =
      authHeader.replace(/^Bearer\s+/i, "").trim() ||
      request.nextUrl.searchParams.get("token") ||
      "";

    const body = await request.text();

    // Build backend URL with token in query string as fallback auth
    const backendUrl = new URL(`${BACKEND}/api/query`);
    if (token) backendUrl.searchParams.set("token", token);

    // Abort controller for 55s timeout (LLM calls can take 20-30s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const backendRes = await fetch(backendUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Critical: disable Brotli compression so the response body is readable
        "Accept-Encoding": "identity",
        Accept: "application/json",
      },
      body: body,
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await backendRes.text();

    return new NextResponse(responseText, {
      status: backendRes.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const message = isTimeout
      ? "The AI is taking longer than expected. Please try again."
      : `Backend error: ${err instanceof Error ? err.message : String(err)}`;

    return NextResponse.json({ detail: message }, { status: isTimeout ? 504 : 503 });
  }
}
