"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loginUser } from "@/lib/api";
import { setToken, setRefreshToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
        description: "Welcome to the Cybercrime Analytics Dashboard.",
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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <ShieldAlert className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Cybercrime Analytics
          </CardTitle>
          <CardDescription>
            Enter your credentials to access the intelligence dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@agency.gov"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button variant="link" className="px-0 h-auto font-normal text-xs" type="button">
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                {...register("password")}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs text-slate-600 hover:text-slate-900 border-dashed"
                onClick={() => {
                  setValue("email", "admin@cpaf.gov.in");
                  setValue("password", "admin123");
                }}
              >
                Auto-Fill Demo Admin (admin@cpaf.gov.in)
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 text-center text-sm text-muted-foreground">
          Secure Government Access Only
        </CardFooter>
      </Card>
    </div>
  );
}
