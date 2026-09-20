"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Timer, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";

const GOLDEN_HOUR_MINUTES = 60;

function format(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * A live countdown from the incident timestamp to the 60-minute "golden
 * hour" — the window banks/NPCI cash-out interception is realistically
 * possible in. Urgency state changes as it runs down: calm past 30 min
 * left, amber under 10, flare and pulsing under 2, then a closed state
 * once the window has passed (not hidden — a closed window is itself
 * information: this case now needs a different, slower track).
 */
export function GoldenHourCountdown({ incidentTimestamp, className }: { incidentTimestamp: string; className?: string }) {
  const deadline = React.useMemo(
    () => new Date(incidentTimestamp).getTime() + GOLDEN_HOUR_MINUTES * 60 * 1000,
    [incidentTimestamp]
  );
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const remaining = deadline - now;
  const closed = remaining <= 0;
  const minutesLeft = remaining / 60000;

  const tone = closed
    ? { text: "text-ash", border: "border-ash/30", bg: "bg-surface-overlay" }
    : minutesLeft <= 2
      ? { text: "text-flare", border: "border-flare/40", bg: "bg-flare/10" }
      : minutesLeft <= 10
        ? { text: "text-risk-review", border: "border-risk-review/40", bg: "bg-risk-review/10" }
        : { text: "text-verified", border: "border-verified/40", bg: "bg-verified/10" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        tone.text,
        tone.border,
        tone.bg,
        className
      )}
      title={closed ? "Golden hour window has closed" : "Time remaining in the golden-hour intercept window"}
    >
      {closed ? (
        <>
          <TimerOff className="h-3 w-3" aria-hidden="true" />
          Window closed
        </>
      ) : (
        <>
          <motion.span
            animate={minutesLeft <= 2 ? { opacity: [1, 0.4, 1] } : undefined}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-1.5"
          >
            <Timer className="h-3 w-3" aria-hidden="true" />
            {format(remaining)}
          </motion.span>
        </>
      )}
    </span>
  );
}
