import { NextResponse } from "next/server";
import { createSession, sessionView } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = createSession();
  return NextResponse.json(sessionView(session));
}
