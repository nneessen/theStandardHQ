// src/features/analytics/visualizations/USMap.tsx

import React from "react";
import { cn } from "@/lib/utils";

export interface StateData {
  state: string; // Two-letter state code (e.g., 'CA', 'TX')
  value: number;
  label?: string;
}

interface USMapProps {
  data: StateData[];
  title?: string;
  valueLabel?: string;
}

// Full state names mapping
const STATE_NAMES: { [key: string]: string } = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "Washington DC",
};

/**
 * USMap - State performance ranking visualization
 *
 * Displays states ranked by performance with horizontal bars
 * Much clearer than abstract circle positions on a pseudo-map
 */
export function USMap({
  data,
  title = "Performance by State",
  valueLabel = "Premium",
}: USMapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground text-xs">
        No state data available
      </div>
    );
  }

  // Sort states by value (highest to lowest)
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // Get max value for scaling bars
  const maxValue = Math.max(...data.map((d) => d.value));

  // Format currency
  const formatValue = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Determine bar color based on relative performance
  const getBarColor = (value: number, index: number) => {
    const percentage = (value / maxValue) * 100;

    // Top performers (top 3)
    if (index < 3) {
      return "bg-gradient-to-r from-emerald-500 to-emerald-600";
    }
    // Good performers (80%+ of max)
    else if (percentage >= 80) {
      return "bg-gradient-to-r from-blue-500 to-blue-600";
    }
    // Average performers (50-80%)
    else if (percentage >= 50) {
      return "bg-gradient-to-r from-indigo-400 to-indigo-500";
    }
    // Below average (25-50%)
    else if (percentage >= 25) {
      return "bg-gradient-to-r from-slate-400 to-slate-500";
    }
    // Low performers (below 25%)
    else {
      return "bg-gradient-to-r from-gray-400 to-gray-500";
    }
  };

  // Take top 10 states for display (avoid overwhelming the view)
  const displayData = sortedData.slice(0, 10);

  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Top 10 states by {valueLabel.toLowerCase()}
        </p>
      </div>

      {/* State Rankings */}
      <div className="space-y-2">
        {displayData.map((state, index) => {
          const percentage = (state.value / maxValue) * 100;
          const stateName = STATE_NAMES[state.state] || state.state;

          return (
            <div key={state.state} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {/* Rank Badge */}
                  <div
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                      index === 0 && "bg-warning text-white", // Gold
                      index === 1 && "bg-muted text-white", // Silver
                      index === 2 && "bg-warning text-white", // Bronze
                      index >= 3 && "bg-muted text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </div>

                  {/* State Name */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-foreground">
                      {stateName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({state.state})
                    </span>
                  </div>
                </div>

                {/* Value */}
                <span className="text-xs font-mono font-semibold text-foreground">
                  {formatValue(state.value)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="h-5 bg-muted/30 rounded-md overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 ease-out rounded-md",
                      getBarColor(state.value, index),
                    )}
                    style={{ width: `${percentage}%` }}
                  >
                    {/* Percentage label inside bar (if wide enough) */}
                    {percentage > 20 && (
                      <div className="flex items-center h-full px-2">
                        <span className="text-[10px] text-white font-medium">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Percentage label outside bar (if too narrow) */}
                {percentage <= 20 && (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                    {percentage.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      {sortedData.length > 10 && (
        <div className="mt-4 p-3 bg-muted/20 rounded-lg">
          <div className="text-xs text-muted-foreground">
            Showing top 10 of {sortedData.length} states
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total across all states:{" "}
            <span className="font-semibold text-foreground">
              {formatValue(data.reduce((sum, d) => sum + d.value, 0))}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-500 to-emerald-600" />
          <span className="text-[10px] text-muted-foreground">Top 3</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-500 to-blue-600" />
          <span className="text-[10px] text-muted-foreground">Strong</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-indigo-400 to-indigo-500" />
          <span className="text-[10px] text-muted-foreground">Average</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-r from-gray-400 to-gray-500" />
          <span className="text-[10px] text-muted-foreground">
            Below Average
          </span>
        </div>
      </div>
    </div>
  );
}
