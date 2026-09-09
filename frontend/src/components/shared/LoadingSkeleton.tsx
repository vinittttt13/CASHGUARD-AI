import React from "react";
import { cn } from "@/lib/utils";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}>
      <div className="flex flex-col space-y-1.5 p-6">
        <div className="h-5 w-1/3 animate-pulse rounded bg-muted"></div>
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted mt-2"></div>
      </div>
      <div className="p-6 pt-0">
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted"></div>
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted"></div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full rounded-md border">
      <div className="h-10 border-b bg-muted/50 flex items-center px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`head-${i}`} className="h-4 w-20 animate-pulse rounded bg-muted mr-4"></div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="h-12 border-b flex items-center px-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className="h-4 w-24 animate-pulse rounded bg-muted mr-4"></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("h-[500px] w-full rounded-xl bg-muted animate-pulse flex items-center justify-center", className)}>
      <svg className="w-12 h-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("h-[300px] w-full rounded-xl border p-4 flex flex-col justify-end space-y-1 bg-card shadow-sm", className)}>
      <div className="w-full h-full flex items-end space-x-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="w-full bg-muted animate-pulse rounded-t-sm"
            style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
}
