import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const loginUser = vi.fn();
vi.mock("@/lib/api", () => ({ loginUser: (...a: unknown[]) => loginUser(...a) }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  async function fillAndSubmit() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "agent@agency.gov");
    await user.type(screen.getByLabelText(/password/i), "supersecret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
  }

  it("calls loginUser, stores tokens and navigates on success", async () => {
    loginUser.mockResolvedValue({
      access_token: "acc",
      refresh_token: "ref",
    });
    render(<LoginPage />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(loginUser).toHaveBeenCalledWith({
        email: "agent@agency.gov",
        password: "supersecret",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(localStorage.getItem("accessToken")).toBe("acc");
    expect(localStorage.getItem("refreshToken")).toBe("ref");
  });

  it("shows a destructive toast and stays on the page on 401", async () => {
    loginUser.mockRejectedValue({ response: { status: 401 } });
    render(<LoginPage />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem("accessToken")).toBeNull();
  });
});
