"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldHalf, KeyRound, Radar, Database, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loginUser } from "@/lib/api";
import { setToken, setRefreshToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusIndicator } from "@/components/shared/intel-primitives";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const res = await loginUser({ email: data.email, password: data.password });
      setToken(res.access_token);
      if (res.refresh_token) {
        setRefreshToken(res.refresh_token);
      }

      toast({
        title: "Login Successful",
        description: "Welcome to the CASHGUARD intelligence platform.",
      });
      router.push("/dashboard");
    } catch (error: any) {
      const status = error?.response?.status;
      toast({
        title: "Login Failed",
        description:
          status === 401
            ? "Invalid credentials. Please try again."
            : "Unable to reach the authentication service. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      {/* Left: Branding / mission */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ShieldHalf className="h-4.5 w-4.5" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-foreground">
              CASHGUARD <span className="text-primary">AI</span>
            </span>
          </div>

          <div className="mt-20 max-w-md">
            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-foreground">
              Financial cyber intelligence, in real time.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Predictive analytics, geospatial threat mapping, and explainable AI for
              cybercrime investigation and financial fraud intelligence teams.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Radar className="h-3.5 w-3.5 text-primary" />
            Real-time hotspot &amp; ATM cash-out prediction
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary" />
            Explainable model scoring for every incident
          </div>
          <div className="mt-6 flex items-center gap-4 border-t border-border pt-4">
            <StatusIndicator state="online" label="System Status: Operational" />
          </div>
        </div>
      </div>

      {/* Right: Auth panel */}
      <div className="flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ShieldHalf className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              CASHGUARD <span className="text-primary">AI</span>
            </span>
          </div>

          <div className="mb-6">
            <h2 className="text-base font-semibold text-foreground">Secure Sign-In</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Authorized personnel only. Access is logged and audited.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@agency.gov"
                className="border-border bg-surface-overlay text-sm"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && <p className="text-xs text-risk-critical">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Password
                </Label>
                <Button variant="link" className="h-auto px-0 text-xs font-normal text-primary" type="button">
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                className="border-border bg-surface-overlay text-sm"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-risk-critical">{errors.password.message}</p>}
            </div>
            <Button className="w-full gap-2" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border-strong py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-overlay hover:text-foreground"
              onClick={() => {
                setValue("email", "admin@cpaf.gov.in");
                setValue("password", "admin123");
              }}
            >
              Auto-Fill Demo Admin (admin@cpaf.gov.in)
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4 text-[10px] label-caps text-subtle-foreground">
            <KeyRound className="h-3 w-3" />
            Secure Authentication · JWT Session
          </div>
        </div>
      </div>
    </div>
  );
}
