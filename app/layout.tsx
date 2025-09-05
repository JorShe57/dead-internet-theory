import type { Metadata } from "next";
import "./globals.css";
import ClientInit from "@/components/system/ClientInit";
import ToastProvider from "@/components/system/ToastProvider";

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
      <body className="antialiased min-h-dvh bg-deep-charcoal text-bright-white">
        <ToastProvider>
          <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
          <ClientInit />
        </ToastProvider>
      </body>
    </html>
  );
}
