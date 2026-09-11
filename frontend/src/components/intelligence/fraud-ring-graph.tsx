"use client";

import React, { useState, useMemo } from "react";
import { Network, ShieldAlert, AlertTriangle, Building2, MapPin, Layers, Users, IndianRupee } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { formatCurrency } from "@/lib/utils";
import type { FraudRing } from "@/types";

interface FraudRingGraphProps {
  rings?: FraudRing[];
}

export function FraudRingGraph({ rings = [] }: FraudRingGraphProps) {
  const [selectedRingIndex, setSelectedRingIndex] = useState(0);
  const activeRing = rings[selectedRingIndex] ?? rings[0];

  const ringRiskBadge = (score: number) => {
    if (score >= 0.8) return { label: "CRITICAL RISK", color: "bg-red-500/10 text-red-600 border-red-500/20" };
    if (score >= 0.5) return { label: "ELEVATED RISK", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
    return { label: "MODERATE RISK", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
  };

  // Node layout calculation for SVG graph
  const graphNodes = useMemo(() => {
    if (!activeRing) return { center: null, banks: [], locations: [], complaints: [] };

    const centerX = 260;
    const centerY = 200;

    // Outer radius for complaints
    const complaints = (activeRing.complaint_ids || []).slice(0, 8).map((cid, i, arr) => {
      const angle = (2 * Math.PI * i) / (arr.length || 1);
      const r = 130;
      return {
        id: cid,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        label: `CID-${cid.slice(0, 4)}`,
        type: "complaint",
      };
    });

    // Inner radius for banks
    const banks = (activeRing.shared_banks || []).slice(0, 4).map((bank, i, arr) => {
      const angle = (2 * Math.PI * i) / (arr.length || 1) + Math.PI / 4;
      const r = 75;
      return {
        id: bank,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        label: bank,
        type: "bank",
      };
    });

    // Locations
    const locations = (activeRing.shared_locations || []).slice(0, 3).map((loc, i, arr) => {
      const angle = (2 * Math.PI * i) / (arr.length || 1) - Math.PI / 3;
      const r = 95;
      return {
        id: loc,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        label: loc,
        type: "location",
      };
    });

    return {
      center: { x: centerX, y: centerY, label: activeRing.ring_id, type: "ring" },
      banks,
      locations,
      complaints,
    };
  }, [activeRing]);

  if (!rings || rings.length === 0) {
    return (
      <EmptyState
        label="No coordinated fraud rings detected in current reporting window."
        hint="Graph analytics continuously scans complaint co-occurrences (bank, location, identifiers)."
      />
    );
  }

  const badge = activeRing ? ringRiskBadge(activeRing.risk_score) : null;

  return (
    <div className="space-y-6">
      {/* Ring selector tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {rings.map((ring, idx) => {
          const isSelected = idx === selectedRingIndex;
          const rBadge = ringRiskBadge(ring.risk_score);
          return (
            <Button
              key={ring.ring_id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRingIndex(idx)}
              className="gap-2 shrink-0"
            >
              <Network className="h-3.5 w-3.5" />
              <span>{ring.ring_id}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${rBadge.color}`}>
                {ring.member_count} nodes
              </span>
            </Button>
          );
        })}
      </div>

      {activeRing && (
        <div className="grid gap-6 lg:grid-cols-[60%_40%] items-start">
          {/* SVG Network Visualizer */}
          <div className="relative rounded-xl border bg-card p-4 overflow-hidden flex flex-col items-center justify-center min-h-[420px]">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <Badge variant="outline" className={`font-mono text-xs ${badge?.color}`}>
                {badge?.label}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                Risk Score: {(activeRing.risk_score * 100).toFixed(1)}%
              </span>
            </div>

            <svg viewBox="0 0 520 400" className="w-full h-auto max-h-[380px]">
              {/* Edges from center to complaints */}
              {graphNodes.center &&
                graphNodes.complaints.map((node) => (
                  <line
                    key={`edge-c-${node.id}`}
                    x1={graphNodes.center!.x}
                    y1={graphNodes.center!.y}
                    x2={node.x}
                    y2={node.y}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.6"
                  />
                ))}

              {/* Edges from center to banks */}
              {graphNodes.center &&
                graphNodes.banks.map((node) => (
                  <line
                    key={`edge-b-${node.id}`}
                    x1={graphNodes.center!.x}
                    y1={graphNodes.center!.y}
                    x2={node.x}
                    y2={node.y}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    opacity="0.7"
                  />
                ))}

              {/* Edges from center to locations */}
              {graphNodes.center &&
                graphNodes.locations.map((node) => (
                  <line
                    key={`edge-l-${node.id}`}
                    x1={graphNodes.center!.x}
                    y1={graphNodes.center!.y}
                    x2={node.x}
                    y2={node.y}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                ))}

              {/* Complaint Nodes */}
              {graphNodes.complaints.map((node) => (
                <g key={`node-c-${node.id}`}>
                  <circle cx={node.x} cy={node.y} r="14" fill="#f8fafc" stroke="#ef4444" strokeWidth="2" />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="#1e293b"
                  >
                    {node.label.slice(4)}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 24}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#64748b"
                  >
                    Complaint
                  </text>
                </g>
              ))}

              {/* Bank Nodes */}
              {graphNodes.banks.map((node) => (
                <g key={`node-b-${node.id}`}>
                  <circle cx={node.x} cy={node.y} r="16" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2.5" />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#1d4ed8"
                  >
                    {node.label.slice(0, 4)}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 26}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#3b82f6"
                  >
                    Bank
                  </text>
                </g>
              ))}

              {/* Location Nodes */}
              {graphNodes.locations.map((node) => (
                <g key={`node-l-${node.id}`}>
                  <circle cx={node.x} cy={node.y} r="14" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#047857"
                  >
                    {node.label.slice(0, 3)}
                  </text>
                </g>
              ))}

              {/* Central Syndicate Ring Node */}
              {graphNodes.center && (
                <g>
                  <circle
                    cx={graphNodes.center.x}
                    cy={graphNodes.center.y}
                    r="28"
                    fill="#fee2e2"
                    stroke="#dc2626"
                    strokeWidth="3"
                  />
                  <text
                    x={graphNodes.center.x}
                    y={graphNodes.center.y - 2}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#991b1b"
                  >
                    {activeRing.ring_id}
                  </text>
                  <text
                    x={graphNodes.center.x}
                    y={graphNodes.center.y + 12}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#dc2626"
                  >
                    SYNDICATE
                  </text>
                </g>
              )}
            </svg>

            {/* Graph Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t w-full justify-center">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-100 border border-red-600 inline-block" />
                <span>Syndicate Hub</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-500 inline-block" />
                <span>Targeted Bank</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-500 inline-block" />
                <span>Location Hotspot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-rose-500 inline-block" />
                <span>Correlated Complaint</span>
              </div>
            </div>
          </div>

          {/* Ring Dossier / Metadata */}
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  Syndicate Dossier: {activeRing.ring_id}
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs capitalize">
                  {activeRing.coordination_type.toLowerCase().replace("_", " ")}
                </Badge>
              </div>
              <CardDescription className="text-xs">{activeRing.pattern}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5 bg-muted/20">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <IndianRupee className="h-3 w-3" /> Total Defrauded
                  </div>
                  <div className="text-base font-bold text-destructive mt-0.5">
                    {formatCurrency(activeRing.total_defrauded_inr)}
                  </div>
                </div>
                <div className="rounded-lg border p-2.5 bg-muted/20">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Correlated Incidents
                  </div>
                  <div className="text-base font-bold mt-0.5">
                    {activeRing.complaint_count} complaints
                  </div>
                </div>
              </div>

              {/* Shared Banks */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" /> Targeted Banking Channels
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {activeRing.shared_banks.length > 0 ? (
                    activeRing.shared_banks.map((b) => (
                      <Badge key={b} variant="secondary" className="text-xs font-normal">
                        {b}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">None identified</span>
                  )}
                </div>
              </div>

              {/* Shared Locations */}
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" /> Geographic Footprint
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {activeRing.shared_locations.length > 0 ? (
                    activeRing.shared_locations.map((loc) => (
                      <Badge key={loc} variant="outline" className="text-xs font-normal">
                        {loc}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Distributed</span>
                  )}
                </div>
              </div>

              {/* Suspect Identifiers if available */}
              {activeRing.suspect_identifiers && activeRing.suspect_identifiers.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-purple-500" /> Shared Suspect Identifiers
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {activeRing.suspect_identifiers.map((ident) => (
                      <span
                        key={ident}
                        className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded border text-muted-foreground"
                      >
                        {ident}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
