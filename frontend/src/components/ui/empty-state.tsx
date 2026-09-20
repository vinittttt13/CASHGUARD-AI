import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * An empty screen is an invitation to act, not an apology — title states
 * what's absent in plain terms, description says what to do about it.
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-3 border border-dashed border-border px-6 py-14 text-center",
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="h-6 w-6 text-ash" strokeWidth={1.5} aria-hidden /> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
