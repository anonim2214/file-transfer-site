import { NextRequest } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { store, touch } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const session = store.sessions.get(id);
  if (!session) return new Response("Not found", { status: 404 });
  const file = session.files.find((f) => f.id === fileId);
  if (!file) return new Response("Not found", { status: 404 });
  if (file.status !== "ready") {
    return new Response("Not ready", { status: 409 });
  }
  if (!existsSync(file.path)) {
    return new Response("Gone", { status: 410 });
  }
  touch(session);

  const stat = statSync(file.path);
  const stream = createReadStream(file.path);
  const web = Readable.toWeb(stream) as ReadableStream<Uint8Array>;

  return new Response(web, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        file.name,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
