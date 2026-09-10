"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  BarChart3, 
  Bell, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { isAuthenticated as checkAuth, clearAuth } from "@/lib/auth";
import { logoutUser } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/intelligence", label: "Intelligence", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!checkAuth()) {
      router.replace("/login");
      return;
    }
    setAuthorized(true);
  }, [router]);

  // Live alert feed — the purpose-built hook targets NEXT_PUBLIC_WS_URL +
  // /api/v1/ws/live-feed?token=<jwt> and no-ops until a token exists.
  useWebSocket();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // best-effort server-side revocation; proceed regardless
    }
    clearAuth();
    router.replace("/login");
  };

  if (!authorized) return null;

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <span className="">Predictive Analytics</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary ${
                    pathname === item.href ? "bg-muted text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px]">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col">
              <nav className="grid gap-2 text-lg font-medium">
                <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <ShieldAlert className="h-6 w-6 text-primary" />
                  <span>Analytics Portal</span>
                </Link>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 hover:text-foreground ${
                        pathname === item.href ? "bg-muted text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto">
                <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="w-full flex-1">
            <h1 className="text-lg font-semibold md:text-xl">
              {navItems.find((item) => item.href === pathname)?.label || "Dashboard"}
            </h1>
          </div>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>AG</AvatarFallback>
          </Avatar>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
