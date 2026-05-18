import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-12">
      <header className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Передача файлов
        </h1>
        <p className="text-zinc-400">
          Получатель показывает код, отправитель его вводит — и файлы
          улетают.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/send"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="text-xs uppercase tracking-widest text-zinc-500">
            У вас файлы
          </div>
          <div className="mt-2 text-2xl font-medium">Отправить</div>
          <div className="mt-3 text-sm text-zinc-400">
            Вы введёте код получателя и выберете файлы для отправки.
          </div>
        </Link>

        <Link
          href="/receive"
          className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div className="text-xs uppercase tracking-widest text-zinc-500">
            Вы ждёте файлы
          </div>
          <div className="mt-2 text-2xl font-medium">Получить</div>
          <div className="mt-3 text-sm text-zinc-400">
            Вы получите код для отправителя и скачаете файлы, как только
            они придут.
          </div>
        </Link>
      </div>
    </div>
  );
}
