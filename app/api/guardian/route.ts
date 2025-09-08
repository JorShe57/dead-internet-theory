import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getGuardianWebhookUrl(): string | null {
  const url = process.env.N8N_GUARDIAN_WEBHOOK_URL || process.env.GUARDIAN_WEBHOOK_URL || null;
  return url && url.trim() !== "" ? url : null;
}

export async function POST(req: NextRequest) {
  try {
    // Validate configuration at request-time to avoid build failures
    const webhookUrl = getGuardianWebhookUrl();
    if (!webhookUrl) {
      return NextResponse.json({ error: "Guardian service not configured" }, { status: 500 });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !("message" in body)) {
      return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
    }
    const message = (body as { message: unknown }).message;
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let upstream: Response;
    try {
      upstream = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message: message.trim() }),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json({ error: "Request timeout" }, { status: 408 });
      }
      throw error;
    }

    clearTimeout(timeoutId);

    const ct = upstream.headers.get("content-type") || "";
    let reply = "";
    if (ct.includes("application/json")) {
      const json = await upstream.json().catch(() => ({}));
      reply = (json as any).reply || (json as any).response || (json as any).text || (json as any).message || JSON.stringify(json);
    } else {
      reply = await upstream.text();
    }

    if (!upstream.ok) {
      // Do not leak upstream details
      return NextResponse.json({ error: "Upstream error" }, { status: upstream.status });
    }

    return NextResponse.json({ reply: String(reply ?? "") });
  } catch (e: unknown) {
    if (e instanceof Error) {
      const msg = e.message.toLowerCase();
      if (e.name.toLowerCase() === "aborterror" || msg.includes("timeout") || msg.includes("timed out")) {
        return NextResponse.json({ error: "Gateway timeout" }, { status: 504 });
      }
      if (
        msg.includes("failed to fetch") ||
        msg.includes("network") ||
        msg.includes("econn") ||
        msg.includes("enotfound") ||
        msg.includes("reset") ||
        msg.includes("aborted") ||
        msg.includes("etimedout") ||
        msg.includes("unreach") ||
        msg.includes("transport") ||
        msg.includes("connection")
      ) {
        return NextResponse.json({ error: "Bad gateway" }, { status: 502 });
      }
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

