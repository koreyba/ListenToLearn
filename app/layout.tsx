import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unmumble",
  description: "Improve your English listening with real speech from YouGlish and Tatoeba.",
  other: { "codex-preview": "development" },
  openGraph: {
    title: "Unmumble",
    description: "Listen. Notice. Understand.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unmumble",
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
