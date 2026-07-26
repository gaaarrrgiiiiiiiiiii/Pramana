import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://pramana-api-50044352049.development.catalystappsail.in";

// Proxy all methods to the backend - no CORS issues since this runs server-side
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, "POST");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, "GET");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, "DELETE");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return proxyRequest(request, params.path, "PUT");
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
  const forwardHeaders: HeadersInit = {
    "Content-Type": request.headers.get("content-type") || "application/json",
  };
  if (authHeader) {
    forwardHeaders["Authorization"] = authHeader;
  }

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "DELETE") {
    body = await request.text();
  }

  try {
    const backendRes = await fetch(url, {
      method,
      headers: forwardHeaders,
      body: body || undefined,
      cache: "no-store",
    });

    const responseBody = await backendRes.text();
    return new NextResponse(responseBody, {
      status: backendRes.status,
      headers: {
        "Content-Type":
          backendRes.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("[proxy] backend fetch failed:", err);
    return NextResponse.json(
      { detail: "Backend unavailable. Please try again shortly." },
      { status: 503 }
    );
  }
}
