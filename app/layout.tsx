import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тренажёр связной английской речи",
  description: "Интерактивный тренажёр восприятия связной английской речи с примерами YouGlish.",
  openGraph: {
    title: "Тренажёр связной английской речи",
    description: "Слушай. Разбирай. Понимай.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Тренажёр связной английской речи",
    description: "Слушай. Разбирай. Понимай.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
