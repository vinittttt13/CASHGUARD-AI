"use client";

import React, { useState, useEffect } from "react";
import { formatRelativeTime, formatCurrency, cn, getRiskColor } from "@/lib/utils";
import { MapPin, ChevronDown, Activity, AlertCircle } from "lucide-react";

interface Complaint {
  id: string;
  timestamp: string;
  category: string;
  city: string;
  amount: number;
  status: string;
  description: string;
}

const mockComplaints: Complaint[] = [
  { id: "1", timestamp: new Date().toISOString(), category: "Phishing", city: "Mumbai", amount: 15000, status: "Open", description: "User clicked malicious link in SMS" },
  { id: "2", timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), category: "Card Skimming", city: "Delhi", amount: 45000, status: "Investigating", description: "Multiple cards skimmed at ATM 442" },
  { id: "3", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), category: "Identity Theft", city: "Bangalore", amount: 0, status: "Open", description: "Fake account creation using PAN card" },
];

export function ComplaintFeed() {
  const [complaints, setComplaints] = useState<Complaint[]>(mockComplaints);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // In a real app, you would connect to a WebSocket here
  // useEffect(() => { const ws = new WebSocket(...); ... }, []);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Phishing": return "bg-blue-100 text-blue-800";
      case "Card Skimming": return "bg-purple-100 text-purple-800";
      case "Identity Theft": return "bg-rose-100 text-rose-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 pb-3 border-b flex items-center justify-between">
        <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          Live Complaint Feed
        </h3>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
          Connected
        </span>
      </div>
      <div className="p-0 flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {complaints.map((complaint) => (
            <div
              key={complaint.id}
              className={cn(
                "border-b last:border-0 p-4 transition-all duration-300 animate-in slide-in-from-top-2 hover:bg-muted/50 cursor-pointer",
                expandedId === complaint.id && "bg-muted/30"
              )}
              onClick={() => setExpandedId(expandedId === complaint.id ? null : complaint.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", getCategoryColor(complaint.category))}>
                      {complaint.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {complaint.city}
                    </span>
                  </div>
                  <div className="font-medium text-sm">
                    {formatCurrency(complaint.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelativeTime(complaint.timestamp)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border", 
                    complaint.status === 'Open' ? 'border-red-200 text-red-600 bg-red-50' : 'border-amber-200 text-amber-600 bg-amber-50'
                  )}>
                    {complaint.status}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expandedId === complaint.id && "rotate-180")} />
                </div>
              </div>
              
              {expandedId === complaint.id && (
                <div className="mt-3 pt-3 border-t animate-in fade-in zoom-in-95 text-sm">
                  <p className="text-muted-foreground mb-3">{complaint.description}</p>
                  <button className="flex items-center justify-center w-full gap-2 bg-primary text-primary-foreground text-xs font-medium py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Run Prediction Model
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 border-t">
        <button className="w-full text-center text-sm text-primary font-medium py-1 hover:underline">
          Load More
        </button>
      </div>
    </div>
  );
}
