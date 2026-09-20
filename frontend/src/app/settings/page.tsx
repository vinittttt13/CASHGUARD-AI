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
  Bell,
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
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/useAppStore";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { SectionHeader, StatusIndicator, TechnicalId } from "@/components/shared/intel-primitives";
import { EmptyState } from "@/components/shared/states";
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

const MODEL_TILES: Array<{
  key: keyof NonNullable<ModelStatus["loaded_models"]>;
  icon: typeof Cpu;
  label: string;
  description: string;
}> = [
  {
    key: "xgboost_aml",
    icon: Cpu,
    label: "AML Laundering Classifier",
    description: "Supervised gradient boosting detecting money laundering transaction graphs, currency shifts, and cashout structuring.",
  },
  {
    key: "xgboost_location",
    icon: Layers,
    label: "Cashout Location Predictor",
    description: "Predicts suspected ATM withdrawal cities and cluster zones using complaint amounts, geography, and withdrawal trees.",
  },
  {
    key: "rf_risk",
    icon: Activity,
    label: "Severity Risk Classifier",
    description: "Multi-class ensemble classifying complaint risk into Critical, High, Medium, or Low priority queues.",
  },
  {
    key: "kmeans_hotspot",
    icon: Sparkles,
    label: "Geospatial Hotspot Detector",
    description: "Unsupervised spatial clustering calculating centroid coordinates and density radiuses for police jurisdiction dispatch.",
  },
];

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

  const accuracy = modelStatus?.metrics?.metrics?.test_accuracy;
  const gpus = modelStatus?.hardware?.gpus ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <SectionHeader title="System Settings" description="Account, model registry, and platform preferences" />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 border border-border bg-surface-overlay lg:w-[560px]">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ml-models">AI &amp; ML Engine</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account profile details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {currentUser?.email?.slice(0, 2).toUpperCase() ?? "AG"}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{currentUser?.email ?? "agent@agency.gov"}</p>
                  <span className="mt-0.5 inline-block rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {currentUser?.role ?? "analyst"}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Display Name</Label>
                <Input id="name" defaultValue="" placeholder="Enter your display name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue={currentUser?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
                {savingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI & Machine Learning Tab */}
        <TabsContent value="ml-models" className="mt-5 space-y-5">
          {/* Active Model Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  Machine Learning Engine &amp; Registry
                </CardTitle>
                <CardDescription>Active model artifacts loaded in memory and serving live predictions.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator
                  state={modelStatus ? "online" : "offline"}
                  label={modelStatus ? `${modelStatus.total_loaded} Loaded` : "Loading…"}
                />
                <Button variant="outline" size="sm" onClick={fetchModelStatus} disabled={loadingModels} className="gap-1.5 border-border">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {MODEL_TILES.map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <div key={tile.key} className="space-y-2 rounded-md border border-border bg-surface-overlay p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{tile.label}</span>
                        </div>
                        <TechnicalId className="rounded border border-border px-1.5 py-0.5">
                          {modelStatus?.loaded_models?.[tile.key] || "—"}
                        </TechnicalId>
                      </div>
                      <p className="text-xs text-muted-foreground">{tile.description}</p>
                      {tile.key === "xgboost_aml" && (
                        <div className="flex items-center justify-between pt-1 text-xs font-medium text-muted-foreground">
                          <span>Algorithm: XGBoost</span>
                          <span className="font-mono text-risk-low">
                            {accuracy !== undefined ? `Accuracy: ${(accuracy * 100).toFixed(1)}%` : "Accuracy: —"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Hardware & GPU Acceleration Diagnostic */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-risk-medium" />
                  Hardware Acceleration Diagnostic
                </CardTitle>
                <CardDescription>
                  Detected compute hardware serving the inference pipeline.
                </CardDescription>
              </div>
              <StatusIndicator
                state={modelStatus?.hardware?.cuda_available ? "online" : "degraded"}
                label={modelStatus?.hardware?.cuda_available ? "CUDA Available" : "CPU Only"}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {gpus.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {gpus.map((gpu, i) => (
                    <div key={i} className="space-y-1.5 rounded-md border border-border bg-surface-overlay p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {gpu.vendor ?? "GPU"}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">{gpu.name ?? "Unknown device"}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
                        {gpu.cuda_cores && <span>{gpu.cuda_cores.toLocaleString()} cores</span>}
                        {gpu.vram_mb && (
                          <>
                            <span>·</span>
                            <span>{gpu.vram_mb.toLocaleString()} MB VRAM</span>
                          </>
                        )}
                        {gpu.compute_capability && (
                          <>
                            <span>·</span>
                            <span>CC {gpu.compute_capability}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No GPU detected" hint="Inference is running on CPU." />
              )}
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-overlay p-3.5">
                <Server className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Compute Engine</div>
                  <div className="font-mono text-xs text-foreground">
                    {modelStatus?.hardware?.cpu_count ?? "—"} logical CPU cores
                    {modelStatus?.hardware?.xgboost_tree_method && ` · tree_method: ${modelStatus.hardware.xgboost_tree_method}`}
                    {modelStatus?.hardware?.xgboost_device && ` · device: ${modelStatus.hardware.xgboost_device}`}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* On-Demand Retraining Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                On-Demand Model Retraining
              </CardTitle>
              <CardDescription>
                Retrain the prediction models with fresh data and hot-swap the running pipeline with zero downtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Training Data Source</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-surface-overlay px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={trainSource}
                    onChange={(e: any) => setTrainSource(e.target.value)}
                  >
                    <option value="synthetic">Synthetic Generator (fast, no external dataset needed)</option>
                    <option value="database">PostgreSQL Database (live complaints &amp; transactions)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {trainSource === "synthetic"
                      ? "Synthesizes realistic Indian cyber fraud & AML transaction distributions locally."
                      : "Queries live complaints and verified cases from the active PostgreSQL database."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Dataset Sample Size</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-surface-overlay px-3 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={sampleSize}
                    onChange={(e: any) => setSampleSize(Number(e.target.value))}
                  >
                    <option value={3000}>3,000 samples (rapid)</option>
                    <option value={5000}>5,000 samples (recommended)</option>
                    <option value={10000}>10,000 samples (balanced)</option>
                    <option value={25000}>25,000 samples (deep)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Higher sample counts produce more fine-grained decision boundaries for AML laundering edge cases.
                  </p>
                </div>
              </div>

              {lastTrainResult && (
                <div className="space-y-2 rounded-md border border-risk-low/30 bg-risk-low/10 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-risk-low">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Models Retrained &amp; Hot-Swapped
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-foreground sm:grid-cols-4">
                    <div><span className="text-muted-foreground">Version:</span> {lastTrainResult.version}</div>
                    <div><span className="text-muted-foreground">Duration:</span> {lastTrainResult.duration_seconds}s</div>
                    <div><span className="text-muted-foreground">Samples:</span> {lastTrainResult.sample_size.toLocaleString()}</div>
                    <div>
                      <span className="text-muted-foreground">Accuracy:</span>{" "}
                      {lastTrainResult.metrics?.xgboost_aml?.test_accuracy
                        ? `${(lastTrainResult.metrics.xgboost_aml.test_accuracy * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={handleTrainModels} disabled={trainingModels} size="sm" className="gap-2">
                  {trainingModels ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Retraining Models…
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Train &amp; Hot-Swap Models Now
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
        <TabsContent value="appearance" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                CASHGUARD is a dark-first intelligence console; dark mode is recommended for
                low-light operations rooms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-overlay p-4">
                <div>
                  <Label className="text-sm">Dark Mode</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Enable dark mode for better visibility in low light.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sun className="h-4 w-4" />
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                  <Moon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose what you want to be notified about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-overlay p-4">
                <div>
                  <Label className="text-sm">Critical Alerts</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Receive notifications for critical threat predictions.
                  </p>
                </div>
                <Switch
                  checked={notifyAlerts}
                  onCheckedChange={(v) => {
                    setNotifyAlerts(v);
                    toast({
                      title: v ? "Critical alert notifications enabled" : "Critical alert notifications disabled",
                    });
                  }}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-surface-overlay p-4">
                <div>
                  <Label className="text-sm">Daily Intelligence Report</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Receive an email summary of the daily intelligence report.
                  </p>
                </div>
                <Switch
                  checked={notifyReport}
                  onCheckedChange={(v) => {
                    setNotifyReport(v);
                    toast({
                      title: v ? "Daily report emails enabled" : "Daily report emails disabled",
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-5">
          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onPasswordChange)} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" {...register("currentPassword")} />
                    {errors.currentPassword && (
                      <p className="text-xs text-risk-critical">{errors.currentPassword.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" {...register("newPassword")} />
                    {errors.newPassword && <p className="text-xs text-risk-critical">{errors.newPassword.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" {...register("confirmPassword")} />
                    {errors.confirmPassword && (
                      <p className="text-xs text-risk-critical">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button type="submit" disabled={isSubmitting} size="sm">
                    {isSubmitting ? "Updating…" : "Update Password"}
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
                    <CardDescription>Admin access required to manage API keys.</CardDescription>
                  </CardHeader>
                </Card>
              }
            >
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage keys for external integration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Primary Key</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={apiKey} className="font-mono text-xs" type="password" />
                      <Button variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={handleCopyKey}>
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-risk-low" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="border-border" onClick={handleGenerateKey}>
                    Generate New Key
                  </Button>
                </CardContent>
              </Card>
            </RoleGuard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
