"use client";

import React from "react";

const HOTSPOTS = [
  { city: "Mumbai", state: "Maharashtra", score: 92, type: "Financial Fraud", change: "+14%" },
  { city: "Delhi", state: "NCT", score: 85, type: "Phishing", change: "+8%" },
  { city: "Bengaluru", state: "Karnataka", score: 78, type: "Identity Theft", change: "+3%" },
  { city: "Hyderabad", state: "Telangana", score: 71, type: "Online Scam", change: "-2%" },
  { city: "Ahmedabad", state: "Gujarat", score: 68, type: "UPI Fraud", change: "+11%" },
  { city: "Pune", state: "Maharashtra", score: 63, type: "Cyber Extortion", change: "+5%" },
];

export function HotspotGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {HOTSPOTS.map((h, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2 hover:bg-muted/30 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{h.city}</p>
              <p className="text-xs text-muted-foreground">{h.state}</p>
            </div>
            <span className={`text-xl font-bold ${h.score >= 80 ? "text-red-500" : h.score >= 70 ? "text-orange-500" : "text-yellow-500"}`}>
              {h.score}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{h.type}</span>
            <span className={h.change.startsWith("+") ? "text-red-500" : "text-green-500"}>{h.change}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${h.score >= 80 ? "bg-red-500" : h.score >= 70 ? "bg-orange-500" : "bg-yellow-500"}`}
              style={{ width: `${h.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default HotspotGrid;
