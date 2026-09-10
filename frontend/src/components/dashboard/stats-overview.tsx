import React from "react";
import { Activity, AlertTriangle, Crosshair, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  delta: number;
  deltaLabel: string;
  alertLevel?: "normal" | "warning" | "critical";
}

function StatCard({ title, value, icon: Icon, delta, deltaLabel, alertLevel = "normal" }: StatCardProps) {
  const isPositive = delta >= 0;
  
  return (
    <div className={cn(
      "p-6 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col",
      alertLevel === "warning" && "border-amber-300 bg-amber-50/50",
      alertLevel === "critical" && "border-red-300 bg-red-50/50"
    )}>
      <div className="flex items-center justify-between pb-2">
        <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{title}</h3>
        <Icon className={cn(
          "w-4 h-4 text-muted-foreground",
          alertLevel === "warning" && "text-amber-500",
          alertLevel === "critical" && "text-red-500"
        )} />
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="flex items-center text-xs mt-2 text-muted-foreground">
        <span className={cn(
          "flex items-center mr-1 font-medium",
          isPositive ? "text-green-600" : "text-red-600"
        )}>
          {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {Math.abs(delta)}%
        </span>
        <span className="truncate">{deltaLabel}</span>
      </div>
    </div>
  );
}

export function StatsOverview() {
  // Static data for demonstration
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Complaints"
        value="1,248"
        icon={Activity}
        delta={12.5}
        deltaLabel="vs yesterday"
      />
      <StatCard
        title="Active Predictions"
        value="84"
        icon={Crosshair}
        delta={-4.2}
        deltaLabel="confidence > 75%"
      />
      <StatCard
        title="Active Alerts"
        value="12"
        icon={AlertTriangle}
        delta={2}
        deltaLabel="requires attention"
        alertLevel="critical" // > 10
      />
      <StatCard
        title="Model Accuracy"
        value="89.4%"
        icon={TrendingUp}
        delta={1.2}
        deltaLabel="over last 30 days"
      />
    </div>
  );
}
