import { useAppStore } from "@/store/useAppStore";

describe("NotificationBell / Store", () => {
  test("addAlert increments unreadCount", () => {
    const store = useAppStore.getState();
    store.clearUnread?.();
    store.markAllRead?.();
    store.addAlert({
      id: "1",
      title: "Test Alert",
      description: "Test Description",
      priority: "high",
      timestamp: new Date().toISOString(),
    } as any);
    expect(useAppStore.getState().unreadCount).toBeGreaterThan(0);
  });

  test("setSoundEnabled toggles sound preference", () => {
    const store = useAppStore.getState();
    store.setSoundEnabled(false);
    expect(useAppStore.getState().soundEnabled).toBe(false);
    store.setSoundEnabled(true);
    expect(useAppStore.getState().soundEnabled).toBe(true);
  });
});
