import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";
import EarlyAccessBanner from "@/app/components/EarlyAccessBanner";
import MarketingSiteFooter from "@/app/components/MarketingSiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f1117",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://app.usechiefos.com"),
  applicationName: "ChiefOS",
  title: {
    default: "ChiefOS",
    template: "%s · ChiefOS",
  },
  description:
    "ChiefOS — an AI-native operating system for contractors and service businesses.",
  icons: {
    icon: [{ url: "/icon-192.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/icon-192.png", sizes: "1024x1024" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ChiefOS",
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
        <EarlyAccessBanner />
        <ToastProvider>
          {children}
          <MarketingSiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}