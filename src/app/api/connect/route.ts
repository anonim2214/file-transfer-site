import { NextRequest, NextResponse } from "next/server";
import { consumeCode, findByCode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const raw = (body as { code?: unknown })?.code;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const code = raw.trim();
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const session = await findByCode(code);
  if (!session) {
    return NextResponse.json(
      { error: "Код неверный или истёк" },
      { status: 404 },
    );
  }
  await consumeCode(session);
  return NextResponse.json({ sessionId: session.id });
}
