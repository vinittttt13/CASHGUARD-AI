"use client";

import React from "react";
import { AlertCircle, Map, FileText, ArrowRight } from "lucide-react";
import { cn, formatConfidence } from "@/lib/utils";

interface PredictionData {
  id: string;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  locations: { name: string; confidence: number }[];
  features: { name: string; value: number }[];
}

export function PredictionPanel({ data, loading }: { data?: PredictionData; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm min-h-[300px] flex flex-col gap-4 animate-pulse">
        <div className="h-6 w-1/3 bg-muted rounded"></div>
        <div className="h-24 w-full bg-muted rounded mt-2"></div>
        <div className="h-24 w-full bg-muted rounded mt-2"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm min-h-[300px] flex items-center justify-center text-muted-foreground flex-col gap-2">
        <AlertCircle className="w-8 h-8 opacity-50" />
        <p>No active predictions selected.</p>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch(level) {
      case "Critical": return "bg-red-500";
      case "High": return "bg-orange-500";
      case "Medium": return "bg-amber-500";
      default: return "bg-green-500";
    }
  };

  const getRiskBadge = (level: string) => {
    switch(level) {
      case "Critical": return "bg-red-100 text-red-800 border-red-200";
      case "High": return "bg-orange-100 text-orange-800 border-orange-200";
      case "Medium": return "bg-amber-100 text-amber-800 border-amber-200";
      default: return "bg-green-100 text-green-800 border-green-200";
    }
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col h-full">
      <div className="p-6 border-b pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Latest Intelligence</h3>
          <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border", getRiskBadge(data.riskLevel))}>
            {data.riskLevel} Risk
          </span>
        </div>
        
        <div className="space-y-4 mt-2">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Top Predicted Locations</h4>
          <div className="space-y-3">
            {data.locations.map((loc, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{loc.name}</span>
                  <span className="font-bold">{formatConfidence(loc.confidence)}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000", getRiskColor(data.riskLevel))}
                    style={{ width: `${loc.confidence * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pt-4 flex-1">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Key Risk Factors (SHAP)</h4>
        <div className="space-y-3">
          {data.features.map((feat, i) => (
            <div key={i} className="flex items-center text-sm">
              <span className="w-1/2 truncate text-muted-foreground pr-2" title={feat.name}>
                {feat.name.replace(/_/g, ' ')}
              </span>
              <div className="w-1/2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${feat.value * 100}%` }}
                  />
                </div>
                <span className="text-xs w-8 text-right font-medium">+{feat.value.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t bg-muted/20 grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white border shadow-sm rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
          <Map className="w-4 h-4" />
          View on Map
        </button>
        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground shadow-sm rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <FileText className="w-4 h-4" />
          Generate Report
        </button>
      </div>
    </div>
  );
}
