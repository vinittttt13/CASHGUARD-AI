"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";

interface RiskScoreCardProps {
  score: number; // 0 to 100
  previousScore: number;
  jurisdiction: string;
}

export function RiskScoreCard({ score, previousScore, jurisdiction }: RiskScoreCardProps) {
  const delta = score - previousScore;
  const isWorse = delta > 0;
  
  // Calculate SVG arc
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getRiskColor = (s: number) => {
    if (s > 75) return "#dc2626"; // red-600
    if (s > 40) return "#f59e0b"; // amber-500
    return "#16a34a"; // green-600
  };

  const getRiskLabel = (s: number) => {
    if (s > 75) return "Critical Risk";
    if (s > 40) return "Medium Risk";
    return "Low Risk";
  };

  const getRiskTextColor = (s: number) => {
    if (s > 75) return "text-red-600";
    if (s > 40) return "text-amber-600";
    return "text-green-600";
  };

  const color = getRiskColor(score);

  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="w-full flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Jurisdiction Risk
        </h3>
        <span className="text-xs font-medium bg-muted px-2 py-1 rounded-md">{jurisdiction}</span>
      </div>

      <div className="relative w-40 h-40 flex items-center justify-center mt-4">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke="currentColor"
            strokeWidth="12"
            fill="transparent"
            className="text-muted opacity-20"
          />
          {/* Progress Circle */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke={color}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-bold tracking-tighter" style={{ color }}>
            {score}
          </span>
          <span className={cn("text-xs font-bold uppercase tracking-wider mt-1", getRiskTextColor(score))}>
            {getRiskLabel(score)}
          </span>
        </div>
      </div>

      <div className="mt-6 text-sm flex items-center bg-muted/50 px-3 py-1.5 rounded-full">
        <span className="text-muted-foreground mr-2">vs yesterday</span>
        <span className={cn("flex items-center font-semibold", isWorse ? "text-red-600" : "text-green-600")}>
          {isWorse ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
          {Math.abs(delta)} pts
        </span>
      </div>
    </div>
  );
}
