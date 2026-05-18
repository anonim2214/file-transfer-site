import Link from "next/link";
import { cookies } from "next/headers";
import {
  rotateCode,
  store,
  touch,
  type Session,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "ftrx_session";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default async function ReceivePage() {
  const jar = await cookies();
  const existingId = jar.get(COOKIE)?.value;
  const session: Session | undefined = existingId
    ? store.sessions.get(existingId)
    : undefined;

  if (!session) {
    return (
      <main>
        <meta httpEquiv="refresh" content="0;url=/api/receive/init" />
        <p>Получение кода…</p>
        <p>
          Если страница не открылась сама,{" "}
          <a href="/api/receive/init">нажмите тут</a>.
        </p>
      </main>
    );
  }

  touch(session);

  if (session.status === "waiting" && Date.now() > session.codeExpiresAt) {
    rotateCode(session);
  }

  const secondsLeft =
    session.status === "waiting"
      ? Math.max(0, Math.ceil((session.codeExpiresAt - Date.now()) / 1000))
      : 0;

  return (
    <main>
      {/* Page auto-refreshes so e-readers without JS still get updates. */}
      <meta httpEquiv="refresh" content="5" />

      <p>
        <Link href="/">← На главную</Link>
      </p>

      {session.status === "waiting" ? (
        <>
          <h1>Код для отправителя</h1>
          <p style={{ fontFamily: "monospace", fontSize: "2.5rem" }}>
            {session.code}
          </p>
          <p>
            Код обновится через {secondsLeft} с. Страница обновляется сама
            каждые 5 секунд.
          </p>
        </>
      ) : (
        <>
          <h1>Файлы</h1>
          {session.files.length === 0 ? (
            <p>Отправитель подключён. Ожидание файлов…</p>
          ) : (
            <ul>
              {session.files.map((f) => (
                <li key={f.id}>
                  {f.status === "ready" ? (
                    <a
                      href={`/api/sessions/${session.id}/files/${f.id}`}
                      download={f.name}
                    >
                      {f.name}
                    </a>
                  ) : (
                    <span>{f.name}</span>
                  )}{" "}
                  ({formatBytes(f.uploadedBytes)}
                  {f.size ? ` / ${formatBytes(f.size)}` : ""}){" — "}
                  {f.status === "ready" && "готов"}
                  {f.status === "uploading" && "загружается"}
                  {f.status === "error" && "ошибка"}
                </li>
              ))}
            </ul>
          )}
          <p>Страница обновляется сама каждые 5 секунд.</p>
        </>
      )}
    </main>
  );
}
