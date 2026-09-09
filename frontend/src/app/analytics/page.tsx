"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { TimeSeriesChart } from "@/components/analytics/time-series-chart";
import { GeographicDistribution } from "@/components/analytics/geographic-distribution";
import { ConfidenceGauge } from "@/components/analytics/confidence-gauge";
import { FeatureImportanceRadar } from "@/components/analytics/feature-importance-radar";
import { HotspotTable } from "@/components/analytics/hotspot-table";

export default function AnalyticsPage() {
  const [date, setDate] = useState<Date>();

  return (
    <div className="flex flex-col gap-6">
      {/* Filters / Date Picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Advanced Analytics</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date range</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Row */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Crime Volume Time Series</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <TimeSeriesChart data={[]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Confidence</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ConfidenceGauge score={85} sampleSize={1200} />
          </CardContent>
        </Card>

        {/* Middle Row */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Importance</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <FeatureImportanceRadar data={[]} />
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             <GeographicDistribution data={[]} />
          </CardContent>
        </Card>

        {/* Bottom Row */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Predicted Hotspots Database</CardTitle>
          </CardHeader>
          <CardContent>
            <HotspotTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
