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
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        const showBadge = item.badge && unreadAlertCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
              mobile
                ? "mx-[-0.65rem] rounded-xl text-base"
                : "text-sm font-medium",
              isActive ? "bg-muted text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", mobile && "h-5 w-5")} />
            {item.label}
            {showBadge && (
              <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1.5 leading-none">
                {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <span>CashGuard AI</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium">
            <NavLinks />
          </nav>
        </div>
        {/* User info at bottom */}
        <div className="border-t p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{userEmail}</span>
              <Badge
                variant="secondary"
                className="w-fit text-[10px] px-1.5 py-0 capitalize"
              >
                {userRole}
              </Badge>
            </div>
          </div>
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
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-lg font-semibold mb-4"
                >
                  <ShieldAlert className="h-6 w-6 text-primary" />
                  <span>CashGuard AI</span>
                </Link>
                <NavLinks mobile />
              </nav>
              <div className="mt-auto space-y-3">
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
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
            <h1 className="text-lg font-semibold md:text-xl">
              {navItems.find((item) => item.href === pathname)?.label ||
                "Dashboard"}
            </h1>
          </div>

          {/* Notification Bell in header */}
          <Link
            href="/alerts"
            className="relative p-2 rounded-md hover:bg-muted transition-colors"
            aria-label={`Alerts${unreadAlertCount > 0 ? ` (${unreadAlertCount} unread)` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadAlertCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1 leading-none">
                {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
              </span>
            )}
          </Link>

          {/* Avatar */}
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
              {userInitials}
            </AvatarFallback>
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
