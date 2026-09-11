import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({
  getComplaintStats: vi.fn(),
  getAlerts: vi.fn(),
  getHotspots: vi.fn(),
  getComplaints: vi.fn(),
  predictComplaint: vi.fn(),
  acknowledgeAlert: vi.fn(),
}));
vi.mock("@/lib/api", () => api);
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { StatsOverview } from "@/components/dashboard/stats-overview";
import { ComplaintFeed } from "@/components/dashboard/complaint-feed";
import { AlertCenter } from "@/components/alerts/AlertCenter";

const alertsPayload = {
  total: 2,
  items: [
    {
      id: "al-1",
      title: "ATM Fraud Surge",
      description: "spike detected",
      alert_type: "pattern_change",
      priority: "high",
      latitude: 12.9,
      longitude: 77.5,
      confidence_score: 0.8,
      is_active: true,
      is_acknowledged: false,
      acknowledged_by: null,
      created_at: "2026-09-01T00:00:00Z",
      expires_at: null,
    },
    {
      id: "al-2",
      title: "Phishing spike",
      description: "campaign",
      alert_type: "temporal_spike",
      priority: "critical",
      latitude: null,
      longitude: null,
      confidence_score: 0.6,
      is_active: true,
      is_acknowledged: true,
      acknowledged_by: "u1",
      created_at: "2026-09-02T00:00:00Z",
      expires_at: null,
    },
  ],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe("StatsOverview", () => {
  it("renders computed figures from the API", async () => {
    api.getComplaintStats.mockResolvedValue({
      by_category: { phishing: 3 },
      by_state: { Maharashtra: 5 },
      by_status: { pending: 4, resolved: 6 },
    });
    api.getAlerts.mockResolvedValue(alertsPayload);
    api.getHotspots.mockResolvedValue([
      { cluster_id: "h1" },
      { cluster_id: "h2" },
      { cluster_id: "h3" },
    ]);

    render(<StatsOverview />);

    await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument()); // total complaints
    expect(screen.getByText("3")).toBeInTheDocument(); // high-risk hotspots
    expect(screen.getByText(/1 unacknowledged/)).toBeInTheDocument();
    // "Active Threats" / "Active Alerts" card shows the total (2)
    expect(
      screen.getByText(/Active (Alerts|Threats)/i).closest("div")?.parentElement,
    ).toHaveTextContent("2");
  });

  it("shows an error state with retry when the API fails", async () => {
    api.getComplaintStats.mockRejectedValue(new Error("nope"));
    api.getAlerts.mockRejectedValue(new Error("nope"));
    api.getHotspots.mockRejectedValue(new Error("nope"));

    render(<StatsOverview />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load/i),
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("ComplaintFeed", () => {
  it("renders complaint rows from the API", async () => {
    api.getComplaints.mockResolvedValue({
      total: 1,
      items: [
        {
          id: "c1",
          complaint_number: "CYB/2024/10049",
          complaint_text: "Investment fraud through fake trading platform.",
          complaint_category: "phishing",
          amount_defrauded: 260077,
          currency: "INR",
          state: "Tamil Nadu",
          district: "Chennai",
          city: "Chennai",
          status: "resolved",
          created_at: "2026-09-01T00:00:00Z",
          incident_date: "2026-09-01T00:00:00Z",
        },
      ],
    });

    render(<ComplaintFeed />);
    await waitFor(() =>
      expect(screen.getByText(/CYB\/2024\/10049/)).toBeInTheDocument(),
    );
    expect(screen.getByText("phishing")).toBeInTheDocument();
  });

  it("shows the empty state when there are no complaints", async () => {
    api.getComplaints.mockResolvedValue({ total: 0, items: [] });
    render(<ComplaintFeed />);
    await waitFor(() =>
      expect(screen.getByText(/No complaints (recorded )?yet/i)).toBeInTheDocument(),
    );
  });
});

describe("AlertCenter", () => {
  it("lists alerts and acknowledges via the API", async () => {
    api.getAlerts.mockResolvedValue(alertsPayload);
    api.acknowledgeAlert.mockResolvedValue({ ...alertsPayload.items[0], is_acknowledged: true });

    render(<AlertCenter />);
    await waitFor(() =>
      expect(screen.getByText("ATM Fraud Surge")).toBeInTheDocument(),
    );

    const ackBtn = screen.getByRole("button", { name: /acknowledge/i });
    await userEvent.click(ackBtn);
    expect(api.acknowledgeAlert).toHaveBeenCalledWith("al-1");
  });

  it("shows an error state when alerts fail to load", async () => {
    api.getAlerts.mockRejectedValue(new Error("down"));
    render(<AlertCenter />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load/i),
    );
  });
});
