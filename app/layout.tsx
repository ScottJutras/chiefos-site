import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";
import EarlyAccessBanner from "@/app/components/EarlyAccessBanner";
import MarketingSiteFooter from "@/app/components/MarketingSiteFooter";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      <body className={`${dmSans.variable} ${spaceMono.variable} ${playfair.variable} antialiased`}>
        <EarlyAccessBanner />
        <ToastProvider>
          {children}
          <MarketingSiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}