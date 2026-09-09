"use client";

import React, { useState } from "react";
import { AlertCard } from "./AlertCard";
import { Filter, Search } from "lucide-react";

type Priority = "All" | "Critical" | "High" | "Medium" | "Low";

interface AlertData {
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
}

// Mock Data
const mockAlerts: AlertData[] = [
  {
    id: "ALT-001",
    priority: "Critical",
    type: "ATM_SKIMMING",
    title: "Coordinated Skimming Attack Detected",
    description: "High probability of simultaneous card skimming at 3 ATMs in Connaught Place area based on transaction velocity.",
    location: "Connaught Place, New Delhi",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    acknowledged: false,
  },
  {
    id: "ALT-002",
    priority: "High",
    type: "PHISHING_SPIKE",
    title: "Phishing Campaign Spike",
    description: "Sudden 400% increase in UPI-related phishing complaints in the last hour.",
    location: "Pan-India",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    acknowledged: true,
    acknowledgedBy: "Inspector Sharma",
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "ALT-003",
    priority: "Medium",
    type: "UNUSUAL_WITHDRAWAL",
    title: "Anomalous Withdrawal Pattern",
    description: "Multiple high-value withdrawals from newly created accounts.",
    location: "Andheri West, Mumbai",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    acknowledged: false,
  }
];

export function AlertCenter({ searchQuery = "" }: { searchQuery?: string }) {
  const [filter, setFilter] = useState<Priority>("All");
  // const [searchQuery, setSearchQuery] = useState(""); // Managed by parent now

  const filteredAlerts = mockAlerts.filter(alert => {
    if (filter !== "All" && alert.priority !== filter) return false;
    if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) && !alert.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleAcknowledge = (id: string) => {
    console.log("Acknowledged", id);
    // In a real app, make API call and update state
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Alert Center</h2>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <Filter className="w-4 h-4 text-muted-foreground mr-1 flex-shrink-0" />
          {(["All", "Critical", "High", "Medium", "Low"] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                filter === p 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
              {p !== "All" && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">
                  {mockAlerts.filter(a => a.priority === p).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
        {filteredAlerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
            <p>No alerts match your current filters.</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <AlertCard 
              key={alert.id} 
              alert={alert} 
              onAcknowledge={() => handleAcknowledge(alert.id)} 
            />
          ))
        )}
      </div>

      <div className="p-3 border-t bg-card text-xs text-center text-muted-foreground flex justify-between items-center">
        <span>Showing {filteredAlerts.length} alerts</span>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 rounded border hover:bg-muted disabled:opacity-50" disabled>Previous</button>
          <button className="px-2 py-1 rounded border hover:bg-muted disabled:opacity-50" disabled>Next</button>
        </div>
      </div>
    </div>
  );
}

// Need to import ShieldAlert up top to fix it
import { ShieldAlert } from "lucide-react";
