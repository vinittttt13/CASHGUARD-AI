import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const api = vi.hoisted(() => ({
  predictAmlTransaction: vi.fn(),
}));
vi.mock("@/lib/api", () => api);

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { AmlTransactionPanel } from "@/components/analytics/aml-transaction-panel";

beforeEach(() => {
  api.predictAmlTransaction.mockReset();
  toastMock.mockReset();
});

describe("AmlTransactionPanel", () => {
  it("renders the empty state before any submission", () => {
    render(<AmlTransactionPanel />);
    expect(
      screen.getByText(/Submit a transaction to see its AML risk assessment/i),
    ).toBeInTheDocument();
  });

  it("submits the form and displays a real XGBoost result", async () => {
    api.predictAmlTransaction.mockResolvedValue({
      is_laundering: 1,
      laundering_probability: 0.87,
      risk_level: "critical",
      decision_threshold: 0.5,
      top_factors: [
        { factor: "is_cashout_format", weight: 0.37 },
        { factor: "payment_format_code", weight: 0.33 },
      ],
      model_name: "xgboost_aml",
      model_version: "v1.0",
    });

    render(<AmlTransactionPanel />);
    await userEvent.type(screen.getByLabelText("Amount Paid"), "50000");
    await userEvent.click(screen.getByRole("button", { name: /analyze transaction/i }));

    await waitFor(() => expect(screen.getByText("CRITICAL")).toBeInTheDocument());
    expect(screen.getByText(/87\.0% probability/)).toBeInTheDocument();
    expect(screen.getByText(/xgboost_aml/)).toBeInTheDocument();
    // Never labeled as a fallback when the real model produced the result.
    expect(screen.queryByText(/Heuristic fallback/i)).not.toBeInTheDocument();
    expect(screen.getByText("is cashout format")).toBeInTheDocument();
  });

  it("clearly labels a heuristic-fallback result — never disguises it as XGBoost", async () => {
    api.predictAmlTransaction.mockResolvedValue({
      is_laundering: 0,
      laundering_probability: 0.2,
      risk_level: "medium",
      decision_threshold: 0.5,
      top_factors: [],
      model_name: "heuristic_aml_fallback",
      model_version: "v1.0-fallback",
    });

    render(<AmlTransactionPanel />);
    await userEvent.type(screen.getByLabelText("Amount Paid"), "1000");
    await userEvent.click(screen.getByRole("button", { name: /analyze transaction/i }));

    await waitFor(() =>
      expect(screen.getByText(/Heuristic fallback \(model unavailable\)/i)).toBeInTheDocument(),
    );
  });

  it("shows a destructive toast when the API call fails", async () => {
    api.predictAmlTransaction.mockRejectedValue(new Error("network down"));

    render(<AmlTransactionPanel />);
    await userEvent.type(screen.getByLabelText("Amount Paid"), "1000");
    await userEvent.click(screen.getByRole("button", { name: /analyze transaction/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("rejects a negative amount before calling the API", async () => {
    render(<AmlTransactionPanel />);
    const amountInput = screen.getByLabelText("Amount Paid");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "-100");
    await userEvent.click(screen.getByRole("button", { name: /analyze transaction/i }));

    expect(
      await screen.findByText("Amount must be zero or greater"),
    ).toBeInTheDocument();
    expect(api.predictAmlTransaction).not.toHaveBeenCalled();
  });

  it("expandable model-accuracy section shows the honest precision/recall tradeoff", async () => {
    api.predictAmlTransaction.mockResolvedValue({
      is_laundering: 0,
      laundering_probability: 0.05,
      risk_level: "low",
      decision_threshold: 0.5,
      top_factors: [],
      model_name: "xgboost_aml",
      model_version: "v1.0",
    });

    render(<AmlTransactionPanel />);
    await userEvent.type(screen.getByLabelText("Amount Paid"), "500");
    await userEvent.click(screen.getByRole("button", { name: /analyze transaction/i }));
    await waitFor(() => expect(screen.getByText("LOW")).toBeInTheDocument());

    await userEvent.click(screen.getByText(/About this model's accuracy/i));

    expect(screen.getByText(/false positives/i)).toBeInTheDocument();
    expect(screen.getByText(/90% recall/i)).toBeInTheDocument();
  });

  it("reset clears the result and returns to the empty state", async () => {
    api.predictAmlTransaction.mockResolvedValue({
      is_laundering: 0,
      laundering_probability: 0.1,
      risk_level: "low",
      decision_threshold: 0.5,
      top_factors: [],
      model_name: "xgboost_aml",
      model_version: "v1.0",
    });

    render(<AmlTransactionPanel />);
    await userEvent.type(screen.getByLabelText("Amount Paid"), "500");
    await userEvent.click(screen.getByRole("button", { name: /analyze transaction/i }));
    await waitFor(() => expect(screen.getByText("LOW")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(
      screen.getByText(/Submit a transaction to see its AML risk assessment/i),
    ).toBeInTheDocument();
  });
});
