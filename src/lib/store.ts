import { randomBytes } from "node:crypto";
import { kv } from "@vercel/kv";

export const CODE_TTL_S = 30;
export const SESSION_TTL_S = 60 * 60; // 1h

export type FileEntry = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: number;
};

export type SessionStatus = "waiting" | "connected";

export type Session = {
  id: string;
  code: string;
  codeExpiresAt: number;
  status: SessionStatus;
  files: FileEntry[];
  createdAt: number;
};

const sessionKey = (id: string) => `s:${id}`;
const codeKey = (code: string) => `c:${code}`;

const CODE_ALPHABET = "23456789";

export function generateCode(length = 6): string {
  let code = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function generateId(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}

async function saveSession(s: Session): Promise<void> {
  await kv.set(sessionKey(s.id), s, { ex: SESSION_TTL_S });
}

export async function createSession(): Promise<Session> {
  const id = generateId();
  let code = generateCode();
  // Try a few times to avoid collision with an active code.
  for (let i = 0; i < 5; i++) {
    const existing = await kv.get<string>(codeKey(code));
    if (!existing) break;
    code = generateCode();
  }
  const now = Date.now();
  const session: Session = {
    id,
    code,
    codeExpiresAt: now + CODE_TTL_S * 1000,
    status: "waiting",
    files: [],
    createdAt: now,
  };
  await saveSession(session);
  await kv.set(codeKey(code), id, { ex: CODE_TTL_S });
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const s = await kv.get<Session>(sessionKey(id));
  return s ?? null;
}

export async function rotateCode(session: Session): Promise<Session> {
  if (session.status !== "waiting") return session;
  if (session.code) await kv.del(codeKey(session.code));
  session.code = generateCode();
  session.codeExpiresAt = Date.now() + CODE_TTL_S * 1000;
  await saveSession(session);
  await kv.set(codeKey(session.code), session.id, { ex: CODE_TTL_S });
  return session;
}

export async function findByCode(code: string): Promise<Session | null> {
  const id = await kv.get<string>(codeKey(code));
  if (!id) return null;
  const session = await getSession(id);
  if (!session) return null;
  if (session.status !== "waiting") return null;
  if (Date.now() > session.codeExpiresAt) return null;
  return session;
}

export async function consumeCode(session: Session): Promise<void> {
  if (session.code) await kv.del(codeKey(session.code));
  session.status = "connected";
  await saveSession(session);
}

export async function touch(session: Session): Promise<void> {
  await kv.expire(sessionKey(session.id), SESSION_TTL_S);
}

export async function addFile(
  sessionId: string,
  file: FileEntry,
): Promise<Session | null> {
  const session = await getSession(sessionId);
  if (!session) return null;
  session.files.push(file);
  await saveSession(session);
  return session;
}
