"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BarChart3,
  Bell,
  FileText,
  Settings,
  LogOut,
  Menu,
  ShieldAlert,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { isAuthenticated as checkAuth, clearAuth, getUserFromToken } from "@/lib/auth";
import { logoutUser } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell, badge: true },
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
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const currentUser = useAppStore((s) => s.currentUser);
  const { theme, setTheme } = useTheme();
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);
  const clearUnread = useAppStore((s) => s.clearUnread);

  useEffect(() => {
    if (!checkAuth()) {
      router.replace("/login");
      return;
    }
    setAuthorized(true);
    const user = getUserFromToken();
    if (user) {
      setCurrentUser({ email: user.email, role: user.role });
    }
  }, [router, setCurrentUser]);

  // Clear unread badge whenever user navigates to /alerts
  useEffect(() => {
    if (pathname === "/alerts") {
      clearUnread();
    }
  }, [pathname, clearUnread]);

  // Live alert feed via WebSocket
  useWebSocket();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // best-effort server-side revocation
    }
    clearAuth();
    setCurrentUser(null);
    router.replace("/login");
  };

  if (!authorized) return null;

  const userInitials = currentUser?.email
    ? currentUser.email.slice(0, 2).toUpperCase()
    : "AG";
  const userEmail = currentUser?.email ?? "Agent";
  const userRole = currentUser?.role ?? "analyst";

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        const showBadge = item.badge && unreadAlertCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all text-sm font-medium",
              mobile && "text-base py-3",
              isActive
                ? "bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/40 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500", mobile && "h-5 w-5")} />
            <span>{item.label}</span>
            {showBadge && (
              <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1.5 leading-none shadow-sm">
                {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-base leading-tight">CashGuard AI</div>
            <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Cybercrime Intel</div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <nav>
            <NavLinks />
          </nav>
        </div>
        {/* User info at bottom */}
        <div className="border-t border-slate-200 p-4 space-y-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
              <AvatarFallback className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200">{userEmail}</span>
              <Badge
                variant="secondary"
                className="w-fit text-[10px] px-1.5 py-0 capitalize bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              >
                {userRole}
              </Badge>
            </div>
          </div>
          <Button variant="outline" className="w-full gap-2 border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 backdrop-blur px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden border-slate-200">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-white dark:bg-slate-900">
              <nav className="grid gap-2 text-lg font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <ShieldAlert className="h-6 w-6 text-blue-600" />
                  <span>CashGuard AI</span>
                </Link>
                <NavLinks mobile />
              </nav>
              <div className="mt-auto space-y-3">
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-blue-50 text-blue-700 font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{userEmail}</span>
                    <Badge
                      variant="secondary"
                      className="w-fit text-[10px] px-1.5 py-0 capitalize"
                    >
                      {userRole}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="w-full flex-1">
            <h1 className="text-lg font-bold md:text-xl text-slate-900 dark:text-white">
              {navItems.find((item) => item.href === pathname)?.label ||
                "Dashboard"}
            </h1>
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Notification Bell in header */}
          <Link
            href="/alerts"
            className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            aria-label={`Alerts${unreadAlertCount > 0 ? ` (${unreadAlertCount} unread)` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadAlertCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 leading-none shadow-sm">
                {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
              </span>
            )}
          </Link>

          {/* Avatar */}
          <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
            <AvatarFallback className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

