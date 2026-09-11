"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Brain, MapPinned, Radio, ShieldCheck } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

const FEATURES = [
  {
    icon: Brain,
    title: "Trained XGBoost AML Detection",
    description:
      "A real model trained on the IBM AML transaction dataset (~0.98 ROC-AUC, ~90% recall) — not a rules engine or a mock.",
  },
  {
    icon: MapPinned,
    title: "Geospatial Hotspot Prediction",
    description:
      "Leaflet-based clustering surfaces cash-out and fraud hotspots on a live map, not just a transaction score.",
  },
  {
    icon: Radio,
    title: "Real-Time Operational Alerts",
    description:
      "A WebSocket live feed pushes incidents to analysts as they happen — an operational tool, not a batch report.",
  },
  {
    icon: ShieldCheck,
    title: "Explainable AI (SHAP)",
    description:
      "Feature attribution surfaces why a transaction was flagged, supporting analyst review and case documentation.",
  },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16 sm:py-24">
        <section className="flex flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Status: Operational
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            CashGuard AI
            <span className="block text-lg font-medium text-muted-foreground sm:text-2xl mt-2">
              Cybercrime Predictive Analytics Framework
            </span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Proactive intervention, cash-out hotspot prediction, and money-mule
            detection for law enforcement and financial-crime analysts.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Access Analyst Command Center
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold">{feature.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
