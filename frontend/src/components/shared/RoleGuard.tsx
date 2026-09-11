"use client";

import { useAppStore } from '@/store/useAppStore';

interface RoleGuardProps {
  allow: 'admin' | 'analyst';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only when the current user has at least the required role.
 * Role hierarchy: admin > analyst.
 */
export function RoleGuard({ allow, children, fallback = null }: RoleGuardProps) {
  const user = useAppStore((s) => s.currentUser);

  if (!user) return null;
  if (allow === 'admin' && user.role !== 'admin') return <>{fallback}</>;

  return <>{children}</>;
}

