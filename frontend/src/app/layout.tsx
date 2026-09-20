import type { Metadata } from "next";
import { Instrument_Serif, Public_Sans, Fragment_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Display face — wordmark, mastheads, alert titles only. Never digits.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});
// Body/UI face — the U.S. government's own typeface (USWDS). Chosen for
// what it signals (institutional, government-grade) as much as its shape.
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-sans" });
// Numbers, case IDs, timestamps, coordinates — always tabular.
const fragmentMono = Fragment_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CASHGUARD-AI — Cybercrime Predictive Analytics",
  description: "Real-time cybercrime predictive analytics and financial fraud intelligence for investigation teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runtime-injected NEXT_PUBLIC_* overrides — see lib/runtime-env.ts.
            beforeInteractive guarantees this runs before any app code. */}
        <Script src="/env-config.js" strategy="beforeInteractive" />
      </head>
      <body
        className={`${instrumentSerif.variable} ${publicSans.variable} ${fragmentMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <MotionProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
            <Toaster />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
