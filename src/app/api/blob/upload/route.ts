import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { addFile, generateId, getSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const sessionId: string | undefined = payload.sessionId;
        if (!sessionId) throw new Error("sessionId required");
        const session = await getSession(sessionId);
        if (!session) throw new Error("session not found");
        if (session.status !== "connected") {
          throw new Error("session not connected");
        }
        return {
          allowedContentTypes: ["*/*"],
          // Stashed in onUploadCompleted's tokenPayload.
          tokenPayload: JSON.stringify({
            sessionId,
            fileId: generateId(8),
            name: payload.name,
            type: payload.type,
            size: payload.size,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) return;
        const data = JSON.parse(tokenPayload);
        await addFile(data.sessionId, {
          id: data.fileId,
          name: data.name || blob.pathname,
          type: data.type || "application/octet-stream",
          size: data.size || 0,
          url: blob.url,
          uploadedAt: Date.now(),
        });
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
