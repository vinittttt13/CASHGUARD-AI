"use client";

import * as React from "react";
import { AlertTriangle, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

const swatches: { name: string; cls: string; note: string }[] = [
  { name: "Charcoal", cls: "bg-background border border-border", note: "background" },
  { name: "Surface", cls: "bg-surface border border-border", note: "surface" },
  { name: "Surface raised", cls: "bg-surface-raised border border-border", note: "surface-raised" },
  { name: "Bone", cls: "bg-foreground", note: "foreground" },
  { name: "Ash", cls: "bg-ash", note: "muted text" },
  { name: "Hairline", cls: "bg-hairline", note: "borders" },
  { name: "Flare", cls: "bg-flare", note: "risk-critical / alerts" },
  { name: "Amber", cls: "bg-risk-review", note: "risk-review" },
  { name: "Verified", cls: "bg-verified", note: "risk-clear" },
];

export default function DesignSystemPage() {
  const { toast } = useToast();

  return (
    <div className="min-h-screen px-6 py-10 text-foreground sm:px-10">
      <header className="mb-12 flex items-start justify-between border-b border-border pb-6">
        <div>
          <p className="label-caps text-xs text-muted-foreground">internal — not linked in nav</p>
          <h1 className="mt-1 font-serif text-4xl italic">Design System</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Tokens and components for the CASHGUARD-AI command-center identity. Reference this
            page instead of eyeballing colors/spacing against production screens.
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* ---------- Color ---------- */}
      <section className="mb-14">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Color</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-9">
          {swatches.map((s) => (
            <div key={s.name}>
              <div className={`h-16 rounded-sm ${s.cls}`} />
              <p className="mt-2 text-xs font-medium">{s.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Type ---------- */}
      <section className="mb-14 space-y-6">
        <h2 className="label-caps text-sm text-muted-foreground">Type</h2>
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">
            display — Instrument Serif — wordmark / mastheads / titles only, never digits
          </p>
          <p className="font-serif text-5xl italic">Golden hour intercept</p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">body/UI — Public Sans</p>
          <p className="max-w-xl text-base">
            Complaint CYB/2026/00842 was filed 06 minutes ago. Predicted cash-out risk is high;
            two prior incidents share the same beneficiary bank within a 5&nbsp;km radius.
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">
            mono — Fragment Mono — numbers, case IDs, timestamps
          </p>
          <p className="font-mono text-2xl tabular-nums">₹2,60,077.00 · 05:52:12 IST · CYB/2026/00842</p>
        </div>
      </section>

      {/* ---------- Buttons ---------- */}
      <section className="mb-14">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Freeze account</Button>
          <Button variant="secondary">Review later</Button>
          <Button variant="outline">Export case</Button>
          <Button variant="ghost">Dismiss</Button>
          <Button variant="destructive">Escalate now</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ---------- Badges ---------- */}
      <section className="mb-14">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Risk badges</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="critical">
            <AlertTriangle className="h-3 w-3" /> critical · 0.92
          </Badge>
          <Badge variant="review">review · 0.63</Badge>
          <Badge variant="clear">
            <ShieldCheck className="h-3 w-3" /> clear · 0.14
          </Badge>
          <Badge variant="secondary">unassigned</Badge>
          <Badge variant="outline">otp_fraud</Badge>
        </div>
      </section>

      {/* ---------- Inputs ---------- */}
      <section className="mb-14 max-w-sm space-y-4">
        <h2 className="label-caps text-sm text-muted-foreground">Inputs</h2>
        <div className="space-y-1.5">
          <Label htmlFor="d-case">Case number</Label>
          <Input id="d-case" placeholder="CYB/2026/00842" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-disabled">Disabled</Label>
          <Input id="d-disabled" disabled placeholder="Locked" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="d-switch" />
          <Label htmlFor="d-switch">Auto lien request above 0.85</Label>
        </div>
      </section>

      {/* ---------- Tabs ---------- */}
      <section className="mb-14 max-w-xl">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Tabs</h2>
        <Tabs defaultValue="feed">
          <TabsList>
            <TabsTrigger value="feed">Live feed</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="graph">Mule ring</TabsTrigger>
          </TabsList>
          <TabsContent value="feed" className="pt-3 text-sm text-muted-foreground">
            12 alerts in the last hour.
          </TabsContent>
          <TabsContent value="map" className="pt-3 text-sm text-muted-foreground">
            4 active hotspots.
          </TabsContent>
          <TabsContent value="graph" className="pt-3 text-sm text-muted-foreground">
            1 ring under active investigation.
          </TabsContent>
        </Tabs>
      </section>

      {/* ---------- Table ---------- */}
      <section className="mb-14">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Table</h2>
        <div className="crosshair-corners border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono">CYB/2026/00842</TableCell>
                <TableCell>Nagpur, MH</TableCell>
                <TableCell className="font-mono tabular-nums">₹2,60,077</TableCell>
                <TableCell>
                  <Badge variant="critical">0.92</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono">CYB/2026/00839</TableCell>
                <TableCell>Coimbatore, TN</TableCell>
                <TableCell className="font-mono tabular-nums">₹40,000</TableCell>
                <TableCell>
                  <Badge variant="review">0.63</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ---------- Dialog / Toast ---------- */}
      <section className="mb-14">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Modal &amp; toast</h2>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open action notice</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue Action Notice</DialogTitle>
                <DialogDescription>
                  Generates a BNSS s.94 document production request for case CYB/2026/00842.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This is a SIMULATED mock connector — no real bank API integration exists.
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button>Generate notice</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={() => toast({ title: "Notice generated", description: "CYB/2026/00842 · sent to SIMULATED bank connector." })}
          >
            Fire toast
          </Button>
        </div>
      </section>

      {/* ---------- Empty / loading ---------- */}
      <section className="mb-14 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="label-caps mb-4 text-sm text-muted-foreground">Empty state</h2>
          <EmptyState
            icon={Search}
            title="No cases match this filter"
            description="Try widening the date range or clearing the district filter."
            action={
              <Button variant="outline" size="sm">
                Clear filters
              </Button>
            }
          />
        </div>
        <div>
          <h2 className="label-caps mb-4 text-sm text-muted-foreground">Skeleton (loading)</h2>
          <div className="space-y-2 border border-border p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <h2 className="label-caps mb-4 text-sm text-muted-foreground">Corner-tick motif</h2>
        <div className="crosshair-corners inline-block border border-border bg-surface p-6 text-sm text-muted-foreground">
          Live-data panel marker — used sparingly, never on every card.
        </div>
      </section>
    </div>
  );
}
