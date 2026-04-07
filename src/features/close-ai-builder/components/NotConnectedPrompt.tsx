// Shown when the user has no active close_config row.
// Directs them to connect their Close API key in Close KPI first.

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function NotConnectedPrompt() {
  return (
    <Card className="mx-auto max-w-xl border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/40">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Close CRM not connected</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Close CRM API key first so we can save generated
            templates and sequences to your workspace.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/close-kpi">Connect Close in KPI settings</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
