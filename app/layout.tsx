import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";
import EarlyAccessTopBar from "@/app/components/EarlyAccessTopBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.usechiefos.com"),
  applicationName: "ChiefOS",
  title: {
    default: "ChiefOS",
    template: "%s · ChiefOS",
  },
  description: "ChiefOS — an AI-native operating system for contractors and service businesses.",
  icons: {
    icon: [
      { url: "/favicon.ico" }, // app/favicon.ico (recommended) or public/favicon.ico
      { url: "/icon.png", type: "image/png" }, // optional
    ],
    apple: [{ url: "/apple-touch-icon.png" }], // optional
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
  <EarlyAccessTopBar />
  <ToastProvider>{children}</ToastProvider>
</body>
    </html>
  );
}
