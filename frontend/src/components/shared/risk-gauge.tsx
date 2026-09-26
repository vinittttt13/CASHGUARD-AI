"use client";

import * as React from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { cn } from "@/lib/utils";

interface RiskGaugeProps {
  /** 0-1 probability, or 0-100 — auto-detected. */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

/**
 * Custom SVG dial that sweeps to the score with easing and color-shifts
 * at the same 0.50 / 0.85 thresholds the tiered auto-lien/review/log-only
 * decision system uses — this isn't a decorative gauge, its color bands
 * are the actual decision boundaries.
 */
export function RiskGauge({ value, size = 128, strokeWidth = 10, label, className }: RiskGaugeProps) {
  const target = value <= 1 ? value * 100 : value;
  const prevTarget = React.useRef(target);
  const [display, setDisplay] = React.useState(0);
  const [pulse, setPulse] = React.useState(false);
  const mv = useMotionValue(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const tone =
    target >= 85 ? "hsl(var(--flare))" : target >= 50 ? "hsl(var(--risk-review))" : "hsl(var(--verified))";
  const toneClass = target >= 85 ? "text-flare" : target >= 50 ? "text-risk-review" : "text-verified";

  React.useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      mv.set(target);
      setDisplay(target);
      return;
    }
    const changed = Math.abs(prevTarget.current - target) > 0.5;
    prevTarget.current = target;
    const controls = animate(mv, target, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    if (changed) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 500);
      return () => {
        controls.stop();
        clearTimeout(t);
      };
    }
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const offset = useTransform(mv, (v) => circumference * (1 - v / 100));

  return (
    <div className={cn("relative inline-flex flex-col items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Risk score ${target.toFixed(0)} of 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--hairline))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
          animate={pulse ? { scale: [1, 1.03, 1] } : undefined}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", toneClass)}>
          {display.toFixed(0)}
        </span>
        {label ? <span className="label-caps text-[10px] text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}
