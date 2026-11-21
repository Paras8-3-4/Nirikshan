"use client";

import React, { useEffect } from "react";
import "./globals.css";
import OfflineBanner from "@/components/OfflineBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) =>
          console.warn("Service Worker registration skipped:", err)
        );
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <title>FieldInspect — Offline-First Field Inspections</title>
        <meta name="theme-color" content="#0f172a" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <OfflineBanner />
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}