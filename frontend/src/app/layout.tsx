import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion-provider";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Self-hosted (not next/font/google): a build on an offline/restricted
// network must not depend on reaching fonts.googleapis.com at build time.
// See src/fonts/README.md for how these .woff2 files were sourced.

// Display face — wordmark, mastheads, alert titles only. Never digits.
const instrumentSerif = localFont({
  src: [
    { path: "../fonts/instrument-serif-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/instrument-serif-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
});
// Body/UI face — the U.S. government's own typeface (USWDS). Chosen for
// what it signals (institutional, government-grade) as much as its shape.
const publicSans = localFont({
  src: [{ path: "../fonts/public-sans-variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-sans",
});
// Numbers, case IDs, timestamps, coordinates — always tabular.
const fragmentMono = localFont({
  src: [{ path: "../fonts/fragment-mono-400.woff2", weight: "400", style: "normal" }],
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
