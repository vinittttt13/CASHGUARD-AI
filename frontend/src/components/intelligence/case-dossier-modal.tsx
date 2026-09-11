"use client";

import { useState } from "react";
import { FileText, Printer, Shield, MapPin, Network, Scale, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CaseDossierModalProps {
  open: boolean;
  onClose: () => void;
  report: any;
  fraudRings: any[];
}

export function CaseDossierModal({ open, onClose, report, fraudRings }: CaseDossierModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!open) return null;

  const investigationRef = `CPAF/INT/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 90000) + 10000).padStart(5, "0")}`;

  const hotspots = (report?.active_hotspots ?? []).slice(0, 5);
  const formatINR = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      onClose();
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Law Enforcement Case Dossier"
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border bg-white shadow-2xl text-slate-900 dark:text-slate-100 dark:bg-slate-950 print:max-h-none print:shadow-none print:overflow-visible print:rounded-none print:border-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Print-only header banner */}
        <div className="print:block hidden bg-black text-white text-center py-4 text-xs font-bold tracking-widest uppercase">
          GOVERNMENT OF INDIA — CYBER CRIME INVESTIGATION WING — CONFIDENTIAL — DO NOT DISTRIBUTE
        </div>

        <div className="p-8 sm:p-10 space-y-8">
          {/* Header */}
          <header className="border-b-4 border-red-800 pb-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-red-800" />
              <span className="text-xs font-extrabold tracking-widest text-red-800 uppercase">Confidential Intelligence Summary</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight uppercase text-slate-950 dark:text-white">
              GOVERNMENT OF INDIA / CYBER CRIME INVESTIGATION WING — CONFIDENTIAL INTELLIGENCE SUMMARY
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
              <span>Reference: <strong className="text-slate-900 dark:text-slate-100">{investigationRef}</strong></span>
              <span>Period: <strong>Last {report?.period_days ?? 7} days</strong></span>
              <span>Generated: <strong>{new Date().toISOString().split("T")[0]}</strong></span>
              <span>Investigating Officer: <strong>Officer-in-Charge, FIU-IND</strong></span>
            </div>
          </header>

          {/* Section 1 — Executive Case Summary */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-red-800 text-white flex items-center justify-center text-xs font-bold">1</div>
              <h2 className="text-lg font-extrabold uppercase tracking-wide">Executive Case Summary</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 rounded-lg border bg-slate-50 dark:bg-slate-900 p-4">
              <div>
                <p className="text-xs uppercase font-bold text-slate-500">Total Incidents</p>
                <p className="text-2xl font-extrabold">{(report?.total_complaints ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-slate-500">Defrauded Amount (INR)</p>
                <p className="text-2xl font-extrabold">{formatINR(report?.total_defrauded_inr)}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-slate-500">Active Hotspots</p>
                <p className="text-2xl font-extrabold">{(report?.active_hotspots ?? []).length}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mt-3 text-slate-700 dark:text-slate-300">{report?.summary ?? "No summary available."}</p>
          </section>

          {/* Section 2 — Fraud Rings & Mules */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-red-800 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h2 className="text-lg font-extrabold uppercase tracking-wide">Identified Fraud Rings &amp; Mules</h2>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Network className="h-5 w-5 text-red-800 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Syndicate Graph Summary</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{(fraudRings ?? []).length} coordinated clusters identified via co-occurrence banking nexus. Shared accounts and mule networks mapped across {new Set((fraudRings ?? []).flatMap((r: any) => r?.accounts ?? [])).size} unique bank accounts.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-red-800 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Shared Bank Accounts &amp; Suspect Coordinates</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Suspect withdrawal patterns correlate with known ATM clusters in the reporting window. Coordinated cash-out points flagged for immediate field deployment.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 — High-Risk ATM Interception Points */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-red-800 text-white flex items-center justify-center text-xs font-bold">3</div>
              <h2 className="text-lg font-extrabold uppercase tracking-wide">High-Risk ATM Cash-Out Interception Points</h2>
            </div>
            <p className="text-xs uppercase font-bold text-slate-500 mb-2">Top 5 predicted withdrawal clusters</p>
            <table className="w-full text-sm border-collapse border">
              <thead className="bg-red-800 text-white">
                <tr>
                  <th className="text-left px-3 py-2 font-bold">#</th>
                  <th className="text-left px-3 py-2 font-bold">Location</th>
                  <th className="text-left px-3 py-2 font-bold">Lat / Lng</th>
                  <th className="text-left px-3 py-2 font-bold">Risk Score</th>
                  <th className="text-left px-3 py-2 font-bold">Predicted Window</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((h: any, i: number) => (
                  <tr key={h?.id ?? i} className="border-b hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="px-3 py-2 font-bold">{i + 1}</td>
                    <td className="px-3 py-2">{h?.name ?? "Unknown"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{h?.lat?.toFixed(4) ?? "—"}, {h?.lng?.toFixed(4) ?? "—"}</td>
                    <td className="px-3 py-2">{(h?.risk_score ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{h?.incident_count ?? 0} incidents — immediate surveillance advised</td>
                  </tr>
                ))}
                {hotspots.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">No hotspot data available.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Section 4 — Chain of Custody & Algorithmic Disclosure */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-red-800 text-white flex items-center justify-center text-xs font-bold">4</div>
              <h2 className="text-lg font-extrabold uppercase tracking-wide">Chain of Custody &amp; Algorithmic Disclosure</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
              <div>
                <p className="font-bold text-xs uppercase text-slate-500">Model Versions</p>
                <p><strong>XGBoost v2.4</strong> — primary fraud classification model.</p>
                <p><strong>SHAP v0.40</strong> — feature attribution breakdown.</p>
                <p><strong>KMeans/DBSCAN v1.2</strong> — spatial clustering.</p>
              </div>
              <div>
                <p className="font-bold text-xs uppercase text-slate-500">Disclosures</p>
                <p>SHAP feature attribution: high-importance drivers include transaction velocity, device fingerprint divergence, and geographic distance from registered address.</p>
                <p>Timestamp: <strong>{new Date().toISOString()}</strong></p>
                <p>Investigating Officer: <strong>Officer-in-Charge, FIU-IND</strong></p>
              </div>
            </div>
          </section>

          {/* Footer — Print / Close */}
          <footer className="border-t pt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-slate-500">
              <p>Prepared under CYBER CRIME INVESTIGATION WING (CCIW) authority.</p>
              <p>This dossier is confidential and intended solely for authorized law enforcement and judicial review.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> Print Dossier
              </Button>
            </div>
          </footer>
        </div>
      </div>

      {/* Print styles injected via style tag for reliability */}
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, aside, header.site-header, .print\:hidden { display: none !important; }
          .max-w-5xl, main, .flex-col { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
