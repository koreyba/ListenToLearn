import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Connected Speech Trainer",
  description: "An interactive trainer for understanding connected English speech with YouGlish examples.",
  other: { "codex-preview": "development" },
  openGraph: {
    title: "Connected Speech Trainer",
    description: "Listen. Notice. Understand.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Connected Speech Trainer",
    description: "Listen. Notice. Understand.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
