import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ResetStorageOnLoad from "@/components/reset-storage-on-load";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bunnecho",
  description: "Bunnecho",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <ResetStorageOnLoad />
        {children}
      </body>
    </html>
  );
}
