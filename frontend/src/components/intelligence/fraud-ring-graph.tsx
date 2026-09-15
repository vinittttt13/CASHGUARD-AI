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
    if (score >= 0.8) return { label: "CRITICAL RISK", color: "bg-risk-critical/10 text-risk-critical border-risk-critical/25" };
    if (score >= 0.5) return { label: "ELEVATED RISK", color: "bg-risk-medium/10 text-risk-medium border-risk-medium/25" };
    return { label: "MODERATE RISK", color: "bg-secondary/10 text-secondary border-secondary/25" };
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
          <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-4">
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
              <Badge variant="outline" className={`font-mono text-xs ${badge?.color}`}>
                {badge?.label}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
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
                    stroke="#5e6e7e"
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
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                ))}

              {/* Complaint Nodes */}
              {graphNodes.complaints.map((node) => (
                <g key={`node-c-${node.id}`}>
                  <circle cx={node.x} cy={node.y} r="14" fill="#141f2a" stroke="#ef4444" strokeWidth="2" />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="#e6edf3"
                  >
                    {node.label.slice(4)}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 24}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#8b9aaa"
                  >
                    Complaint
                  </text>
                </g>
              ))}

              {/* Bank Nodes */}
              {graphNodes.banks.map((node) => (
                <g key={`node-b-${node.id}`}>
                  <circle cx={node.x} cy={node.y} r="16" fill="#141f2a" stroke="#3b82f6" strokeWidth="2.5" />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#8fb4ff"
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
                  <circle cx={node.x} cy={node.y} r="14" fill="#141f2a" stroke="#22c55e" strokeWidth="2" />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#4ade80"
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
                    fill="#1f1416"
                    stroke="#ef4444"
                    strokeWidth="3"
                  />
                  <text
                    x={graphNodes.center.x}
                    y={graphNodes.center.y - 2}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#f87171"
                  >
                    {activeRing.ring_id}
                  </text>
                  <text
                    x={graphNodes.center.x}
                    y={graphNodes.center.y + 12}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#ef4444"
                  >
                    SYNDICATE
                  </text>
                </g>
              )}
            </svg>

            {/* Graph Legend */}
            <div className="flex w-full items-center justify-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full border border-risk-critical bg-risk-critical/15" />
                <span>Syndicate Hub</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-secondary bg-secondary/15" />
                <span>Targeted Bank</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-risk-low bg-risk-low/15" />
                <span>Location Hotspot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-risk-critical bg-surface-overlay" />
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
                <div className="rounded-lg border border-border bg-surface-overlay p-2.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <IndianRupee className="h-3 w-3" /> Total Defrauded
                  </div>
                  <div className="mt-0.5 font-mono text-base font-semibold text-risk-critical">
                    {formatCurrency(activeRing.total_defrauded_inr)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface-overlay p-2.5">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> Correlated Incidents
                  </div>
                  <div className="mt-0.5 font-mono text-base font-semibold text-foreground">
                    {activeRing.complaint_count} complaints
                  </div>
                </div>
              </div>

              {/* Shared Banks */}
              <div>
                <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-secondary" /> Targeted Banking Channels
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
                <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-risk-low" /> Geographic Footprint
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
                  <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-risk-analytic" /> Shared Suspect Identifiers
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {activeRing.suspect_identifiers.map((ident) => (
                      <span
                        key={ident}
                        className="rounded border border-border bg-surface-overlay px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
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
