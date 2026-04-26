// src/features/analytics/components/PredictiveAnalytics.tsx

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Info, X } from "lucide-react";
import { ForecastChart } from "../visualizations";
import { useAnalyticsData } from "../../../hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";

/**
 * PredictiveAnalytics - Growth forecasts and predictions
 *
 * Shows growth projections with confidence intervals
 */
export function PredictiveAnalytics() {
  const { dateRange } = useAnalyticsDateRange();
  const { forecast, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const [showInfo, setShowInfo] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-3">
          <Heading
            title="Predictive Analytics"
            subtitle="Growth forecasts and predictions"
          />
          <div className="p-10 text-center text-muted-foreground text-xs">
            Loading forecast data...
          </div>
        </CardContent>
      </Card>
    );
  }

  const { growth, renewals } = forecast;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const next3MonthsRenewals = renewals
    .slice(0, 3)
    .reduce((sum, r) => sum + r.expectedRenewals, 0);
  const next3MonthsRevenue = renewals
    .slice(0, 3)
    .reduce((sum, r) => sum + r.expectedRevenue, 0);

  return (
    <Card className="w-full">
      <CardContent className="p-5">
        {/* Hero header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
              Predictive Analytics
            </div>
            <div className="text-xs text-v2-ink-muted mt-0.5">
              Growth forecasts & renewals
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight text-v2-ink leading-none">
                {growth[0]?.growthRate.toFixed(1) || 0}%
              </div>
              <div className="text-[10px] text-v2-ink-subtle mt-1">growth</div>
            </div>
            <Button
              onClick={() => setShowInfo(!showInfo)}
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-v2-pill"
              title="Click for detailed explanation"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Info Panel */}
        {showInfo && (
          <Alert className="bg-muted/30 border-primary/20 mb-4">
            <AlertDescription>
              <div className="flex justify-between items-start mb-3">
                <h3 className="m-0 text-sm font-bold text-foreground">
                  Understanding Predictive Analytics
                </h3>
                <Button
                  onClick={() => setShowInfo(false)}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-4 text-foreground">
                <strong>What is this?</strong> Predictive Analytics uses your
                historical data to forecast future performance and identify
                upcoming opportunities. Think of it as your business crystal
                ball - helping you plan ahead and spot potential issues before
                they happen.
              </div>

              <div className="mb-4">
                <strong className="text-foreground">Key Forecasts:</strong>
              </div>

              <div className="mb-3 pl-4">
                <div className="mb-2">
                  <strong className="text-foreground">
                    Next 3 Months Renewals:
                  </strong>
                  <div className="mt-1 text-muted-foreground">
                    How many policies are coming up for renewal soon
                    <div className="text-xs mt-0.5">
                      Example: <span className="font-bold">25 policies</span> =
                      25 opportunities to re-engage clients
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <strong className="text-foreground">Expected Revenue:</strong>
                  <div className="mt-1 text-muted-foreground">
                    Projected commission income from upcoming renewals
                    <div className="text-xs mt-0.5">
                      Based on current{" "}
                      <span className="font-bold">commission rates</span> and
                      premium amounts
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <strong className="text-foreground">
                    Growth Trajectory:
                  </strong>
                  <div className="mt-1 text-muted-foreground">
                    Projected business growth based on recent trends
                    <div className="text-xs mt-0.5">
                      Shows if you're{" "}
                      <span className="font-bold">trending up</span>,{" "}
                      <span className="font-bold">down</span>, or staying stable
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 p-3 bg-muted/20 rounded-md">
                <strong className="text-foreground">
                  How Predictions Work:
                </strong>
                <div className="text-xs mt-2 text-muted-foreground">
                  The system analyzes:
                  <div className="pl-3 mt-1">
                    • Your last <span className="font-bold">6-12 months</span>{" "}
                    of policy data
                    <br />
                    • Seasonal patterns (busy months vs slow months)
                    <br />
                    • Renewal cycles and policy anniversaries
                    <br />
                    • Historical retention rates
                    <br />• Recent sales trends
                  </div>
                </div>
              </div>

              <div className="mb-4 p-3 bg-muted/20 rounded-md">
                <strong className="text-foreground">Real Example:</strong>
                <div className="text-xs mt-2 text-muted-foreground">
                  Current date: October 2025
                  <br />
                  Next 3 months (Nov, Dec, Jan):
                  <br />• <span className="font-bold">15 policies</span>{" "}
                  renewing in November
                  <br />• <span className="font-bold">12 policies</span>{" "}
                  renewing in December
                  <br />• <span className="font-bold">8 policies</span> renewing
                  in January
                  <br />
                  <div className="mt-2 text-foreground">
                    <strong className="text-foreground">Total:</strong>{" "}
                    <span className="text-foreground font-bold">
                      35 renewal opportunities
                    </span>{" "}
                    worth ~
                    <span className="text-foreground font-bold">$18,000</span>{" "}
                    in commissions
                    <br />
                    <strong className="text-foreground">Action:</strong> Start
                    reaching out 30 days before each renewal date!
                  </div>
                </div>
              </div>

              <div className="p-2 bg-muted/30 rounded text-xs text-center text-foreground font-semibold">
                <strong>Pro Tip:</strong> Contact clients 30-45 days before
                renewal to maximize retention and explore upsell opportunities!
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-v2-canvas border border-v2-ring rounded-v2-sm p-3">
            <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.14em]">
              Next 3 mo · renewals
            </div>
            <div className="text-lg font-semibold text-v2-ink mt-0.5 leading-tight">
              {next3MonthsRenewals}
            </div>
          </div>
          <div className="bg-v2-canvas border border-v2-ring rounded-v2-sm p-3">
            <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.14em]">
              Est. renewal revenue
            </div>
            <div className="text-lg font-semibold text-v2-ink mt-0.5 leading-tight">
              {formatCurrency(next3MonthsRevenue)}
            </div>
          </div>
        </div>

        {/* Forecast Chart */}
        <div className="w-full overflow-hidden">
          <ForecastChart
            data={growth}
            title="12-Month Growth Projection"
            valueKey="projectedCommission"
            valueLabel="Projected Commission"
          />
        </div>

        {/* Disclaimer Note */}
        <div className="mt-4 p-2 bg-muted/20 rounded-lg">
          <p className="text-[10px] text-muted-foreground">
            <strong>*Note:</strong> Renewal revenue is an{" "}
            <span className="text-warning">ESTIMATE</span> based on 25% of
            first-year commission rates. Actual renewal rates vary by carrier
            and product. Contact your carriers for accurate renewal commission
            schedules.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
