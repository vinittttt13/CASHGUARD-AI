"use client";

import React from "react";
import { AlertCircle, Map, FileText, ArrowUpRight, ShieldAlert } from "lucide-react";
import { cn, formatConfidence } from "@/lib/utils";
import Link from "next/link";

interface PredictionData {
  id: string;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  locations: { name: string; confidence: number }[];
  features: { name: string; value: number }[];
}

export function PredictionPanel({ data, loading }: { data?: PredictionData; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs min-h-[320px] flex flex-col gap-4 animate-pulse">
        <div className="h-5 w-1/3 bg-slate-100 rounded"></div>
        <div className="h-20 w-full bg-slate-100 rounded mt-2"></div>
        <div className="h-20 w-full bg-slate-100 rounded mt-2"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs min-h-[320px] flex items-center justify-center text-slate-500 flex-col gap-2">
        <AlertCircle className="w-8 h-8 text-slate-300" />
        <p className="text-sm font-medium">No active threat predictions selected.</p>
        <span className="text-xs text-slate-400">Select a complaint from the live feed to score.</span>
      </div>
    );
  }

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "Critical":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "High":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "Medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const getBarColor = (level: string) => {
    switch (level) {
      case "Critical":
        return "bg-rose-600";
      case "High":
        return "bg-orange-500";
      case "Medium":
        return "bg-amber-500";
      default:
        return "bg-blue-600";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">AI Threat Intelligence</h3>
              <span className="text-[10px] text-slate-400 font-medium">Model: XGBoost + Random Forest</span>
            </div>
          </div>
          <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold border", getRiskBadge(data.riskLevel))}>
            {data.riskLevel} Risk
          </span>
        </div>

        {/* Top Predicted Locations */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Predicted Cash-Out Targets
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">Confidence Score</span>
          </div>

          <div className="space-y-2.5">
            {data.locations.slice(0, 4).map((loc, i) => (
              <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{loc.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatConfidence(loc.confidence)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden mt-0.5">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", getBarColor(data.riskLevel))}
                    style={{ width: `${Math.max(loc.confidence * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Risk Drivers (SHAP) */}
      <div className="p-5 flex-1">
        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
          Key Risk Factors (SHAP Drivers)
        </h4>
        <div className="space-y-2.5">
          {data.features.slice(0, 5).map((feat, i) => {
            const hasImpact = Math.abs(feat.value) > 0.001;
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate max-w-[140px]" title={feat.name}>
                  {feat.name.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-2 w-36">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.min(Math.abs(feat.value) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] w-12 text-right font-semibold text-slate-700">
                    {hasImpact ? `+${feat.value.toFixed(2)}` : "Baseline"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            const mapEl = document.querySelector(".leaflet-container");
            mapEl?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-800 shadow-xs rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
        >
          <Map className="w-3.5 h-3.5 text-blue-600" />
          Focus on Map
        </button>
        <Link
          href="/intelligence"
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white shadow-xs rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Police Dossier
        </Link>
      </div>
    </div>
  );
}
