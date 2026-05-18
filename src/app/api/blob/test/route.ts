import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const blob = await put(
      `test-${Date.now()}.txt`,
      "hello from server",
      {
        access: "public",
        addRandomSuffix: true,
      },
    );
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message,
        name: (err as Error).name,
        stack: (err as Error).stack,
        hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
        tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 25) || null,
      },
      { status: 500 },
    );
  }
}
