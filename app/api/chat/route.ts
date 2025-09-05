import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const N8N_WEBHOOK = "https://jordenshevel.app.n8n.cloud/webhook/e46fe921-cc30-484b-996e-1e14e083fdfc/chat";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { message?: string };
    if (!body?.message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }
    const upstream = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: body.message }),
      // Avoid caching
      cache: "no-store",
    });

    const ct = upstream.headers.get("content-type") || "";
    let reply: string = "";
    if (ct.includes("application/json")) {
      const json = await upstream.json().catch(() => ({}));
      reply = json.reply || json.response || json.text || json.message || JSON.stringify(json);
    } else {
      reply = await upstream.text();
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: reply || "Upstream error" }, { status: upstream.status });
    }

    return NextResponse.json({ reply: String(reply ?? "") });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

