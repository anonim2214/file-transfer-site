import Link from "next/link";
import { cookies } from "next/headers";
import { getSession, rotateCode, touch } from "@/lib/store";

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
  const session = existingId ? await getSession(existingId) : null;

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

  await touch(session);

  let current = session;
  if (current.status === "waiting" && Date.now() > current.codeExpiresAt) {
    current = await rotateCode(current);
  }

  const secondsLeft =
    current.status === "waiting"
      ? Math.max(0, Math.ceil((current.codeExpiresAt - Date.now()) / 1000))
      : 0;

  return (
    <main>
      {/* Page auto-refreshes so e-readers without JS still get updates. */}
      <meta httpEquiv="refresh" content="5" />

      <p>
        <Link href="/">← На главную</Link>
      </p>

      {current.status === "waiting" ? (
        <>
          <h1>Код для отправителя</h1>
          <p style={{ fontFamily: "monospace", fontSize: "2.5rem" }}>
            {current.code}
          </p>
          <p>
            Код обновится через {secondsLeft} с. Страница обновляется сама
            каждые 5 секунд.
          </p>
        </>
      ) : (
        <>
          <h1>Файлы</h1>
          {current.files.length === 0 ? (
            <p>Отправитель подключён. Ожидание файлов…</p>
          ) : (
            <ul>
              {current.files.map((f) => (
                <li key={f.id}>
                  <a href={f.url} download={f.name}>
                    {f.name}
                  </a>{" "}
                  ({formatBytes(f.size)})
                </li>
              ))}
            </ul>
          )}
          <p>Страница обновляется сама каждые 5 секунд.</p>
          <form action="/api/receive/reset" method="POST">
            <button type="submit">Новая сессия</button>
          </form>
        </>
      )}
    </main>
  );
}
