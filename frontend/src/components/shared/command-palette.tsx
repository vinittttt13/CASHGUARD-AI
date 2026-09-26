"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Bell,
  BarChart3,
  FileSearch,
  Settings,
  Search,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
}

export function CommandPalette({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const commands = React.useMemo<Command[]>(
    () => [
      { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, run: () => router.push("/dashboard") },
      { id: "alerts", label: "Go to Alerts", icon: Bell, run: () => router.push("/alerts") },
      { id: "analytics", label: "Go to Analytics", icon: BarChart3, run: () => router.push("/analytics") },
      { id: "intelligence", label: "Go to Threat Intelligence", icon: FileSearch, run: () => router.push("/intelligence") },
      { id: "settings", label: "Go to Settings", icon: Settings, run: () => router.push("/settings") },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      { id: "logout", label: "Sign out", icon: LogOut, run: onLogout },
    ],
    [router, resolvedTheme, setTheme, onLogout]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  React.useEffect(() => setActiveIndex(0), [query, open]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const runAndClose = (cmd: Command) => {
    setOpen(false);
    setQuery("");
    cmd.run();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-background/70 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[18%] z-[200] w-full max-w-lg -translate-x-1/2 border border-border bg-surface-raised shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && filtered[activeIndex]) {
                  e.preventDefault();
                  runAndClose(filtered[activeIndex]);
                }
              }}
              placeholder="Jump to a page or run a command…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="label-caps rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Esc
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin">
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matching commands.</p>
            )}
            {filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => runAndClose(cmd)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors",
                    i === activeIndex ? "bg-surface-overlay text-foreground" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {cmd.label}
                </button>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
