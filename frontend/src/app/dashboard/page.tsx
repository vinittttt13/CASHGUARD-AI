"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PredictiveMap } from "@/components/dashboard/predictive-map";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { ComplaintFeed } from "@/components/dashboard/complaint-feed";
import { PredictionPanel } from "@/components/dashboard/prediction-panel";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <StatsOverview />
      
      <div className="grid gap-6 md:grid-cols-[60%_40%] xl:grid-cols-[65%_35%]">
        {/* Left Column - Map */}
        <Card className="flex flex-col min-h-[500px]">
          <CardHeader>
            <CardTitle>Live Predictive Map</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
            <div className="absolute inset-0 m-6 mt-0 border rounded-md overflow-hidden bg-muted/50 flex items-center justify-center">
              <PredictiveMap />
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Feed & Predictions */}
        <div className="flex flex-col gap-6 h-full">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Threat Predictions</CardTitle>
            </CardHeader>
            <CardContent>
               <PredictionPanel />
            </CardContent>
          </Card>
          
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Recent Complaints</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
               <ComplaintFeed />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
