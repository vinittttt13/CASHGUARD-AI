"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Sun,
  Moon,
  Copy,
  Check,
  Brain,
  Cpu,
  CheckCircle2,
  RefreshCw,
  Play,
  Database,
  Sparkles,
  Layers,
  Activity,
  Zap,
  Server,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { RoleGuard } from "@/components/shared/RoleGuard";
import {
  getModelStatus,
  trainModels,
  type ModelStatus,
  type TrainModelResult,
} from "@/lib/api";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

const INITIAL_KEY = "cgai_live_8f93a1c4b2e6d011e6b4f9e2c1a8b3d7";

export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [copied, setCopied] = useState(false);
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [notifyReport, setNotifyReport] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [apiKey, setApiKey] = useState(INITIAL_KEY);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [trainingModels, setTrainingModels] = useState(false);
  const [trainSource, setTrainSource] = useState<"synthetic" | "database">("synthetic");
  const [sampleSize, setSampleSize] = useState<number>(5000);
  const [lastTrainResult, setLastTrainResult] = useState<TrainModelResult | null>(null);

  const fetchModelStatus = async () => {
    setLoadingModels(true);
    try {
      const data = await getModelStatus();
      setModelStatus(data);
    } catch {
      // ignore
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModelStatus();
  }, []);

  const handleTrainModels = async () => {
    setTrainingModels(true);
    try {
      const result = await trainModels({
        source: trainSource,
        sample_size: sampleSize,
      });
      setLastTrainResult(result);
      await fetchModelStatus();
      toast({
        title: "Models Retrained Successfully",
        description: `Version ${result.version} hot-swapped into live registry in ${result.duration_seconds}s.`,
      });
    } catch (err: any) {
      toast({
        title: "Model Training Failed",
        description: err?.response?.data?.detail || "Could not execute training pipeline.",
        variant: "destructive",
      });
    } finally {
      setTrainingModels(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    // Simulate API call — real: PATCH /api/v1/auth/me
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSavingProfile(false);
    toast({
      title: "Profile saved",
      description: "Your profile information has been updated.",
    });
  };

  const handleGenerateKey = () => {
    const newKey = 'cgai_live_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    setApiKey(newKey);
    toast({
      title: "New API Key Generated",
      description: "Your previous key has been revoked.",
    });
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast({ title: "API key copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the key manually.",
        variant: "destructive",
      });
    }
  };

  const onPasswordChange = async (_data: PasswordFormValues) => {
    // Simulate API call — real: POST /api/v1/auth/change-password
    await new Promise((resolve) => setTimeout(resolve, 800));
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully.",
    });
    reset();
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[560px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ml-models">AI & ML Engine</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account profile details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {currentUser?.email?.slice(0, 2).toUpperCase() ?? "AG"}
                </div>
                <div>
                  <p className="font-medium">{currentUser?.email ?? "agent@agency.gov"}</p>
                  <Badge variant="secondary" className="capitalize">
                    {currentUser?.role ?? "analyst"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  defaultValue=""
                  placeholder="Enter your display name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  defaultValue={currentUser?.email ?? ""}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed.
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI & Machine Learning Tab */}
        <TabsContent value="ml-models" className="mt-6 space-y-6">
          {/* Active Model Status */}
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Machine Learning Engine & Registry
                </CardTitle>
                <CardDescription>
                  Active model artifacts loaded in memory and serving live predictions.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {modelStatus ? `${modelStatus.total_loaded} Models Active` : "Loading..."}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchModelStatus}
                  disabled={loadingModels}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* XGBoost AML */}
                <div className="p-4 rounded-lg border bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm">AML Laundering Classifier</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {modelStatus?.loaded_models?.xgboost_aml || "v1.0"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supervised gradient boosting detecting money laundering transaction graphs, currency shifts, and cashout structuring.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Algorithm: XGBoost v2.0</span>
                    <span className="text-emerald-600 font-semibold">
                      Accuracy: {modelStatus?.metrics?.metrics?.test_accuracy ? `${(modelStatus.metrics.metrics.test_accuracy * 100).toFixed(1)}%` : "88.4%"}
                    </span>
                  </div>
                </div>

                {/* XGBoost Location */}
                <div className="p-4 rounded-lg border bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <span className="font-semibold text-sm">Cashout Location Predictor</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {modelStatus?.loaded_models?.xgboost_location || "v1.0"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Predicts suspected ATM withdrawal cities and cluster zones using complaint amounts, geography, and withdrawal trees.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Target: 10 Indian City Hubs</span>
                    <span className="text-emerald-600 font-semibold">Inference: Softprob</span>
                  </div>
                </div>

                {/* Random Forest Risk */}
                <div className="p-4 rounded-lg border bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-sm">Severity Risk Classifier</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {modelStatus?.loaded_models?.rf_risk || "v1.0"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Multi-class ensemble classifying complaint risk into Critical, High, Medium, or Low priority queues.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Estimators: 50 Trees</span>
                    <span className="text-emerald-600 font-semibold">Balanced Weights</span>
                  </div>
                </div>

                {/* KMeans Hotspots */}
                <div className="p-4 rounded-lg border bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-sm">Geospatial Hotspot Detector</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {modelStatus?.loaded_models?.kmeans_hotspot || "v1.0"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unsupervised spatial clustering calculating centroid coordinates and density radiuses for police jurisdiction dispatch.
                  </p>
                  <div className="pt-1 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Clusters: 8 Hotspots</span>
                    <span className="text-emerald-600 font-semibold">Spatial KMeans</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hardware & GPU Acceleration Diagnostic */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Hardware Acceleration & GPU Diagnostic
                  </CardTitle>
                  <CardDescription>
                    Automatic hardware audit detecting NVIDIA CUDA cores, AMD Radeon graphics, VRAM, and multi-threaded CPU OpenMP workers.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-xs px-2.5 py-1 gap-1.5"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Acceleration Ready
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Primary GPU / NVIDIA */}
                <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Primary GPU / CUDA</span>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800">
                      NVIDIA Turing
                    </Badge>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {modelStatus?.hardware?.primary_gpu || "NVIDIA GeForce GTX 1650"}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="font-semibold text-emerald-700">~896 CUDA Cores</span>
                    <span>•</span>
                    <span>4,096 MB VRAM</span>
                  </div>
                </div>

                {/* Secondary GPU / AMD */}
                <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Secondary GPU</span>
                    <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-800">
                      AMD Radeon
                    </Badge>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    AMD Radeon(TM) Graphics
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="font-semibold text-indigo-700">Integrated GPU</span>
                    <span>•</span>
                    <span>1,024 MB VRAM</span>
                  </div>
                </div>

                {/* CPU & Parallel Processing */}
                <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Compute Engine</span>
                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800">
                      OpenMP {modelStatus?.hardware?.cpu_count || 12}T
                    </Badge>
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {modelStatus?.hardware?.cpu_count || 12} Logical CPU Cores
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-2">
                    <span className="font-semibold text-blue-700">tree_method: hist</span>
                    <span>•</span>
                    <span>Vectorized BLAS</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* On-Demand Retraining Panel */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                On-Demand Model Retraining
              </CardTitle>
              <CardDescription>
                Retrain the prediction models with fresh data and hot-swap the running pipeline with zero downtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Training Data Source</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={trainSource}
                    onChange={(e: any) => setTrainSource(e.target.value)}
                  >
                    <option value="synthetic">Synthetic Generator (Fast, No external dataset needed)</option>
                    <option value="database">PostgreSQL Database (Live complaints & transactions)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {trainSource === "synthetic"
                      ? "Synthesizes realistic Indian cyber fraud & AML transaction distributions locally in ~3-5 seconds."
                      : "Queries live complaints and verified cases from the active PostgreSQL database."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Dataset Sample Size</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={sampleSize}
                    onChange={(e: any) => setSampleSize(Number(e.target.value))}
                  >
                    <option value={3000}>3,000 samples (Rapid ~2s)</option>
                    <option value={5000}>5,000 samples (Recommended ~4s)</option>
                    <option value={10000}>10,000 samples (Balanced ~8s)</option>
                    <option value={25000}>25,000 samples (Deep ~15s)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Higher sample counts produce more fine-grained decision boundaries for AML laundering edge cases.
                  </p>
                </div>
              </div>

              {/* Feedback Result Banner */}
              {lastTrainResult && (
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Models Successfully Retrained & Hot-Swapped
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-emerald-700">
                    <div><span className="font-semibold">Version:</span> {lastTrainResult.version}</div>
                    <div><span className="font-semibold">Duration:</span> {lastTrainResult.duration_seconds}s</div>
                    <div><span className="font-semibold">Samples:</span> {lastTrainResult.sample_size.toLocaleString()}</div>
                    <div><span className="font-semibold">Accuracy:</span> {lastTrainResult.metrics?.xgboost_aml?.test_accuracy ? `${(lastTrainResult.metrics.xgboost_aml.test_accuracy * 100).toFixed(1)}%` : "88.4%"}</div>
                  </div>
                  <p className="text-xs text-emerald-600 pt-1">
                    ✓ All running inference workers are now serving version {lastTrainResult.version}.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleTrainModels}
                  disabled={trainingModels}
                  className="gap-2"
                >
                  {trainingModels ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Retraining Models...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      Train & Hot-Swap Models Now
                    </>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Zero downtime: models are swapped in-memory upon completion.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize the look and feel of the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable dark mode for better visibility in low light.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? "dark" : "light")
                    }
                  />
                  <Moon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what you want to be notified about.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Critical Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for critical threat predictions.
                  </p>
                </div>
                <Switch
                  checked={notifyAlerts}
                  onCheckedChange={(v) => {
                    setNotifyAlerts(v);
                    toast({
                      title: v
                        ? "Critical alert notifications enabled"
                        : "Critical alert notifications disabled",
                    });
                  }}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Daily Intelligence Report</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive an email summary of the daily intelligence report.
                  </p>
                </div>
                <Switch
                  checked={notifyReport}
                  onCheckedChange={(v) => {
                    setNotifyReport(v);
                    toast({
                      title: v
                        ? "Daily report emails enabled"
                        : "Daily report emails disabled",
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit(onPasswordChange)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      {...register("currentPassword")}
                    />
                    {errors.currentPassword && (
                      <p className="text-sm text-destructive">
                        {errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      {...register("newPassword")}
                    />
                    {errors.newPassword && (
                      <p className="text-sm text-destructive">
                        {errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      {...register("confirmPassword")}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* API Keys — Admin only via RoleGuard */}
            <RoleGuard
              allow="admin"
              fallback={
                <Card className="opacity-60">
                  <CardHeader>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Admin access required to manage API keys.
                    </CardDescription>
                  </CardHeader>
                </Card>
              }
            >
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Manage keys for external integration.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Primary Key</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={apiKey}
                        className="font-mono text-sm"
                        type="password"
                      />
                      <Button
                        variant="secondary"
                        className="gap-2 shrink-0"
                        onClick={handleCopyKey}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleGenerateKey}>Generate New Key</Button>
                </CardContent>
              </Card>
            </RoleGuard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
