"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { predictAmlTransaction } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AmlTransactionResponse, RiskLevel } from "@/types";

const PAYMENT_FORMATS = ["Cash", "Cheque", "ACH", "Credit Card", "Wire", "Bitcoin", "Reinvestment"];
const CURRENCIES = ["US Dollar", "Euro", "UK Pound", "Rupee", "Yen", "Bitcoin", "Yuan"];

const formSchema = z.object({
  amount_paid: z.coerce.number().min(0, "Amount must be zero or greater"),
  payment_format: z.string().min(1),
  payment_currency: z.string().min(1),
  from_bank: z.string().optional(),
  to_bank: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const RISK_STYLES: Record<RiskLevel, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

// Sourced from backend/app/ml/model_artifacts/xgboost_aml_metrics.json — a
// real, measured evaluation on a held-out test set, not a marketing number.
// Recall is high but precision is genuinely low: most flagged transactions
// are false positives, and that tradeoff is stated here deliberately rather
// than only showing the flattering recall figure.
const MODEL_METRICS = {
  recall: 0.8998,
  precision: 0.4568,
  rocAuc: 0.9847,
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function AmlTransactionPanel() {
  const { toast } = useToast();
  const [result, setResult] = useState<AmlTransactionResponse | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const formMethods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount_paid: 0,
      payment_format: "Wire",
      payment_currency: "US Dollar",
    },
  });
  const { register, handleSubmit, reset: resetForm, setValue, formState: { errors, isSubmitting } } = formMethods;

  const onSubmit = async (data: FormValues) => {
    try {
      const res = await predictAmlTransaction({
        amount_paid: data.amount_paid,
        payment_format: data.payment_format,
        payment_currency: data.payment_currency,
        receiving_currency: data.payment_currency,
        from_bank: data.from_bank || undefined,
        to_bank: data.to_bank || undefined,
      });
      setResult(res);
    } catch {
      toast({
        title: "AML analysis failed",
        description: "Could not reach the prediction service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const SCENARIOS = [
    {
      label: "🔴 Scenario 1: ATM Smurfing / High-Risk Cash Out",
      values: { amount_paid: 485000, payment_format: "Cash", payment_currency: "Rupee", from_bank: "Unknown Bank", to_bank: "State Bank of India" },
    },
    {
      label: "🟠 Scenario 2: Cross-Border Crypto Laundering",
      values: { amount_paid: 1250000, payment_format: "Bitcoin", payment_currency: "Bitcoin", from_bank: "Offshore Bank Ltd", to_bank: "Local Exchange" },
    },
    {
      label: "🟢 Scenario 3: Normal Corporate Payroll (Low Risk)",
      values: { amount_paid: 45000, payment_format: "ACH", payment_currency: "Rupee", from_bank: "HDFC Bank", to_bank: "ICICI Bank" },
    },
  ];

  const loadScenario = (scenario: typeof SCENARIOS[0]) => {
    setValue("amount_paid", scenario.values.amount_paid);
    setValue("payment_format", scenario.values.payment_format);
    setValue("payment_currency", scenario.values.payment_currency);
    setValue("from_bank", scenario.values.from_bank);
    setValue("to_bank", scenario.values.to_bank);
    setResult(null);
    toast({ title: "Scenario loaded", description: scenario.label });
  };

  const isHeuristic = result?.model_name === "heuristic_aml_fallback";

  return (
    <div className="grid gap-6 md:grid-cols-5">
      <form onSubmit={handleSubmit(onSubmit)} className="md:col-span-3 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Quick Test Scenario</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <Button key={s.label} type="button" variant="outline" size="sm" onClick={() => loadScenario(s)}>
              {s.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount_paid">Amount Paid</Label>
            <Input
              id="amount_paid"
              type="number"
              step="0.01"
              {...register("amount_paid")}
            />
            {errors.amount_paid && (
              <p className="text-xs text-destructive">{errors.amount_paid.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_currency">Currency</Label>
            <select id="payment_currency" className={selectClass} {...register("payment_currency")}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_format">Payment Format</Label>
            <select id="payment_format" className={selectClass} {...register("payment_format")}>
              {PAYMENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from_bank">From Bank (optional)</Label>
            <Input id="from_bank" placeholder="e.g. 012" {...register("from_bank")} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="to_bank">To Bank (optional)</Label>
            <Input id="to_bank" placeholder="e.g. 020" {...register("to_bank")} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" /> Analyze Transaction
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              setResult(null);
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <div className="md:col-span-2 rounded-lg border bg-muted/20 p-4 flex flex-col">
        {!result ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground text-sm py-8">
            <ShieldCheck className="h-10 w-10 mb-3 opacity-40" />
            Submit a transaction to see its AML risk assessment.
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={cn(
                "rounded-md border p-3 text-center",
                RISK_STYLES[result.risk_level],
              )}
            >
              <div className="text-xs font-bold uppercase tracking-wider">Risk Level</div>
              <div className="text-2xl font-extrabold">{result.risk_level.toUpperCase()}</div>
              <div className="text-xs mt-1">
                {result.is_laundering ? "Flagged as suspicious" : "Not flagged"} ·{" "}
                {(result.laundering_probability * 100).toFixed(1)}% probability
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Model used</span>
              {isHeuristic ? (
                <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Heuristic fallback (model unavailable)
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {result.model_name} · {result.model_version}
                </Badge>
              )}
            </div>

            {result.top_factors.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Top contributing factors
                </div>
                <ul className="space-y-1">
                  {result.top_factors.slice(0, 5).map((f) => (
                    <li key={f.factor} className="text-xs flex justify-between">
                      <span>{f.factor}</span>
                      <span className="text-muted-foreground">{(f.weight * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowMetrics((v) => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Info className="h-3 w-3" />
              {showMetrics ? "Hide" : "About"} this model&apos;s accuracy
            </button>
            {showMetrics && (
              <div className="text-xs text-muted-foreground bg-background rounded border p-2 space-y-1">
                <p>
                  Measured on a held-out test set: <strong>{(MODEL_METRICS.recall * 100).toFixed(0)}% recall</strong>,{" "}
                  <strong>{(MODEL_METRICS.precision * 100).toFixed(1)}% precision</strong> (ROC-AUC{" "}
                  {MODEL_METRICS.rocAuc.toFixed(3)}).
                </p>
                <p>
                  The model catches most real laundering cases, but roughly 2 in 3 transactions
                  it flags turn out to be false positives — treat a &ldquo;flagged&rdquo; result as
                  a signal for human review, not a final verdict.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
