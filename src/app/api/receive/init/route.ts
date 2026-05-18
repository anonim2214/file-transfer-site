import { NextResponse } from "next/server";
import { createSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const session = await createSession();
  const url = new URL("/receive", req.url);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set("ftrx_session", session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

export const GET = handle;
export const POST = handle;
