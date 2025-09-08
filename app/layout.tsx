import type { Metadata } from "next";
import "./globals.css";
import ClientInit from "@/components/system/ClientInit";
import ToastProvider from "@/components/system/ToastProvider";
import AddToHomePrompt from "@/components/system/AddToHomePrompt";

export const metadata: Metadata = {
  title: "Dead Internet Theory",
  description: "Cyberpunk music streaming and social wall",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#39FF14" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Dead Internet Theory" />
        <link rel="apple-touch-icon" href="/images/IMG_8051.PNG" />
      </head>
      <body className="antialiased min-h-dvh bg-deep-charcoal text-bright-white">
        <ToastProvider>
          <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
          <ClientInit />
          <AddToHomePrompt />
        </ToastProvider>
      </body>
    </html>
  );
}
