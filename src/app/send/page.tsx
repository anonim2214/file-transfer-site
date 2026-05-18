"use client";

import Link from "next/link";
import { useRef, useState } from "react";

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
    return (
      <main>
        <p>
          <Link href="/">← На главную</Link>
        </p>
        <h1>Введите код получателя</h1>
        <p>Получатель видит код на своём экране. Код действует 30 секунд.</p>
        <form onSubmit={submitCode}>
          <input
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
            }
            placeholder="123456"
          />{" "}
          <button
            type="submit"
            disabled={connecting || code.trim().length === 0}
          >
            {connecting ? "Подключение…" : "Подключиться"}
          </button>
        </form>
        {connectError && <p>Ошибка: {connectError}</p>}
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/">← На главную</Link>
      </p>
      <p>Соединение установлено. Добавьте файлы и нажмите «Отправить».</p>

      <p>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={uploading}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </p>

      {files.length > 0 && (
        <ul>
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

      <p>
        {files.length === 0
          ? "Файлов пока нет."
          : `${files.length} ${files.length === 1 ? "файл" : "файлов"} в очереди.`}
      </p>
      <p>
        <button
          type="button"
          onClick={startUpload}
          disabled={uploading || files.every((f) => f.status !== "pending")}
        >
          {uploading ? "Отправка…" : "Отправить"}
        </button>
      </p>
    </main>
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
    <li>
      {item.file.name} ({formatBytes(item.file.size)}){" — "}
      {item.status === "pending" && (
        <button type="button" onClick={onRemove} disabled={uploading}>
          удалить
        </button>
      )}
      {item.status === "uploading" && <span>{pct}%</span>}
      {item.status === "done" && <span>отправлено</span>}
      {item.status === "error" && <span title={item.error}>ошибка</span>}
    </li>
  );
}
