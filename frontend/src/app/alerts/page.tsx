"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { useToast } from "@/hooks/use-toast";
import { useApiResource } from "@/hooks/useApiResource";
import { acknowledgeAlert, getAlerts } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function SummaryCard({
  title,
  value,
  className,
  loading,
}: {
  title: string;
  value: number | string;
  className?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-12 animate-pulse rounded bg-muted" />
        ) : (
          <div className={`text-2xl font-bold ${className ?? ""}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { data, loading, refetch } = useApiResource(getAlerts, []);
  const clearUnread = useAppStore((s) => s.clearUnread);

  // Clear the unread notification badge when this page is visited
  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  const items = data?.items ?? [];
  const count = (p: string) => items.filter((a) => a.priority === p).length;

  const handleBulkAcknowledge = async () => {
    const unacked = items.filter((a) => !a.is_acknowledged);
    if (unacked.length === 0) {
      toast({ title: "Nothing to acknowledge" });
      return;
    }
    await Promise.allSettled(unacked.map((a) => acknowledgeAlert(a.id)));
    toast({
      title: "Alerts acknowledged",
      description: `${unacked.length} alert(s) marked as acknowledged.`,
    });
    refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Total Active Alerts"
          value={data?.total ?? 0}
          className="text-destructive"
          loading={loading}
        />
        <SummaryCard
          title="Critical"
          value={count("critical")}
          className="text-red-600"
          loading={loading}
        />
        <SummaryCard
          title="High"
          value={count("high")}
          className="text-orange-500"
          loading={loading}
        />
        <SummaryCard
          title="Medium"
          value={count("medium")}
          className="text-yellow-500"
          loading={loading}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts by location or type..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
        <Button onClick={handleBulkAcknowledge} className="gap-2">
          <CheckCircle className="h-4 w-4" />
          Acknowledge All
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertCenter searchQuery={searchQuery} />
        </CardContent>
      </Card>
    </div>
  );
}
