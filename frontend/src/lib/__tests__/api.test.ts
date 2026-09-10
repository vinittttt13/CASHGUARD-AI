import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the axios instance. `vi.hoisted` so the fns exist when the factory runs.
const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
const { get, post, put } = h;
vi.mock("axios", () => {
  const instance = {
    get: h.get,
    post: h.post,
    put: h.put,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return { default: { create: () => instance, post: h.post } };
});

import {
  getComplaints,
  getComplaintStats,
  getAlerts,
  acknowledgeAlert,
  getTrends,
  getHotspots,
  predictComplaint,
} from "@/lib/api";

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
});

describe("lib/api paths + payloads", () => {
  it("getComplaints hits /api/v1/complaints with params and returns data", async () => {
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    const res = await getComplaints({ limit: 15 });
    expect(get).toHaveBeenCalledWith("/api/v1/complaints", {
      params: { limit: 15 },
    });
    expect(res).toEqual({ items: [], total: 0 });
  });

  it("getComplaintStats hits the aggregate endpoint", async () => {
    get.mockResolvedValue({ data: { by_category: {}, by_state: {}, by_status: {} } });
    await getComplaintStats();
    expect(get).toHaveBeenCalledWith("/api/v1/complaints/stats/aggregate");
  });

  it("predictComplaint posts force_refresh:true by default", async () => {
    post.mockResolvedValue({ data: { risk_level: "high" } });
    await predictComplaint("abc");
    expect(post).toHaveBeenCalledWith("/api/v1/predict", {
      complaint_id: "abc",
      force_refresh: true,
    });
  });

  it("acknowledgeAlert PUTs the acknowledge path and returns the alert", async () => {
    put.mockResolvedValue({ data: { id: "a1", is_acknowledged: true } });
    const res = await acknowledgeAlert("a1");
    expect(put).toHaveBeenCalledWith(
      "/api/v1/intelligence/alerts/a1/acknowledge",
    );
    expect(res).toEqual({ id: "a1", is_acknowledged: true });
  });

  it("getTrends / getHotspots / getAlerts use the right paths", async () => {
    get.mockResolvedValue({ data: [] });
    await getTrends(7);
    expect(get).toHaveBeenCalledWith("/api/v1/intelligence/trends", {
      params: { days: 7 },
    });
    await getHotspots();
    expect(get).toHaveBeenCalledWith("/api/v1/locations/hotspots");
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    await getAlerts();
    expect(get).toHaveBeenCalledWith("/api/v1/intelligence/alerts");
  });
});
