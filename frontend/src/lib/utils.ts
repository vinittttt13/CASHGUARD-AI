import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeTime(date: string | Date) {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const timeMs = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const deltaDays = Math.round((timeMs - Date.now()) / (1000 * 3600 * 24));
  const deltaHours = Math.round((timeMs - Date.now()) / (1000 * 3600));
  const deltaMinutes = Math.round((timeMs - Date.now()) / (1000 * 60));

  if (Math.abs(deltaDays) > 0) return rtf.format(deltaDays, "day");
  if (Math.abs(deltaHours) > 0) return rtf.format(deltaHours, "hour");
  return rtf.format(deltaMinutes, "minute");
}

export function formatDate(date: string | Date, formatStr: string = "dd MMM yyyy") {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getRiskColor(riskLevel: string) {
  switch (riskLevel?.toLowerCase()) {
    case "critical": return "text-red-700 bg-red-100 border-red-200";
    case "high": return "text-orange-700 bg-orange-100 border-orange-200";
    case "medium": return "text-amber-700 bg-amber-100 border-amber-200";
    case "low": return "text-green-700 bg-green-100 border-green-200";
    default: return "text-gray-700 bg-gray-100 border-gray-200";
  }
}

export function getPriorityColor(priority: string) {
  switch (priority?.toLowerCase()) {
    case "critical": return "text-red-600 bg-red-50";
    case "high": return "text-orange-600 bg-orange-50";
    case "medium": return "text-amber-600 bg-amber-50";
    case "low": return "text-blue-600 bg-blue-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

export function truncate(str: string, length: number) {
  if (!str) return "";
  return str.length > length ? str.substring(0, length) + "..." : str;
}

export function formatConfidence(score: number) {
  return `${(score * 100).toFixed(1)}%`;
}

export function getStatusBadgeVariant(status: string) {
  switch (status?.toLowerCase()) {
    case "open": return "destructive";
    case "in_progress": return "warning";
    case "resolved": return "success";
    default: return "default";
  }
}
