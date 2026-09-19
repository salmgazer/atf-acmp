import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: {
    default: "ATF AI Challenge",
    template: "%s | ATF AI Challenge",
  },
  description:
    "ATF AI-Challenge Management Platform - The continent's largest hands-on Artificial Intelligence program",
  keywords: ["ATF", "AI Challenge", "Africa", "Innovation", "Technology"],
  authors: [{ name: "African Technology Forum" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ATF AI Challenge",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F70035",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const oneSignalAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {oneSignalAppId && (
          <>
            <Script
              src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
              strategy="afterInteractive"
            />
            <Script id="onesignal-init" strategy="afterInteractive">
              {`
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                OneSignalDeferred.push(async function(OneSignal) {
                  try {
                    await OneSignal.init({
                      appId: "${oneSignalAppId}",
                      allowLocalhostAsSecureOrigin: ${process.env.NODE_ENV === "development"},
                    });
                  } catch (error) {
                    console.debug("OneSignal initialization failed (this is normal if using an ad blocker):", error.message);
                  }
                });
              `}
            </Script>
          </>
        )}
      </head>
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
