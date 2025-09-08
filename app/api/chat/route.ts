import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Get webhook URL from environment variable
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!N8N_WEBHOOK_URL) {
  throw new Error("N8N_WEBHOOK_URL environment variable is required but not set");
}

// Type assertion since we've already checked it's not undefined
const webhookUrl: string = N8N_WEBHOOK_URL;

export async function POST(req: NextRequest) {
  try {
    // Configuration validation
    if (!N8N_WEBHOOK_URL) {
      return NextResponse.json({ error: "Service configuration error" }, { status: 500 });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate body structure and message content
    if (!body || typeof body !== 'object' || !('message' in body)) {
      return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
    }

    const message = (body as { message: unknown }).message;
    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
    }

    // Normalize the message
    const normalizedMessage = message.trim();
    
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    let upstream: Response;
    try {
      upstream = await fetch(webhookUrl, {
        method: "POST",
        headers: { 
          "content-type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ message: normalizedMessage }),
        signal: controller.signal,
        // Avoid caching
        cache: "no-store",
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: "Request timeout" }, { status: 408 });
      }
      throw error;
    }
    
    clearTimeout(timeoutId);

    const ct = upstream.headers.get("content-type") || "";
    let reply: string = "";
    if (ct.includes("application/json")) {
      const json = await upstream.json().catch(() => ({}));
      reply = json.reply || json.response || json.text || json.message || JSON.stringify(json);
    } else {
      reply = await upstream.text();
    }

    if (!upstream.ok) {
      // Log upstream error details server-side for debugging
      console.error('Upstream error:', {
        status: upstream.status,
        statusText: upstream.statusText,
        body: reply,
        url: webhookUrl,
        timestamp: new Date().toISOString()
      });
      
      // Return generic error to client without exposing upstream details
      return NextResponse.json({ error: "Upstream error" }, { status: upstream.status });
    }

    return NextResponse.json({ reply: String(reply ?? "") });
  } catch (e: unknown) {
    // Handle different error types with appropriate HTTP status codes
    if (e instanceof Error) {
      const errorMessage = e.message.toLowerCase();
      const errorName = e.name.toLowerCase();
      
      // Timeout errors - return 504 Gateway Timeout
      if (errorName === 'aborterror' || 
          errorMessage.includes('timeout') || 
          errorMessage.includes('timed out')) {
        return NextResponse.json({ error: "Gateway timeout" }, { status: 504 });
      }
      
      // Network/upstream failures - return 502 Bad Gateway
      if (errorMessage.includes('failed to fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('enotfound') ||
          errorMessage.includes('econnreset') ||
          errorMessage.includes('econnaborted') ||
          errorMessage.includes('etimedout') ||
          errorMessage.includes('ehostunreach') ||
          errorMessage.includes('eaddrinuse') ||
          errorMessage.includes('eaddrinuse') ||
          errorMessage.includes('transport') ||
          errorMessage.includes('connection')) {
        return NextResponse.json({ error: "Bad gateway" }, { status: 502 });
      }
      
      // For other Error instances, return 400 Bad Request
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    
    // Handle unknown non-Error values - return 400 with generic message
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
