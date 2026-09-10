import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { setToken } from "@/lib/auth";

class MockWS {
  static instances: MockWS[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen: ((e: any) => void) | null = null;
  onclose: ((e: any) => void) | null = null;
  onmessage: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  constructor(public url: string) {
    MockWS.instances.push(this);
  }
  send = vi.fn();
  close = vi.fn();
  fireClose(code = 1006) {
    this.onclose?.({ code });
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWS.instances = [];
    localStorage.clear();
    (globalThis as any).WebSocket = MockWS as any;
  });

  it("does not open a socket without a token", () => {
    renderHook(() => useWebSocket());
    expect(MockWS.instances.length).toBe(0);
  });

  it("connects to the live-feed endpoint with the token in the query", () => {
    setToken("jwt-123");
    renderHook(() => useWebSocket());
    expect(MockWS.instances.length).toBe(1);
    expect(MockWS.instances[0].url).toContain("/api/v1/ws/live-feed");
    expect(MockWS.instances[0].url).toContain("token=jwt-123");
  });

  it("stops reconnecting after 5 attempts within a burst (dead-letter)", () => {
    setToken("jwt-123");
    renderHook(() => useWebSocket());

    // Each abnormal close schedules a reconnect; advancing timers opens the
    // next socket. After the 5th retry the hook gives up for this burst.
    for (let i = 0; i < 6; i++) {
      const latest = MockWS.instances[MockWS.instances.length - 1];
      act(() => {
        latest.fireClose(1006);
        vi.advanceTimersByTime(30000);
      });
    }
    // 1 initial socket + at most 5 retries.
    expect(MockWS.instances.length).toBe(6);
  });
});
