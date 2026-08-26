import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://unmumble.online"),
  title: "Unmumble — Learn to hear real English",
  description: "Connect the sounds with the words. Listen, check, repeat, and hear real English clearly.",
  other: { "codex-preview": "development" },
  openGraph: {
    title: "Unmumble — You know the words. Learn to hear them.",
    description: "Listen. Check. Repeat. Hear.",
    siteName: "Unmumble",
    url: "/",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unmumble — You know the words. Learn to hear them.",
    description: "Listen. Check. Repeat. Hear.",
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
