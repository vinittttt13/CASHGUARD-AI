import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cybercrime Predictive Analytics",
  description: "AI-driven predictive analytics for cybercrime prevention and intelligence.",
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
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>{children}</ErrorBoundary>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
