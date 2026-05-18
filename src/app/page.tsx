import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Передача файлов</h1>
      <p>Получатель показывает код, отправитель его вводит — и файлы улетают.</p>
      <ul>
        <li>
          <Link href="/send">Отправить</Link> — у вас файлы, вы вводите код получателя.
        </li>
        <li>
          <Link href="/receive">Получить</Link> — вы ждёте файлы, вам выдадут код.
        </li>
      </ul>
    </main>
  );
}
