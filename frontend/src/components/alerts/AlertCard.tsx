"use client";

import React from "react";
import { AlertOctagon, AlertTriangle, Info, MapPin, Clock, CheckCircle2, Map } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

interface AlertCardProps {
  alert: {
    id: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    type: string;
    title: string;
    description: string;
    location: string;
    timestamp: string;
    acknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: string;
  };
  onAcknowledge: () => void;
}

export function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const getPriorityStyles = () => {
    switch (alert.priority) {
      case "Critical": return "border-red-500 bg-red-50/50";
      case "High": return "border-orange-500 bg-orange-50/50";
      case "Medium": return "border-amber-400 bg-amber-50/50";
      case "Low": return "border-blue-400 bg-blue-50/50";
      default: return "border-gray-200 bg-card";
    }
  };

  const getPriorityIcon = () => {
    switch (alert.priority) {
      case "Critical": return <AlertOctagon className="w-5 h-5 text-red-600" />;
      case "High": return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case "Medium": return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "Low": return <Info className="w-5 h-5 text-blue-600" />;
      default: return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBadgeStyle = () => {
    switch (alert.priority) {
      case "Critical": return "bg-red-100 text-red-800";
      case "High": return "bg-orange-100 text-orange-800";
      case "Medium": return "bg-amber-100 text-amber-800";
      case "Low": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className={cn("rounded-lg border-l-4 shadow-sm p-4 bg-card", getPriorityStyles())}>
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5">{getPriorityIcon()}</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{alert.title}</h3>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", getBadgeStyle())}>
                {alert.priority}
              </span>
            </div>
            
            <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
            
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {alert.location}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatRelativeTime(alert.timestamp)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t flex items-center justify-between">
        <button className="text-sm text-primary hover:underline font-medium flex items-center gap-1.5">
          <Map className="w-4 h-4" />
          View on Map
        </button>

        {alert.acknowledged ? (
          <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-100">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">Acknowledged</span>
          </div>
        ) : (
          <button 
            onClick={onAcknowledge}
            className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 transition-colors"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
