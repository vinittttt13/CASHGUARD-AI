"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const activeRing = rings[selectedRingIndex] ?? rings[0];

  const ringRiskBadge = (score: number) => {
    if (score >= 0.8) return { label: "Critical risk", color: "bg-risk-critical/10 text-risk-critical border-risk-critical/25" };
    if (score >= 0.5) return { label: "Elevated risk", color: "bg-risk-medium/10 text-risk-medium border-risk-medium/25" };
    return { label: "Moderate risk", color: "bg-secondary/10 text-secondary border-secondary/25" };
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

            <svg viewBox="0 0 520 400" className="w-full h-auto max-h-[380px]" onMouseLeave={() => setHoveredId(null)}>
              {(
                [
                  ...graphNodes.complaints.map((n) => ({ ...n, color: "#ff4b26", dash: "4 3", width: 1.5 })),
                  ...graphNodes.banks.map((n) => ({ ...n, color: "#ede7da", dash: undefined, width: 2 })),
                  ...graphNodes.locations.map((n) => ({ ...n, color: "#5b9083", dash: undefined, width: 1.5 })),
                ] as Array<{ id: string; x: number; y: number; label: string; type: string; color: string; dash?: string; width: number }>
              ).map((node) => {
                const dimmed = hoveredId !== null && hoveredId !== node.id;
                const cx = graphNodes.center!.x;
                const cy = graphNodes.center!.y;
                return (
                  <g key={`edge-${node.id}`} opacity={dimmed ? 0.15 : 1} style={{ transition: "opacity 0.2s" }}>
                    <line
                      x1={node.x}
                      y1={node.y}
                      x2={cx}
                      y2={cy}
                      stroke={node.color}
                      strokeWidth={hoveredId === node.id ? node.width + 1 : node.width}
                      strokeDasharray={node.dash}
                      opacity="0.55"
                    />
                    {/* Money-flow particle: travels from the outer node into
                        the hub, on a per-edge staggered loop. Represents
                        funds actually moving into the syndicate, not
                        decoration. */}
                    <motion.circle
                      r={2.5}
                      fill={node.color}
                      animate={{ cx: [node.x, cx], cy: [node.y, cy], opacity: [0, 1, 1, 0] }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "linear",
                        delay: (node.x + node.y) % 2,
                      }}
                    />
                  </g>
                );
              })}

              {/* Complaint Nodes */}
              {graphNodes.complaints.map((node) => (
                <g
                  key={`node-c-${node.id}`}
                  onMouseEnter={() => setHoveredId(node.id)}
                  className="cursor-pointer"
                  opacity={hoveredId !== null && hoveredId !== node.id ? 0.25 : 1}
                  style={{ transition: "opacity 0.2s" }}
                >
                  <circle cx={node.x} cy={node.y} r="14" fill="#201b14" stroke="#ff4b26" strokeWidth="2" />
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="#ede7da">
                    {node.label.slice(4)}
                  </text>
                  <text x={node.x} y={node.y + 24} textAnchor="middle" fontSize="8" fill="#8b8375">
                    Complaint
                  </text>
                </g>
              ))}

              {/* Bank Nodes */}
              {graphNodes.banks.map((node) => (
                <g
                  key={`node-b-${node.id}`}
                  onMouseEnter={() => setHoveredId(node.id)}
                  className="cursor-pointer"
                  opacity={hoveredId !== null && hoveredId !== node.id ? 0.25 : 1}
                  style={{ transition: "opacity 0.2s" }}
                >
                  <circle cx={node.x} cy={node.y} r="16" fill="#201b14" stroke="#ede7da" strokeWidth="2.5" />
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#ede7da">
                    {node.label.slice(0, 4)}
                  </text>
                  <text x={node.x} y={node.y + 26} textAnchor="middle" fontSize="8" fill="#ede7da">
                    Bank
                  </text>
                </g>
              ))}

              {/* Location Nodes */}
              {graphNodes.locations.map((node) => (
                <g
                  key={`node-l-${node.id}`}
                  onMouseEnter={() => setHoveredId(node.id)}
                  className="cursor-pointer"
                  opacity={hoveredId !== null && hoveredId !== node.id ? 0.25 : 1}
                  style={{ transition: "opacity 0.2s" }}
                >
                  <circle cx={node.x} cy={node.y} r="14" fill="#201b14" stroke="#5b9083" strokeWidth="2" />
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#5b9083">
                    {node.label.slice(0, 3)}
                  </text>
                </g>
              ))}

              {/* Central Syndicate Ring Node — the emphasized hub: a slow
                  breathing pulse marks it as the thing every edge in this
                  graph converges on. */}
              {graphNodes.center && (
                <g opacity={hoveredId !== null ? 1 : 1}>
                  <motion.circle
                    cx={graphNodes.center.x}
                    cy={graphNodes.center.y}
                    r="28"
                    fill="#201b14"
                    stroke="#ff4b26"
                    strokeWidth="3"
                    animate={{ r: [28, 30, 28] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <text
                    x={graphNodes.center.x}
                    y={graphNodes.center.y - 2}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="bold"
                    fill="#ff4b26"
                  >
                    {activeRing.ring_id}
                  </text>
                  <text
                    x={graphNodes.center.x}
                    y={graphNodes.center.y + 12}
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="600"
                    fill="#ff4b26"
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
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-foreground/50 bg-foreground/10" />
                <span>Targeted bank</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-verified bg-verified/15" />
                <span>Location hotspot</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-ash bg-surface-overlay" />
                <span>Correlated complaint</span>
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
                <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold label-caps text-muted-foreground">
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
                <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold label-caps text-muted-foreground">
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
                  <h5 className="mb-2 flex items-center gap-1.5 text-xs font-semibold label-caps text-muted-foreground">
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
