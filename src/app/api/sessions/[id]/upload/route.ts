import { NextRequest, NextResponse } from "next/server";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import {
  FileEntry,
  TMP_DIR,
  generateId,
  store,
  touch,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long-running uploads for big files (hobby plan max).
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = store.sessions.get(id);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.status !== "connected") {
    return NextResponse.json(
      { error: "session not connected" },
      { status: 400 },
    );
  }
  if (!req.body) {
    return NextResponse.json({ error: "no body" }, { status: 400 });
  }

  const url = new URL(req.url);
  const name = (url.searchParams.get("name") || "file").slice(0, 255);
  const type =
    url.searchParams.get("type") || "application/octet-stream";
  const sizeParam = url.searchParams.get("size");
  const declaredSize = sizeParam ? Math.max(0, parseInt(sizeParam, 10)) : 0;

  const fileId = generateId(8);
  const filePath = path.join(TMP_DIR, `${session.id}-${fileId}`);
  const entry: FileEntry = {
    id: fileId,
    name,
    type,
    size: declaredSize,
    uploadedBytes: 0,
    status: "uploading",
    path: filePath,
    createdAt: Date.now(),
  };
  session.files.push(entry);
  touch(session);

  const nodeStream = Readable.fromWeb(req.body as never);
  nodeStream.on("data", (chunk: Buffer) => {
    entry.uploadedBytes += chunk.length;
    touch(session);
  });

  const writeStream = createWriteStream(filePath);

  try {
    await pipeline(nodeStream, writeStream);
    entry.status = "ready";
    if (!entry.size) entry.size = entry.uploadedBytes;
    touch(session);
    return NextResponse.json({
      fileId,
      status: entry.status,
      size: entry.uploadedBytes,
    });
  } catch (err) {
    entry.status = "error";
    return NextResponse.json(
      { error: (err as Error)?.message || "upload failed" },
      { status: 500 },
    );
  }
}
