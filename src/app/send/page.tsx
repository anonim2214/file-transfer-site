"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type FileItem = {
  key: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function uploadFile(
  sessionId: string,
  file: File,
  onProgress: (p: number) => void,
): { promise: Promise<void>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    const params = new URLSearchParams({
      name: file.name,
      size: String(file.size),
      type: file.type || "application/octet-stream",
    });
    xhr.open("POST", `/api/sessions/${sessionId}/upload?${params}`);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        let msg = "upload failed";
        try {
          msg = JSON.parse(xhr.responseText)?.error || msg;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("network error"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}

export default function SendPage() {
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setConnectError(null);
    const trimmed = code.trim();
    if (!trimmed) return;
    setConnecting(true);
    try {
      const r = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Неверный код");
      }
      const data = await r.json();
      setSessionId(data.sessionId);
    } catch (err) {
      setConnectError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    const next: FileItem[] = Array.from(picked).map((f, i) => ({
      key: `${Date.now()}-${i}-${f.name}`,
      file: f,
      progress: 0,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }

  async function startUpload() {
    if (!sessionId || uploading) return;
    setUploading(true);
    const queue = files.filter((f) => f.status === "pending");
    for (const item of queue) {
      setFiles((prev) =>
        prev.map((f) =>
          f.key === item.key ? { ...f, status: "uploading" } : f,
        ),
      );
      try {
        const { promise } = uploadFile(sessionId, item.file, (p) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.key === item.key ? { ...f, progress: p } : f,
            ),
          );
        });
        await promise;
        setFiles((prev) =>
          prev.map((f) =>
            f.key === item.key
              ? { ...f, status: "done", progress: 1 }
              : f,
          ),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.key === item.key
              ? {
                  ...f,
                  status: "error",
                  error: (err as Error).message,
                }
              : f,
          ),
        );
      }
    }
    setUploading(false);
  }

  if (!sessionId) {
    return <CodeForm
      code={code}
      setCode={setCode}
      connecting={connecting}
      connectError={connectError}
      onSubmit={submitCode}
    />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← На главную
      </Link>

      <div className="rounded-2xl border border-emerald-900/50 bg-emerald-900/10 px-5 py-4">
        <div className="text-sm font-medium text-emerald-300">
          Соединение установлено
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          Добавьте файлы и нажмите «Отправить».
        </div>
      </div>

      <FilePicker
        inputRef={inputRef}
        onPick={addFiles}
        disabled={uploading}
      />

      {files.length > 0 && (
        <ul className="space-y-3">
          {files.map((f) => (
            <SendFileRow
              key={f.key}
              item={f}
              onRemove={() => removeFile(f.key)}
              uploading={uploading}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {files.length === 0
            ? "Файлов пока нет"
            : `${files.length} ${files.length === 1 ? "файл" : "файлов"} в очереди`}
        </div>
        <button
          type="button"
          onClick={startUpload}
          disabled={
            uploading || files.every((f) => f.status !== "pending")
          }
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {uploading ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}

function CodeForm({
  code,
  setCode,
  connecting,
  connectError,
  onSubmit,
}: {
  code: string;
  setCode: (v: string) => void;
  connecting: boolean;
  connectError: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← На главную
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Введите код получателя</h1>
          <p className="text-sm text-zinc-400">
            Получатель видит код на своём экране. Код действует 30 секунд.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <input
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
            }
            placeholder="123456"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-center font-mono text-3xl tracking-[0.4em] outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={connecting || code.trim().length === 0}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {connecting ? "Подключение…" : "Подключиться"}
          </button>
          {connectError && (
            <div className="text-center text-sm text-rose-400">
              {connectError}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function FilePicker({
  inputRef,
  onPick,
  disabled,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (files: FileList | null) => void;
  disabled: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        onPick(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        dragOver
          ? "border-emerald-500 bg-emerald-500/5"
          : "border-zinc-800 hover:border-zinc-700"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="text-sm font-medium">
        Перетащите файлы сюда
      </div>
      <div className="text-xs text-zinc-500">или нажмите, чтобы выбрать</div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function SendFileRow({
  item,
  onRemove,
  uploading,
}: {
  item: FileItem;
  onRemove: () => void;
  uploading: boolean;
}) {
  const pct = Math.round(item.progress * 100);
  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate font-medium">{item.file.name}</div>
          <div className="text-xs text-zinc-500">
            {formatBytes(item.file.size)}
          </div>
        </div>
        <div className="shrink-0 text-xs">
          {item.status === "pending" && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
            >
              удалить
            </button>
          )}
          {item.status === "uploading" && (
            <span className="tabular-nums text-zinc-400">{pct}%</span>
          )}
          {item.status === "done" && (
            <span className="text-emerald-400">отправлено</span>
          )}
          {item.status === "error" && (
            <span className="text-rose-400" title={item.error}>
              ошибка
            </span>
          )}
        </div>
      </div>
      {(item.status === "uploading" || item.status === "done") && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </li>
  );
}
