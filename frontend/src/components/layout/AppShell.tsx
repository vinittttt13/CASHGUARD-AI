"use client";

import { useEffect, useState, useRef } from "react";
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
  User,
  Shield,
  KeyRound,
  ChevronDown,
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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
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

  // Click outside and escape key listener for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
                ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600" : "text-slate-500", mobile && "h-5 w-5")} />
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base leading-tight">CashGuard AI</div>
            <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Cybercrime Intel</div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <nav>
            <NavLinks />
          </nav>
        </div>
        {/* User info at bottom */}
        <div className="border-t border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-slate-200">
              <AvatarFallback className="text-xs bg-blue-50 text-blue-700 font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate text-slate-800">{userEmail}</span>
              <Badge
                variant="secondary"
                className="w-fit text-[10px] px-1.5 py-0 capitalize bg-slate-100 text-slate-600"
              >
                {userRole}
              </Badge>
            </div>
          </div>
          <Button variant="outline" className="w-full gap-2 border-slate-200 hover:bg-slate-100" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 backdrop-blur px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden border-slate-200">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-white">
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

          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900">
              {navItems.find((item) => item.href === pathname)?.label || "Dashboard"}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Feed Active
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Notification Bell in header */}
            <Link
              href="/alerts"
              className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label={`Alerts${unreadAlertCount > 0 ? ` (${unreadAlertCount} unread)` : ""}`}
            >
              <Bell className="h-5 w-5" />
              {unreadAlertCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 leading-none shadow-sm">
                  {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                </span>
              )}
            </Link>

            {/* Clickable Profile Menu */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                aria-expanded={profileOpen}
                aria-haspopup="true"
                id="user-profile-menu-button"
              >
                <Avatar className="h-7 w-7 border border-slate-200">
                  <AvatarFallback className="text-[11px] bg-blue-50 text-blue-700 font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-none">{userEmail.split('@')[0]}</span>
                  <span className="text-[10px] text-slate-500 font-medium capitalize">{userRole}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Dropdown Card */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                  <div className="p-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{userEmail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 bg-blue-50 text-blue-700 border border-blue-200">
                        {userRole}
                      </Badge>
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="py-1 text-xs">
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-500" />
                      Account Settings
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                    >
                      <KeyRound className="h-4 w-4 text-slate-500" />
                      API Keys & Integrations
                    </Link>
                    <Link
                      href="/intelligence"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition-colors"
                    >
                      <Shield className="h-4 w-4 text-slate-500" />
                      Intelligence Dossier
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-medium text-xs transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

