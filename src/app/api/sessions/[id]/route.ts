import { NextRequest, NextResponse } from "next/server";
import { rotateCode, sessionView, store, touch } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = store.sessions.get(id);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  touch(session);

  // If still waiting and code expired, auto-rotate so the client never sees a stale code.
  if (session.status === "waiting" && Date.now() > session.codeExpiresAt) {
    rotateCode(session);
  }
  return NextResponse.json(sessionView(session));
}
