"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FileView = {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedBytes: number;
  status: "uploading" | "ready" | "error";
};

type SessionView = {
  sessionId: string;
  status: "waiting" | "connected" | "done";
  code: string | null;
  codeExpiresAt: number | null;
  files: FileView[];
};

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function ReceivePage() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Init session on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions", { method: "POST" })
      .then((r) => r.json())
      .then((data: SessionView) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось создать сессию");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll session state.
  useEffect(() => {
    if (!session?.sessionId) return;
    const id = session.sessionId;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
        if (!r.ok) return;
        const data: SessionView = await r.json();
        if (!cancelled) setSession(data);
      } catch {
        /* transient */
      }
    };
    const t = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [session?.sessionId]);

  // Tick `now` for the countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!session?.codeExpiresAt) return 0;
    return Math.max(0, Math.ceil((session.codeExpiresAt - now) / 1000));
  }, [session?.codeExpiresAt, now]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="text-rose-400">{error}</div>
        <Link href="/" className="text-sm text-zinc-400 underline">
          На главную
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Подготовка…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <BackLink />

      {session.status === "waiting" && (
        <WaitingForSender
          code={session.code}
          secondsLeft={secondsLeft}
        />
      )}

      {session.status !== "waiting" && (
        <ConnectedView files={session.files} sessionId={session.sessionId} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
      ← На главную
    </Link>
  );
}

function WaitingForSender({
  code,
  secondsLeft,
}: {
  code: string | null;
  secondsLeft: number;
}) {
  const ringPct = Math.min(100, Math.max(0, (secondsLeft / 30) * 100));
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-zinc-500">
          Передайте код отправителю
        </div>
        <div className="font-mono text-6xl font-semibold tracking-[0.3em] sm:text-7xl">
          {code ?? "······"}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-zinc-400">
        <div
          className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800"
          aria-hidden
        >
          <div
            className="h-full bg-emerald-500 transition-[width] duration-200"
            style={{ width: `${ringPct}%` }}
          />
        </div>
        <span>
          обновится через <span className="tabular-nums">{secondsLeft}</span> с
        </span>
      </div>

      <div className="max-w-md text-sm text-zinc-500">
        Код действует 30 секунд. Если отправитель не успел — мы автоматически
        выпустим новый.
      </div>
    </div>
  );
}

function ConnectedView({
  files,
  sessionId,
}: {
  files: FileView[];
  sessionId: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/10 px-5 py-4">
        <div className="text-sm font-medium text-emerald-300">
          Отправитель подключён
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          {files.length === 0
            ? "Ожидаем файлы…"
            : "Файлы приходят. Скачивайте, как только они станут готовы."}
        </div>
      </div>

      {files.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-500">
            <div className="h-3 w-3 animate-pulse rounded-full bg-zinc-500" />
            Ожидание файлов
          </div>
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-3">
          {files.map((f) => (
            <FileRow key={f.id} file={f} sessionId={sessionId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({
  file,
  sessionId,
}: {
  file: FileView;
  sessionId: string;
}) {
  const pct =
    file.size > 0
      ? Math.min(100, (file.uploadedBytes / file.size) * 100)
      : file.status === "ready"
        ? 100
        : 0;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate font-medium">{file.name}</div>
          <div className="text-xs text-zinc-500">
            {formatBytes(file.uploadedBytes)}
            {file.size ? ` / ${formatBytes(file.size)}` : ""}
          </div>
        </div>
        {file.status === "ready" && (
          <a
            href={`/api/sessions/${sessionId}/files/${file.id}`}
            download={file.name}
            className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Скачать
          </a>
        )}
        {file.status === "uploading" && (
          <span className="shrink-0 text-xs text-zinc-400">
            {pct.toFixed(0)}%
          </span>
        )}
        {file.status === "error" && (
          <span className="shrink-0 text-xs text-rose-400">ошибка</span>
        )}
      </div>
      {file.status !== "ready" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-[width] duration-200 ${
              file.status === "error" ? "bg-rose-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </li>
  );
}
