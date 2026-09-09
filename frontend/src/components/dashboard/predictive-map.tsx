"use client";

import dynamic from "next/dynamic";

export const PredictiveMap = dynamic(
  () => import("@/components/map/PredictiveMap").then((mod) => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading map...
      </div>
    ),
  }
);
