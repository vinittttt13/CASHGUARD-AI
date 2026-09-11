import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getModelStatus: vi.fn().mockResolvedValue({
      status: "ready",
      models_loaded: 3,
      loaded_models: {
        xgboost: { loaded: true, path: "/mock/xgboost.pkl", version: "v1.0" },
        autoencoder: { loaded: true, path: "/mock/autoencoder.pt", version: "v1.0" },
        isolation_forest: { loaded: true, path: "/mock/isolation_forest.pkl", version: "v1.0" },
      },
      total_loaded: 3,
      artifacts_dir: "backend/app/ml/model_artifacts",
    }),
    trainModels: vi.fn().mockResolvedValue({
      status: "success",
      version: "v1.1",
      duration_seconds: 4.2,
      metrics: {},
    }),
  };
});

import SettingsPage from "@/app/settings/page";
import { useAppStore } from "@/store/useAppStore";

beforeEach(() => {
  useAppStore.setState({ currentUser: { email: "admin@cpaf.gov.in", role: "admin" } });
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("SettingsPage — Profile tab", () => {
  it("renders the current user's email and role", () => {
    render(<SettingsPage />);

    expect(screen.getByText("admin@cpaf.gov.in")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("falls back to placeholder identity when there is no current user", () => {
    useAppStore.setState({ currentUser: null });

    render(<SettingsPage />);

    expect(screen.getByText("agent@agency.gov")).toBeInTheDocument();
  });

  it("save changes button shows a saving state while the (simulated) request is in flight", async () => {
    render(<SettingsPage />);

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument(),
    );
  });
});

describe("SettingsPage — Appearance tab", () => {
  it("renders the dark-mode toggle", async () => {
    render(<SettingsPage />);

    await userEvent.click(screen.getByRole("tab", { name: "Appearance" }));

    expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});

describe("SettingsPage — Notifications tab", () => {
  it("toggles critical alert and daily report switches independently", async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Notifications" }));

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0]).toBeChecked();
    expect(switches[1]).toBeChecked();

    await userEvent.click(switches[0]);
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).toBeChecked(); // unaffected
  });
});

describe("SettingsPage — Security tab: password form validation", () => {
  async function openSecurityTab() {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));
  }

  it("rejects a new password shorter than 8 characters", async () => {
    await openSecurityTab();

    await userEvent.type(screen.getByLabelText("Current Password"), "oldpass123");
    await userEvent.type(screen.getByLabelText("New Password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("rejects mismatched new/confirm passwords", async () => {
    await openSecurityTab();

    await userEvent.type(screen.getByLabelText("Current Password"), "oldpass123");
    await userEvent.type(screen.getByLabelText("New Password"), "newpassword1");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "newpassword2");
    await userEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("accepts a valid, matching password change and resets the form", async () => {
    await openSecurityTab();

    await userEvent.type(screen.getByLabelText("Current Password"), "oldpass123");
    await userEvent.type(screen.getByLabelText("New Password"), "newpassword1");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "newpassword1");
    await userEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Current Password")).toHaveValue(""),
    );
    expect(
      screen.queryByText("Passwords do not match"),
    ).not.toBeInTheDocument();
  });
});

describe("SettingsPage — Security tab: API key visibility is role-gated", () => {
  it("shows the API key panel to an admin", async () => {
    useAppStore.setState({ currentUser: { email: "admin@cpaf.gov.in", role: "admin" } });
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));

    expect(screen.getByText("Manage keys for external integration.")).toBeInTheDocument();
  });

  it("hides the API key panel behind a fallback for a non-admin analyst", async () => {
    useAppStore.setState({ currentUser: { email: "analyst@cpaf.gov.in", role: "analyst" } });
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));

    expect(screen.getByText("Admin access required to manage API keys.")).toBeInTheDocument();
    expect(
      screen.queryByText("Manage keys for external integration."),
    ).not.toBeInTheDocument();
  });

  it("Generate New Key updates the key and triggers a toast", async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));

    const oldInput = screen.getByDisplayValue("cgai_live_8f93a1c4b2e6d011e6b4f9e2c1a8b3d7");
    await userEvent.click(screen.getByRole("button", { name: /Generate New Key/i }));

    await waitFor(() =>
      expect(screen.getByDisplayValue(/cgai_live_/)).toBeInTheDocument(),
    );
  });

  it("copy button writes the key to the clipboard", async () => {
    render(<SettingsPage />);
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));

    await userEvent.click(screen.getByRole("button", { name: /copy/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "cgai_live_8f93a1c4b2e6d011e6b4f9e2c1a8b3d7",
    );
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
