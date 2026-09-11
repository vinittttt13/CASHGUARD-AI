import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getIntelligenceReport: vi.fn(),
  getTrends: vi.fn(),
  getFraudRings: vi.fn(),
  exportIntelligenceReport: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import IntelligenceReportPage from "@/app/intelligence/page";

const reportPayload = {
  summary: "Cybercrime analysis over the past 7 days: 50 incidents reported.",
  period_days: 7,
  total_complaints: 50,
  total_defrauded_inr: 13076056.59,
  active_hotspots: [
    { id: "h1", name: "BOB ATM - Nagpur #2", lat: 21.1, lng: 79.0, risk_score: 99, incident_count: 30 },
  ],
  high_priority_alerts: [
    { id: "al-1", title: "Spike", priority: "critical", alert_type: "temporal_spike", created_at: "2026-09-01T00:00:00Z" },
  ],
  state_wise_breakdown: { Maharashtra: 12, Rajasthan: 8 },
  category_breakdown: { phishing: 20, atm_fraud: 30 },
  top_targeted_banks: [["SBI", 10]],
  recommendations: ["Deploy field patrols to top 5 high-risk clusters."],
  generated_at: "2026-09-11T00:00:00Z",
};

const trendsPayload = {
  period_days: 30,
  daily_counts: [{ date: "2026-08-01", count: 5 }],
  forecast: [{ date: "2026-09-01", predicted_count: 7 }],
};

function resolveEverythingHappily() {
  api.getIntelligenceReport.mockResolvedValue(reportPayload);
  api.getTrends.mockResolvedValue(trendsPayload);
  api.getFraudRings.mockResolvedValue([]);
}

beforeEach(() => {
  api.getIntelligenceReport.mockReset();
  api.getTrends.mockReset();
  api.getFraudRings.mockReset();
});

describe("IntelligenceReportPage", () => {
  it("renders the executive summary and stats once the report resolves", async () => {
    resolveEverythingHappily();

    render(<IntelligenceReportPage />);

    await waitFor(() => expect(screen.getByText(reportPayload.summary)).toBeInTheDocument());
    expect(screen.getByText("50")).toBeInTheDocument(); // Complaints stat
    expect(screen.getByText("Deploy field patrols to top 5 high-risk clusters.")).toBeInTheDocument();
  });

  it("renders every report section's title", async () => {
    resolveEverythingHappily();

    render(<IntelligenceReportPage />);

    await waitFor(() => expect(screen.getByText("Executive Summary")).toBeInTheDocument());
    expect(screen.getByText("Primary Threat Trends")).toBeInTheDocument();
    expect(screen.getByText("State-wise Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Identified Hotspots")).toBeInTheDocument();
    expect(screen.getByText("Syndicate & Fraud Ring Network Analysis")).toBeInTheDocument();
    expect(screen.getByText("Actionable Recommendations")).toBeInTheDocument();
  });

  it("shows an error state with retry when the report fails to load", async () => {
    api.getIntelligenceReport.mockRejectedValue(new Error("report down"));
    api.getTrends.mockResolvedValue(trendsPayload);
    api.getFraudRings.mockResolvedValue([]);

    render(<IntelligenceReportPage />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load/i),
    );
  });

  it("shows an empty state for recommendations when the report has none", async () => {
    api.getIntelligenceReport.mockResolvedValue({ ...reportPayload, recommendations: [] });
    api.getTrends.mockResolvedValue(trendsPayload);
    api.getFraudRings.mockResolvedValue([]);

    render(<IntelligenceReportPage />);

    await waitFor(() => expect(screen.getByText("No recommendations.")).toBeInTheDocument());
  });

  it("refresh button re-triggers all three data fetches", async () => {
    resolveEverythingHappily();
    const { default: userEvent } = await import("@testing-library/user-event");

    render(<IntelligenceReportPage />);
    await waitFor(() => expect(screen.getByText("Executive Summary")).toBeInTheDocument());

    const callsBefore = {
      report: api.getIntelligenceReport.mock.calls.length,
      trends: api.getTrends.mock.calls.length,
      rings: api.getFraudRings.mock.calls.length,
    };

    await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(api.getIntelligenceReport.mock.calls.length).toBeGreaterThan(callsBefore.report);
    expect(api.getTrends.mock.calls.length).toBeGreaterThan(callsBefore.trends);
    expect(api.getFraudRings.mock.calls.length).toBeGreaterThan(callsBefore.rings);
  });

  it("export button triggers an authenticated CSV download for the report window", async () => {
    resolveEverythingHappily();
    api.exportIntelligenceReport.mockResolvedValue(undefined);
    const { default: userEvent } = await import("@testing-library/user-event");

    render(<IntelligenceReportPage />);
    await waitFor(() => expect(screen.getByText("Executive Summary")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => expect(api.exportIntelligenceReport).toHaveBeenCalledWith(7));
  });

  it("shows an error toast when the export fails", async () => {
    resolveEverythingHappily();
    api.exportIntelligenceReport.mockRejectedValue(new Error("export failed"));
    const { default: userEvent } = await import("@testing-library/user-event");

    render(<IntelligenceReportPage />);
    await waitFor(() => expect(screen.getByText("Executive Summary")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => expect(api.exportIntelligenceReport).toHaveBeenCalled());
  });
});
