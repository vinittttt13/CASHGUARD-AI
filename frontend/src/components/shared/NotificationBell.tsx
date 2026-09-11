"use client";

import { Bell } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const unread = useAppStore((s) => s.unreadAlertCount);
  const clearUnread = useAppStore((s) => s.clearUnread);

  return (
    <button
      onClick={clearUnread}
      className={cn('relative p-1 rounded-md hover:bg-muted transition-colors', className)}
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

