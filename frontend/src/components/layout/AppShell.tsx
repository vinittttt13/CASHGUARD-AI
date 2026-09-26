"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BarChart3,
  Bell,
  FileSearch,
  Settings,
  LogOut,
  Menu,
  ShieldHalf,
  User,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { StatusIndicator } from "@/components/shared/intel-primitives";
import { CommandPalette } from "@/components/shared/command-palette";
import { isAuthenticated as checkAuth, clearAuth, getUserFromToken } from "@/lib/auth";
import { logoutUser } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; badge?: boolean };
type NavSection = { label: string; items: NavItem[] };

const navSections: NavSection[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Investigate", items: [{ href: "/alerts", label: "Alerts", icon: Bell, badge: true }] },
  {
    label: "Intelligence",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/intelligence", label: "Threat Intelligence", icon: FileSearch },
    ],
  },
  { label: "System", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

const allNavItems = navSections.flatMap((s) => s.items);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const currentUser = useAppStore((s) => s.currentUser);
  const unreadAlertCount = useAppStore((s) => s.unreadAlertCount);
  const clearUnread = useAppStore((s) => s.clearUnread);
  const socketConnected = useAppStore((s) => s.socketConnected);
  const socketReconnecting = useAppStore((s) => s.socketReconnecting);

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

  const userInitials = currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : "AG";
  const userEmail = currentUser?.email ?? "Agent";
  const userRole = currentUser?.role ?? "analyst";
  const currentLabel = allNavItems.find((item) => item.href === pathname)?.label || "Dashboard";

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="space-y-4">
      {navSections.map((section) => (
        <div key={section.label}>
          {!collapsed && (
            <div className="mb-1.5 px-3 text-[10px] font-semibold label-caps text-subtle-foreground">
              {section.label}
            </div>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const showBadge = item.badge && unreadAlertCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed && !mobile ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    mobile && "py-2.5 text-base",
                    collapsed && !mobile && "justify-center px-0",
                    isActive
                      ? "bg-surface-raised text-foreground"
                      : "text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-subtle-foreground")} />
                  {(!collapsed || mobile) && <span className="truncate font-medium">{item.label}</span>}
                  {showBadge && (
                    <span
                      className={cn(
                        "flex h-4 min-w-[16px] items-center justify-center rounded-full bg-risk-critical px-1 font-mono text-[9px] font-semibold text-white",
                        collapsed && !mobile ? "absolute -right-0.5 -top-0.5" : "ml-auto"
                      )}
                    >
                      {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen text-foreground">
      <CommandPalette onLogout={handleLogout} />
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden flex-col border-r border-border bg-surface transition-[width] duration-150 md:flex",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <div className={cn("flex h-14 items-center gap-2.5 border-b border-border px-4", collapsed && "justify-center px-0")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ShieldHalf className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-foreground">
                CASHGUARD <span className="text-primary">AI</span>
              </div>
              <div className="truncate text-[9px] font-medium label-caps text-subtle-foreground">
                Financial Cyber Intelligence
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-auto p-3">
          <NavLinks />
        </nav>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-subtle-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        <div className={cn("border-t border-border p-3", collapsed && "flex flex-col items-center")}>
          {collapsed ? (
            <Avatar className="h-8 w-8 border border-border" title={userEmail}>
              <AvatarFallback className="bg-surface-overlay text-[11px] font-semibold text-primary">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-surface-overlay text-[11px] font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-foreground">{userEmail}</span>
                <span className="text-[10px] label-caps text-subtle-foreground">{userRole}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="ml-auto rounded-md p-1.5 text-subtle-foreground transition-colors hover:bg-surface-raised hover:text-risk-critical"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-surface px-4 md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 border-border bg-surface-raised md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col border-border bg-surface">
              <nav className="grid gap-2">
                <Link href="/dashboard" className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
                  <ShieldHalf className="h-5 w-5 text-primary" />
                  <span>
                    CASHGUARD <span className="text-primary">AI</span>
                  </span>
                </Link>
                <NavLinks mobile />
              </nav>
              <div className="mt-auto space-y-3 pt-4">
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarFallback className="bg-surface-overlay text-[11px] font-semibold text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{userEmail}</span>
                    <span className="text-[10px] label-caps text-subtle-foreground">{userRole}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full gap-2 border-border" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">{currentLabel}</h1>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
              }
              className="hidden items-center gap-2 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              <span>Search…</span>
              <kbd className="label-caps rounded border border-border px-1 text-[10px]">⌘K</kbd>
            </button>
            {/* System status cluster */}
            <div className="hidden items-center gap-3 rounded-md border border-border bg-surface-raised px-3 py-1.5 lg:flex">
              <StatusIndicator state="online" label="API Operational" />
              <span className="h-3 w-px bg-border" aria-hidden="true" />
              <StatusIndicator
                state={socketConnected ? "online" : socketReconnecting ? "reconnecting" : "offline"}
                label={socketConnected ? "Live feed connected" : socketReconnecting ? "Reconnecting…" : "Live feed offline"}
              />
            </div>

            {/* Notification Bell */}
            <Link
              href="/alerts"
              className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
              aria-label={`Alerts${unreadAlertCount > 0 ? ` (${unreadAlertCount} unread)` : ""}`}
            >
              <Bell className="h-4 w-4" />
              {unreadAlertCount > 0 && (
                <span className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-risk-critical px-1 font-mono text-[9px] font-semibold text-white">
                  {unreadAlertCount > 99 ? "99+" : unreadAlertCount}
                </span>
              )}
            </Link>

            {/* Profile Menu */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-1.5 py-1.5 transition-colors hover:bg-surface-overlay focus:outline-none focus:ring-2 focus:ring-ring/40"
                aria-expanded={profileOpen}
                aria-haspopup="true"
                id="user-profile-menu-button"
              >
                <Avatar className="h-6 w-6 border border-border">
                  <AvatarFallback className="bg-surface-overlay text-[10px] font-semibold text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col text-left md:flex">
                  <span className="text-xs font-medium leading-none text-foreground">{userEmail.split("@")[0]}</span>
                </div>
                <ChevronDown className="h-3 w-3 text-subtle-foreground" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 z-50 mt-2 w-60 rounded-md border border-border bg-surface-raised p-1.5 shadow-lg">
                  <div className="mb-1 border-b border-border p-2">
                    <p className="truncate text-xs font-medium text-foreground">{userEmail}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium label-caps text-muted-foreground">
                        {userRole}
                      </span>
                      <StatusIndicator state="online" label="Active" />
                    </div>
                  </div>

                  <div className="py-1 text-xs">
                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-surface-overlay hover:text-foreground"
                    >
                      <User className="h-3.5 w-3.5" />
                      Account Settings
                    </Link>
                    <Link
                      href="/intelligence"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-surface-overlay hover:text-foreground"
                    >
                      <Radar className="h-3.5 w-3.5" />
                      Intelligence Briefing
                    </Link>
                  </div>

                  <div className="mt-1 border-t border-border pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-risk-critical transition-colors hover:bg-risk-critical/10"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
