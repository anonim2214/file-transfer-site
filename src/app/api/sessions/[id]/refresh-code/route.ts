import { NextRequest, NextResponse } from "next/server";
import { rotateCode, sessionView, store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = store.sessions.get(id);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.status !== "waiting") {
    return NextResponse.json(sessionView(session));
  }
  rotateCode(session);
  return NextResponse.json(sessionView(session));
}
