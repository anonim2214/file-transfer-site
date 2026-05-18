import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const CODE_TTL_MS = 30_000;
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1h idle
export const TMP_DIR = path.join(tmpdir(), "file-transfer-site");

mkdirSync(TMP_DIR, { recursive: true });

export type FileStatus = "uploading" | "ready" | "error";

export type FileEntry = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedBytes: number;
  status: FileStatus;
  path: string;
  createdAt: number;
};

export type SessionStatus = "waiting" | "connected" | "done";

export type Session = {
  id: string;
  code: string;
  codeExpiresAt: number;
  status: SessionStatus;
  files: FileEntry[];
  createdAt: number;
  lastSeen: number;
};

type StoreShape = {
  sessions: Map<string, Session>;
  codeIndex: Map<string, string>; // code -> sessionId (only while waiting)
  cleanupTimer?: NodeJS.Timeout;
};

const g = globalThis as unknown as { __transferStore?: StoreShape };

export const store: StoreShape =
  g.__transferStore ??
  (g.__transferStore = {
    sessions: new Map(),
    codeIndex: new Map(),
  });

if (!store.cleanupTimer) {
  store.cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, s] of store.sessions) {
      if (now - s.lastSeen > SESSION_TTL_MS) {
        destroySession(id);
      }
    }
  }, 60_000);
  // Don't keep the Node event loop alive just for cleanup.
  store.cleanupTimer.unref?.();
}

const CODE_ALPHABET = "23456789"; // numeric-only, no easily confused chars
export function generateCode(length = 6): string {
  let code = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  // Avoid collision with an active code.
  if (store.codeIndex.has(code)) return generateCode(length);
  return code;
}

export function generateId(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}

export function createSession(): Session {
  const id = generateId();
  const code = generateCode();
  const now = Date.now();
  const session: Session = {
    id,
    code,
    codeExpiresAt: now + CODE_TTL_MS,
    status: "waiting",
    files: [],
    createdAt: now,
    lastSeen: now,
  };
  store.sessions.set(id, session);
  store.codeIndex.set(code, id);
  return session;
}

export function rotateCode(session: Session): Session {
  if (session.status !== "waiting") return session;
  if (session.code) store.codeIndex.delete(session.code);
  session.code = generateCode();
  session.codeExpiresAt = Date.now() + CODE_TTL_MS;
  session.lastSeen = Date.now();
  store.codeIndex.set(session.code, session.id);
  return session;
}

export function findByCode(code: string): Session | null {
  const id = store.codeIndex.get(code);
  if (!id) return null;
  const session = store.sessions.get(id);
  if (!session) {
    store.codeIndex.delete(code);
    return null;
  }
  if (session.status !== "waiting") return null;
  if (Date.now() > session.codeExpiresAt) return null;
  return session;
}

export function consumeCode(session: Session) {
  if (session.code) store.codeIndex.delete(session.code);
  session.status = "connected";
  session.lastSeen = Date.now();
}

export function touch(session: Session) {
  session.lastSeen = Date.now();
}

export function destroySession(id: string) {
  const s = store.sessions.get(id);
  if (!s) return;
  for (const f of s.files) {
    try {
      rmSync(f.path, { force: true });
    } catch {
      /* ignore */
    }
  }
  if (s.code) store.codeIndex.delete(s.code);
  store.sessions.delete(id);
}

export function sessionView(s: Session) {
  return {
    sessionId: s.id,
    status: s.status,
    code: s.status === "waiting" ? s.code : null,
    codeExpiresAt: s.status === "waiting" ? s.codeExpiresAt : null,
    files: s.files.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      uploadedBytes: f.uploadedBytes,
      status: f.status,
    })),
  };
}
