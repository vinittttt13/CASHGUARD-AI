"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Telemetry payload (could send to analytics endpoint)
    const telemetry = { component: "ErrorBoundary", timestamp: new Date().toISOString(), retryCount: (this.state as any).retryCount || 0, stack: errorInfo.componentStack };
    console.info("ErrorBoundary telemetry:", telemetry);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, retryCount: (this.state.retryCount || 0) + 1 });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-risk-critical/30 bg-risk-critical/5 p-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-risk-critical/15 text-risk-critical">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mb-1 text-sm font-semibold label-caps text-risk-critical">
            Module Error
          </h2>
          <p className="mb-5 max-w-md text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred while rendering this component."}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-overlay focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
