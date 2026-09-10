import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiResource } from "@/hooks/useApiResource";

describe("useApiResource", () => {
  it("resolves data and clears loading", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: 1 });
    const { result } = renderHook(() => useApiResource(fetcher, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ ok: 1 });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("surfaces errors instead of throwing", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useApiResource(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.data).toBeUndefined();
  });

  it("refetch re-invokes the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue("v");
    const { result } = renderHook(() => useApiResource(fetcher, []));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.refetch());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("does not call the fetcher when enabled is false", async () => {
    const fetcher = vi.fn().mockResolvedValue("v");
    const { result } = renderHook(() =>
      useApiResource(fetcher, [], { enabled: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("re-fetches when deps change", async () => {
    const fetcher = vi.fn().mockResolvedValue("v");
    const { rerender } = renderHook(({ id }) => useApiResource(fetcher, [id]), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    rerender({ id: 2 });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
