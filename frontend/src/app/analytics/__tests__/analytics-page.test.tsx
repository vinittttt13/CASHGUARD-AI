import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getTrends: vi.fn(),
  getComplaintStats: vi.fn(),
  getAlerts: vi.fn(),
  getHotspots: vi.fn(),
  getComplaints: vi.fn(),
  predictComplaint: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

import AnalyticsPage from "@/app/analytics/page";

const trendsPayload = {
  period_days: 30,
  daily_counts: [{ date: "2026-08-01", count: 5 }],
  forecast: [{ date: "2026-09-01", predicted_count: 7 }],
};

const statsPayload = {
  total_complaints: 10,
  by_category: { phishing: 4, atm_fraud: 6 },
  by_state: { Maharashtra: 6, Delhi: 4 },
  by_status: { pending: 5, resolved: 5 },
};

const alertsPayload = {
  total: 1,
  items: [
    {
      id: "al-1",
      title: "Spike",
      description: "x",
      alert_type: "pattern_change",
      priority: "high",
      latitude: null,
      longitude: null,
      confidence_score: 0.72,
      is_active: true,
      is_acknowledged: false,
      acknowledged_by: null,
      created_at: "2026-09-01T00:00:00Z",
      expires_at: null,
    },
  ],
};

function resolveEverythingHappily() {
  api.getTrends.mockResolvedValue(trendsPayload);
  api.getComplaintStats.mockResolvedValue(statsPayload);
  api.getAlerts.mockResolvedValue(alertsPayload);
  api.getHotspots.mockResolvedValue([]);
  api.getComplaints.mockResolvedValue({ total: 0, items: [] });
  api.predictComplaint.mockResolvedValue({});
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe("AnalyticsPage", () => {
  it("renders every section's title once all API-backed data resolves", async () => {
    resolveEverythingHappily();

    render(<AnalyticsPage />);

    await waitFor(() =>
      expect(screen.getByText("Crime Volume Time Series")).toBeInTheDocument(),
    );
    expect(screen.getByText("Model Confidence")).toBeInTheDocument();
    expect(screen.getByText("Feature Importance")).toBeInTheDocument();
    expect(screen.getByText("Geographic Distribution")).toBeInTheDocument();
    expect(screen.getByText("Predicted Hotspots Database")).toBeInTheDocument();
  });

  it("shows an error state with retry for the trends chart when its call fails", async () => {
    resolveEverythingHappily();
    api.getTrends.mockReset();
    api.getTrends.mockRejectedValue(new Error("trends down"));

    render(<AnalyticsPage />);

    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent(/Failed to load/i),
    );
    expect(
      screen.getAllByRole("button", { name: /retry/i }).length,
    ).toBeGreaterThan(0);
  });

  it("shows an empty state for geographic distribution when there are no complaints", async () => {
    resolveEverythingHappily();
    api.getComplaintStats.mockReset();
    api.getComplaintStats.mockResolvedValue({
      total_complaints: 0,
      by_category: {},
      by_state: {},
      by_status: {},
    });

    render(<AnalyticsPage />);

    await waitFor(() => expect(screen.getByText("No complaints.")).toBeInTheDocument());
  });

  it("shows an empty state for feature importance when there is no newest complaint to predict", async () => {
    resolveEverythingHappily();
    api.getComplaints.mockReset();
    api.getComplaints.mockResolvedValue({ total: 0, items: [] });

    render(<AnalyticsPage />);

    await waitFor(() => expect(screen.getByText("No SHAP data.")).toBeInTheDocument());
    // predictComplaint must never be called when there's no complaint id to predict for.
    expect(api.predictComplaint).not.toHaveBeenCalled();
  });
});
