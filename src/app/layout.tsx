import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "File Transfer",
  description: "Передавайте файлы между устройствами по коду",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8 sm:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
