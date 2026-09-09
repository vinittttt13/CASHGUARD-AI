"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Zap, AlertCircle } from "lucide-react";
import { cn, formatConfidence } from "@/lib/utils";

const formSchema = z.object({
  complaint_text: z.string().min(10, "Description must be at least 10 characters"),
  complaint_category: z.string().min(1, "Please select a category"),
  state: z.string().min(1, "Please select a state"),
  city: z.string().min(2, "City name must be at least 2 characters"),
  amount_defrauded: z.coerce.number().min(0, "Amount cannot be negative"),
  bank_name: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function PredictionForm() {
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount_defrauded: 0,
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsPredicting(true);
    setPredictionResult(null);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock result
      setPredictionResult({
        riskLevel: "High",
        confidence: 0.84,
        suggestedActions: [
          "Alert local cyber cell",
          "Freeze associated accounts",
          "Monitor IP addresses"
        ]
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row h-full">
      <div className="p-6 md:w-2/3 border-b md:border-b-0 md:border-r flex flex-col h-full overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold tracking-tight">Manual Prediction Tool</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Input complaint details to run the AI prediction model manually.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-medium">Complaint Description</label>
            <textarea 
              {...register("complaint_text")}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Detailed description of the incident..."
            />
            {errors.complaint_text && <span className="text-xs text-red-500">{errors.complaint_text.message}</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select 
                {...register("complaint_category")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select Category...</option>
                <option value="financial">Financial Fraud</option>
                <option value="phishing">Phishing</option>
                <option value="identity_theft">Identity Theft</option>
                <option value="skimming">ATM Skimming</option>
              </select>
              {errors.complaint_category && <span className="text-xs text-red-500">{errors.complaint_category.message}</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bank Name (Optional)</label>
              <input 
                {...register("bank_name")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. State Bank of India"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <select 
                {...register("state")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select State...</option>
                <option value="MH">Maharashtra</option>
                <option value="DL">Delhi</option>
                <option value="KA">Karnataka</option>
                <option value="UP">Uttar Pradesh</option>
              </select>
              {errors.state && <span className="text-xs text-red-500">{errors.state.message}</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">City</label>
              <input 
                {...register("city")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="City Name"
              />
              {errors.city && <span className="text-xs text-red-500">{errors.city.message}</span>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount Defrauded (INR)</label>
              <input 
                type="number"
                {...register("amount_defrauded")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {errors.amount_defrauded && <span className="text-xs text-red-500">{errors.amount_defrauded.message}</span>}
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button 
              type="submit" 
              disabled={isPredicting}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 disabled:opacity-50"
            >
              {isPredicting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Predicting...</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" /> Run Prediction</>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => { reset(); setPredictionResult(null); }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <div className="p-6 md:w-1/3 bg-muted/30 flex flex-col">
        <h3 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          Prediction Result
        </h3>

        {isPredicting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-medium">Analyzing parameters...</p>
          </div>
        ) : predictionResult ? (
          <div className="flex-1 animate-in fade-in zoom-in duration-300">
            <div className={cn(
              "p-4 rounded-lg border text-center mb-6",
              predictionResult.riskLevel === 'High' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            )}>
              <div className="text-xs font-bold uppercase tracking-wider mb-1 text-muted-foreground">Assessed Risk</div>
              <div className={cn(
                "text-3xl font-extrabold mb-1",
                predictionResult.riskLevel === 'High' ? 'text-red-600' : 'text-amber-600'
              )}>
                {predictionResult.riskLevel}
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                Confidence: {formatConfidence(predictionResult.confidence)}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-3">Suggested Actions</h4>
              <ul className="space-y-2">
                {predictionResult.suggestedActions.map((action: string, i: number) => (
                  <li key={i} className="text-sm bg-white border p-2 rounded-md shadow-sm flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">{i+1}</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <Zap className="h-12 w-12 mb-4" />
            <p className="text-sm text-center">Submit the form to generate AI predictions and risk assessment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
