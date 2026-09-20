"use client";

import { MotionConfig } from "motion/react";

/**
 * Global motion policy: reducedMotion="user" makes every animation in the
 * app (durations, transforms, opacity) collapse to instant/static when the
 * visitor has prefers-reduced-motion set, without needing to check it in
 * every individual component.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
