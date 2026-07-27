import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://pramana-api-50044352049.development.catalystappsail.in";

// Increase timeout for LLM calls (can take 20-30s)
const BACKEND_TIMEOUT_MS = 55000;

// Next.js 15: dynamic route params are now a Promise — must be awaited
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, "POST");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, "DELETE");
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, "OPTIONS");
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const backendPath = "/" + pathSegments.join("/");
  const search = request.nextUrl.search;
  const url = `${BACKEND}${backendPath}${search}`;

  const authHeader = request.headers.get("authorization");
  const contentType =
    request.headers.get("content-type") || "application/json";

  const forwardHeaders: HeadersInit = {
    "Content-Type": contentType,
    "Accept": "application/json",
    "Accept-Encoding": "identity", // Disable compression to avoid Slate decompression issues
  };
  if (authHeader) {
    forwardHeaders["Authorization"] = authHeader;
  }

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "DELETE" && method !== "OPTIONS") {
    body = await request.text();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);

    const backendRes = await fetch(url, {
      method,
      headers: forwardHeaders,
      body: body || undefined,
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await backendRes.text();

    return new NextResponse(responseBody, {
      status: backendRes.status,
      headers: {
        "Content-Type":
          backendRes.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error("[proxy] backend fetch failed:", isTimeout ? "TIMEOUT" : err);
    return NextResponse.json(
      {
        detail: isTimeout
          ? "Backend request timed out. The LLM is taking too long. Please retry."
          : "Backend unavailable. Please try again shortly.",
      },
      { status: isTimeout ? 504 : 503 }
    );
  }
}
